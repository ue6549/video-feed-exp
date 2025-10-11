import React, { useRef, useState, useEffect } from 'react';
import { 
  View, 
  FlatList, 
  StyleSheet, 
  Dimensions, 
  StatusBar, 
  TouchableWithoutFeedback, 
  Text, 
  TouchableOpacity,
  Alert,
  Animated
} from 'react-native';
import { RecyclerListView, DataProvider, LayoutProvider } from 'recyclerlistview';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { AppConfig } from '../config/AppConfig';
import { IFeedItem, WidgetType } from '../types';
import { SHORTS_VISIBILITY_CONFIG, CAROUSEL_CARDS_VISIBILITY_CONFIG } from '../platback_manager/MediaCardVisibility';
import * as Utilities from '../utilities/Utilities';
import ShortVideoWidget from '../widgets/ShortVideoWidget';
import { MetricsReportModal } from '../instrumentation/MetricsReportModal';
import DataProviderService from '../services/DataProvider';
import feedDataRaw from '../resources/video-feed';
import CacheDebugOverlay from '../components/CacheDebugOverlay';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Type assertion for feed data
const feedData = feedDataRaw as any[];

// Create DataProvider instance
const dataProviderService = new DataProviderService(feedData);

// Create DataProvider for RecyclerListView
const createDataProvider = (data: IFeedItem[]) => {
  return new DataProvider((r1, r2) => r1.id !== r2.id).cloneWithRows(data);
};

const CAROUSEL_HEIGHT = 300;

// Create LayoutProvider
const createLayoutProvider = (data: IFeedItem[]) => {
  return new LayoutProvider(
    (index) => data[index]?.widgetType || 'short',
    (type, dim, index) => {
      const item = data[index];
      if (!item) return;

      if (item.widgetType === 'carousel') {
        dim.width = Math.min(screenWidth, AppConfig.config.feed.maxContentWidth);
        dim.height = CAROUSEL_HEIGHT;
      } else if (item.widgetType === 'merch') {
        const aspectRatioValue = Utilities.parseAspectRatio((item.data as any).aspectRatio) ?? Utilities.DEFULT_ASPECT_RATIO;
        dim.width = Math.min(screenWidth, AppConfig.config.feed.maxContentWidth);
        dim.height = dim.width / aspectRatioValue;
      } else { // short video
        const aspectRatioValue = Utilities.parseAspectRatio((item.data as any).thumbail.aspectRatio) ?? Utilities.DEFULT_ASPECT_RATIO;
        dim.width = Math.min(screenWidth, AppConfig.config.feed.maxContentWidth);
        dim.height = dim.width / aspectRatioValue;
      }
    }
  );
};

const FeedScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  // State
  const [feedData, setFeedData] = useState<IFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);
  
  // FAB state and animation
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const animation = useRef<Animated.Value>(new Animated.Value(0)).current;
  const [geekOn, setGeekOn] = useState<boolean>(false);
  const [applyLodConfigOptimisations, setApplyLodConfigOptimisations] = useState<boolean>(true);
  
  // Current video URL for cache debug overlay
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | undefined>();
  const [showReport, setShowReport] = useState(false);

  // RecyclerListView refs
  const dataProviderRef = useRef(createDataProvider([]));
  const layoutProviderRef = useRef(createLayoutProvider([]));

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const firstPageData = await dataProviderService.getPage(0);
      setFeedData(firstPageData);
      setCurrentPage(0);
      setHasMorePages(dataProviderService.hasMorePages());
      
      // Update RecyclerListView providers
      dataProviderRef.current = createDataProvider(firstPageData);
      layoutProviderRef.current = createLayoutProvider(firstPageData);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      Alert.alert('Error', 'Failed to load video feed');
    } finally {
      setIsLoading(false);
    }
  };

  const loadMoreData = async () => {
    if (isLoadingMore || !hasMorePages) return;

    setIsLoadingMore(true);
    try {
      const nextPage = currentPage + 1;
      const newPageData = await dataProviderService.getPage(nextPage);
      
      const updatedData = [...feedData, ...newPageData];
      setFeedData(updatedData);
      setCurrentPage(nextPage);
      setHasMorePages(dataProviderService.hasMorePages());
      
      // Update RecyclerListView providers
      dataProviderRef.current = createDataProvider(updatedData);
      layoutProviderRef.current = createLayoutProvider(updatedData);
    } catch (error) {
      console.error('Failed to load more data:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const toggleFab = (): void => {
    const toValue = isOpen ? 0 : 1;
    Animated.spring(animation, {
      toValue,
      friction: 5,
      useNativeDriver: true,
    }).start();
    setIsOpen(!isOpen);
  };

  const clearThumbnailCache = async (): Promise<void> => {
    toggleFab();
    try {
      const { default: FastImage } = await import('@d11/react-native-fast-image');
      await FastImage.clearDiskCache();
      await FastImage.clearMemoryCache();
      Alert.alert('Success', 'Thumbnail cache has been cleared.');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      Alert.alert('Error', 'Failed to clear cache. Please try again.');
    }
  };

  const toggelGeekMode = (): void => {
    toggleFab();
    setGeekOn(!geekOn);
  };

  const toggelLoadConfigOptimisations = (): void => {
    toggleFab();
    setApplyLodConfigOptimisations(!applyLodConfigOptimisations);
  };

  const openSettings = (): void => {
    toggleFab();
    navigation.navigate('Settings' as never);
  };

  // FAB animation styles
  const menuButtonStyles = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -120],
        }),
      },
    ],
  };

  const geekButtonStyles = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -60],
        }),
      },
    ],
  };

  const clearCacheButtonStyles = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -180],
        }),
      },
    ],
  };

  const settingsButtonStyles = {
    transform: [
      { scale: animation },
      {
        translateY: animation.interpolate({
          inputRange: [0, 1],
          outputRange: [0, -240],
        }),
      },
    ],
  };

  const rotation = {
    transform: [
      {
        rotate: animation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '45deg'],
        }),
      },
    ],
  };

  const _renderMerch = (feedItem: IFeedItem) => {
    const contentWidth = Math.min(screenWidth, AppConfig.config.feed.maxContentWidth);
    const aspectRatioValue = Utilities.parseAspectRatio((feedItem.data as any).aspectRatio) ?? Utilities.DEFULT_ASPECT_RATIO;
    const { width, height, aspectRatio } = Utilities.getMediaDimensions((feedItem.data as any).aspectRatio);
    const imageUrl = Utilities.getImageUrl((feedItem.data as any).dynamicImageUrl, width, height, 75);
    
    return (
      <View style={[styles.merchContainer, { width: contentWidth }]}>
        <View style={[styles.merchContent, { backgroundColor: feedItem.color }]}>
          <View style={styles.merchHeader}>
            <Text style={styles.merchHeaderText}>Sponsored</Text>
          </View>
          
          <View style={[styles.merchImageContainer, { aspectRatio: aspectRatioValue }]}>
            {/* FastImage will be imported dynamically */}
            <View style={[styles.merchImagePlaceholder, { backgroundColor: '#000' }]}>
              <Text style={styles.merchImageText}>Image: {imageUrl}</Text>
            </View>
          </View>
          
          <View style={styles.merchFooter}>
            <Text style={styles.merchFooterText}>Buy Now!</Text>
          </View>
        </View>
      </View>
    );
  };

  const _renderCarousel = (feedItem: IFeedItem) => {
    const contentWidth = Math.min(screenWidth, AppConfig.config.feed.maxContentWidth);
    const visibleCards = getVisibleCards(screenWidth);
    
    return (
      <View style={[styles.carouselContainer, { width: contentWidth }]}>
        <FlatList
          data={feedItem.data as any[]}
          keyExtractor={(_, index) => `carousel-item-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => {
            const { width, height, aspectRatio } = Utilities.getMediaDimensions(
              item.thumbail.aspectRatio, 
              undefined, 
              CAROUSEL_HEIGHT - 20
            );
            const thumbnailUrl = Utilities.getImageUrl(item.thumbail.dynamicImageUrl, width, height, 75);
            
            return (
              <View style={[styles.carouselItem, { width, height: CAROUSEL_HEIGHT - 20 }]}>
                <ShortVideoWidget
                  videoProps={{
                    item: {
                      id: item.videoSource.url,
                      videoSource: item.videoSource,
                      thumbnailUrl,
                      aspectRatio: item.thumbail.aspectRatio,
                      videoCategory: feedItem.widgetType as WidgetType
                    },
                    visibilityConfig: CAROUSEL_CARDS_VISIBILITY_CONFIG,
                    geekMode: geekOn,
                  }}
                  style={[styles.carouselVideoCard, { backgroundColor: '#000' }]}
                  title='Carousel Video'
                  topComment='Swipe to see more videos'
                />
              </View>
            );
          }}
          contentContainerStyle={[styles.carouselContent, { backgroundColor: feedItem.color }]}
        />
      </View>
    );
  };

  const getVisibleCards = (screenWidth: number): number => {
    if (screenWidth < 768) return AppConfig.config.widgets.carousel.cardsVisible.small;
    if (screenWidth < 1024) return AppConfig.config.widgets.carousel.cardsVisible.medium;
    return AppConfig.config.widgets.carousel.cardsVisible.large;
  };

  const rowRenderer = (type: string | number, item: IFeedItem) => {
    if (item.widgetType === 'carousel') {
      return _renderCarousel(item);
    } else if (item.widgetType === 'merch') {
      return _renderMerch(item);
    } else {
      const { width, height, aspectRatio } = Utilities.getMediaDimensions((item.data as any).thumbail.aspectRatio);
      const thumbnailUrl = Utilities.getImageUrl((item.data as any).thumbail.dynamicImageUrl, width, height, 75);

      return (
        <View style={[styles.shortVideoContainer, { width: Math.min(screenWidth, AppConfig.config.feed.maxContentWidth) }]}>
          <ShortVideoWidget
            videoProps={{
              item: {
                id: (item.data as any).videoSource.url,
                videoSource: (item.data as any).videoSource,
                thumbnailUrl,
                aspectRatio: (item.data as any).thumbail.aspectRatio,
                videoCategory: item.widgetType as WidgetType
              },
              visibilityConfig: SHORTS_VISIBILITY_CONFIG,
              geekMode: geekOn
            }}
            style={[styles.shortVideoCard, { backgroundColor: item.color }]}
            title='Sample Title'
            topComment='Top comment goes here. If only someone would comment on my code...'
          />
        </View>
      );
    }
  };

  const onEndReached = () => {
    if (hasMorePages && !isLoadingMore) {
      loadMoreData();
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading video feed...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar hidden />
      
      {/* Main Feed */}
      <View style={styles.container}>
        <RecyclerListView
          rowRenderer={rowRenderer}
          dataProvider={dataProviderRef.current}
          layoutProvider={layoutProviderRef.current}
          style={styles.list}
          contentContainerStyle={[styles.contentContainer, { paddingTop: insets.top }]}
          forceNonDeterministicRendering={true}
          extendedState={{ geekOn, applyLodConfigOptimisations }}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.1}
        />
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity onPress={() => setShowReport(true)}>
          <Text style={styles.footerText}>Open Metrics Report</Text>
        </TouchableOpacity>
      </View>

      {/* Report Modal */}
      <MetricsReportModal visible={showReport} onClose={() => setShowReport(false)} />
      
      {/* Cache Debug Overlay */}
      <CacheDebugOverlay currentVideoUrl={currentVideoUrl} />

      {/* FAB and options */}
      <View style={[styles.fabContainer, { padding: insets.bottom }]}>
        {isOpen && (
          <TouchableWithoutFeedback onPress={toggleFab}>
            <View style={styles.fabOverlay} />
          </TouchableWithoutFeedback>
        )}

        <TouchableWithoutFeedback onPress={openSettings}>
          <Animated.View style={[styles.fab, styles.secondaryFab, settingsButtonStyles]}>
            <Text style={styles.fabText}>Settings</Text>
          </Animated.View>
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={clearThumbnailCache}>
          <Animated.View style={[styles.fab, styles.secondaryFab, clearCacheButtonStyles]}>
            <Text style={styles.fabText}>Clear Cache</Text>
          </Animated.View>
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={toggelGeekMode}>
          <Animated.View style={[styles.fab, styles.secondaryFab, geekButtonStyles]}>
            <Text style={styles.fabText}>{geekOn ? 'Hide Stats' : 'Show Stats'}</Text>
          </Animated.View>
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={toggelLoadConfigOptimisations}>
          <Animated.View style={[styles.fab, styles.secondaryFab, menuButtonStyles]}>
            <Text style={styles.fabText}>{applyLodConfigOptimisations ? 'Standard Load Params' : 'Optimise Load Params'}</Text>
          </Animated.View>
        </TouchableWithoutFeedback>

        <TouchableWithoutFeedback onPress={toggleFab}>
          <Animated.View style={[styles.fab, styles.mainFab, rotation]}>
            <Text style={styles.fabText}>+</Text>
          </Animated.View>
        </TouchableWithoutFeedback>
      </View>
    </SafeAreaProvider>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
  },
  list: {
    flex: 1,
    width: '100%',
  },
  contentContainer: {
    paddingVertical: 16,
  },
  shortVideoContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  shortVideoCard: {
    marginHorizontal: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  carouselContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  carouselContent: {
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  carouselItem: {
    margin: 10,
    backgroundColor: '#000',
    borderRadius: 8,
    overflow: 'hidden',
  },
  carouselVideoCard: {
    width: '100%',
    height: '100%',
  },
  merchContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  merchContent: {
    borderRadius: 8,
    overflow: 'hidden',
  },
  merchHeader: {
    height: 40,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  merchImageContainer: {
    marginVertical: 8,
    borderRadius: 8,
    backgroundColor: '#000',
  },
  merchImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchImageText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    padding: 8,
  },
  merchFooter: {
    height: 40,
    backgroundColor: '#000000aa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchFooterText: {
    color: '#fff',
    fontSize: 16,
  },
  footer: {
    backgroundColor: '#1f0505ff',
    height: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    color: '#8ab4ff',
    fontSize: 16,
  },
  fabContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 10,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#03A9F4',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
  },
  mainFab: {
    backgroundColor: '#2196F3',
    elevation: 8,
    zIndex: 10,
  },
  secondaryFab: {
    width: 130,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#03A9F4',
    elevation: 6,
  },
  fabText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
  fabOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1,
  },
});

export default FeedScreen;

