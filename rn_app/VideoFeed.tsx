import React, { useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions, Image, Animated, Alert, StatusBar, TouchableWithoutFeedback, Text, ScrollView } from 'react-native';
import { RecyclerListView, DataProvider, LayoutProvider } from 'recyclerlistview';
import feedData from './resources/video-feed';
import VideoCard from './components/VideoCard';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHORTS_VISIBILITY_CONFIG, CAROUSEL_CARDS_VISIBILITY_CONFIG } from './platback_manager/MediaCardVisibility';
import * as Utilities from './utilities/Utilities';
import ShortVideoWidget from './widgets/ShortVideoWidget';

export interface VideoSource {
    sourceType: string;
    url: string;
    type: string;
}

export interface Thumbnail {
    width: number;
    aspectRatio: string;
    type: string;
    height: number;
    dynamicImageUrl: string;
}

export interface VideoData {
    videoSource: VideoSource;
    thumbail: Thumbnail;
}

export interface IFeedItem {
    id: string;
    widgetType: string; // 'short' | 'carousel' | 'merch'
    color: string;
    data: VideoData | VideoData[] | Thumbnail;
}

/**
 * 
 * @param originalArray 
 * @returns Every 4th element is replaced by a sub-array of next 6 elements
 */
function transformArrayToFeed(originalArray: any[]): IFeedItem[] {
    const newArray: IFeedItem[] = [];
    let i = 0; // Index for iterating through the originalArray
    let stepSinceLastMerch = 0; // Steps since last merch insertion

    while (i < originalArray.length) {
        if (stepSinceLastMerch > 2 && Math.random() > 0.75) {
            stepSinceLastMerch = 0;
            const imageUrl = `https://picsum.photos/seed/${Math.floor(Math.random()*10)}/{@width}/{@height}`
            const feedItem = {
                widgetType: 'merch',
                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                id: `merch-${i}`,
                data: {
                    width: 0,
                    type: "ImageValue",
                    height: 0,
                    aspectRatio: '5:4', dynamicImageUrl: imageUrl
                },
            };
            newArray.push(feedItem);
        }
        else if ((newArray.length + 1) % 4 === 0) {
            const feedItem = {
                widgetType: 'carousel',
                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                id: `carousel-${i}`,
                data: originalArray.slice(i, i + 6).map(item => ({ videoSource: item.video_source, thumbail: item.thumbail })),
            };
            newArray.push(feedItem);
            i += 6; // Move index forward by 6 for the next iteration
            stepSinceLastMerch += 1;
        } else {
            // Take a single element
            const feedItem = {
                widgetType: 'short',
                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                id: `short-${i}`,
                data: { videoSource: originalArray[i].video_source, thumbail: originalArray[i].thumbail },
            };
            newArray.push(feedItem);
            i += 1;
            stepSinceLastMerch += 1;
        }
    }
    return newArray;
}

// const DATA: IFeedItem[] = Array.from({ length: feedData.length }, (_, i) => {
//     let widgetType = 'short';
//     const color = `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
//     const id = i.toString();
//     const data = { videoSource: feedData[i].video_source, thumbail: feedData[i].thumbail };
//     return { widgetType, color, id, data }
// });

const DATA = transformArrayToFeed(feedData);

const {
    DEFULT_ASPECT_RATIO,
    parseAspectRatio,
    getMediaDimensions,
    getImageUrl
} = Utilities;

// Create DataProvider
const dataProvider = new DataProvider((r1, r2) => {
    return r1.id !== r2.id;
}).cloneWithRows(DATA);

const CAROUSEL_HEIGHT = 300;
// Create LayoutProvider
const layoutProvider = new LayoutProvider(
    (index) => {
        // Return a type for each item, allowing for different layouts
        return DATA[index].widgetType;
    },
    (type, dim, index) => {
        const item = DATA[index];
        if (item.widgetType === 'carousel') {
            dim.width = Dimensions.get('window').width;
            dim.height = CAROUSEL_HEIGHT; // Fixed height for carousel
        } else if (item.widgetType === 'merch') {
            const aspectRatioValue = parseAspectRatio((item.data as Thumbnail).aspectRatio) ?? DEFULT_ASPECT_RATIO;
            dim.width = Dimensions.get('window').width;
            dim.height = dim.width / aspectRatioValue;
        } else {
            const aspectRatioValue = parseAspectRatio((item.data as VideoData).thumbail.aspectRatio) ?? DEFULT_ASPECT_RATIO;
            dim.width = Dimensions.get('window').width;
            dim.height = dim.width / aspectRatioValue;
        }
    }
);

function VideoFeed(): JSX.Element {
    const insets = useSafeAreaInsets();
    // FAB state and animation
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const animation = useRef<Animated.Value>(new Animated.Value(0)).current;

    const [geekOn, setGeekOn] = useState<boolean>(false);
    const [applyLodConfigOptimisations, setApplyLodConfigOptimisations] = useState<boolean>(true);

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
    }

    const toggelLoadConfigOptimisations = (): void => {
        toggleFab();
        setApplyLodConfigOptimisations(!applyLodConfigOptimisations);
    }

    const menuButtonStyles = {
        transform: [
            {
                scale: animation,
            },
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
            {
                scale: animation,
            },
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
            {
                scale: animation,
            },
            {
                translateY: animation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -180],
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
        const boxSize = Dimensions.get('window');
        const aspectRatioValue = parseAspectRatio((feedItem.data as Thumbnail).aspectRatio) ?? DEFULT_ASPECT_RATIO;
        const { width, height, aspectRatio } = getMediaDimensions((feedItem.data as Thumbnail).aspectRatio);
        const imageUrl = getImageUrl((feedItem.data as Thumbnail).dynamicImageUrl, width, height, 75);
        return (
            <View style={{
                // alignContent: 'flex-start',
                alignItems: 'center',
                backgroundColor: feedItem.color,
                width: boxSize.width,
                height: Math.ceil(boxSize.width / aspectRatioValue) + 80,
                borderRadius: 8,
                overflow: 'hidden' 
            }}>
                <View style={{ margin: 0, width: '100%', height: 40, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginVertical: 8 }}>Sponsored</Text>
                    </View>
                <FastImage
                    style={{ marginVertical: 8, borderRadius: 8, width: boxSize.width - 16, flex: 1, aspectRatio: aspectRatioValue, backgroundColor: '#000' }}
                    source={{
                        uri: imageUrl,
                        priority: FastImage.priority.high,
                    }}
                    resizeMode={FastImage.resizeMode.contain}
                />
                <View style={{ margin: 0, width: '100%', height: 40, backgroundColor: '#000000aa', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 16, marginVertical: 8 }}>Buy Now!</Text>
                    </View>
            </View>
        );
    }

    const _renderCarousel = (feedItem: IFeedItem) => {
        return (
            <FlatList
                data={feedItem.data as VideoData[]}
                keyExtractor={(_, index) => `carousel-item-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                    const { width, height, aspectRatio } = getMediaDimensions(item.thumbail.aspectRatio, undefined, CAROUSEL_HEIGHT - 20);
                    const thumbnailUrl = getImageUrl(item.thumbail.dynamicImageUrl, width, height, 75);
                    return (
                        <View style={{ width, height: CAROUSEL_HEIGHT - 20, margin: 10, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' }}>
                            <VideoCard
                                item={{ id: item.videoSource.url, videoSource: item.videoSource, thumbnailUrl, videoCategory: feedItem.widgetType }}
                                style={{ width, height: height, backgroundColor: '#000' }}
                                visibilityConfig={CAROUSEL_CARDS_VISIBILITY_CONFIG}
                                applyLoadConfigOptimisations={applyLodConfigOptimisations}
                                geekMode={geekOn}
                            />
                        </View>
                    );
                }}
                contentContainerStyle={{ paddingHorizontal: 8, backgroundColor: feedItem.color, borderRadius: 8 }}
            />
        );
    }

    const rowRenderer = (type: string | number, item: IFeedItem) => {
        if (item.widgetType === 'carousel') { // Render carousel
            return _renderCarousel(item);
        } else if (item.widgetType === 'merch') {
            return _renderMerch(item);
        } else {
            const { width, height, aspectRatio } = getMediaDimensions((item.data as VideoData).thumbail.aspectRatio);
            const thumbnailUrl = getImageUrl((item.data as VideoData).thumbail.dynamicImageUrl, width, height, 75);

            return (
                <ShortVideoWidget videoProps={{
                    item: {
                        id: (item.data as VideoData).videoSource.url,
                        videoSource: (item.data as VideoData).videoSource,
                        thumbnailUrl,
                        aspectRatio: (item.data as VideoData).thumbail.aspectRatio,
                        videoCategory: item.widgetType
                    },
                    visibilityConfig: SHORTS_VISIBILITY_CONFIG,
                    geekMode: geekOn,
                    applyLoadConfigOptimisations: applyLodConfigOptimisations
                }}
                    style={[styles.item, { backgroundColor: item.color }]}
                    title='Sample Title'
                    topComment='Top comment goes here. If only someone would comment on my code...'
                />
            );
        }
    };

    // const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    return (
        <SafeAreaProvider>
            <StatusBar hidden />
            <RecyclerListView
                rowRenderer={rowRenderer}
                dataProvider={dataProvider}
                layoutProvider={layoutProvider}
                style={styles.list}
                contentContainerStyle={[styles.container, { paddingTop: insets.top }]}
                forceNonDeterministicRendering={true} // Set to true for variable-height items
                extendedState={{ geekOn, applyLodConfigOptimisations }}
            />
            <View style={{backgroundColor: '#1f0505ff', height: 66, width: 'auto', margin: 0}}></View>
            {/* FAB and options */}
            <View style={[styles.fabContainer, { padding: insets.bottom }]}>
                {isOpen && (
                    <TouchableWithoutFeedback onPress={toggleFab}>
                        <View style={styles.fabOverlay} />
                    </TouchableWithoutFeedback>
                )}

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
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
    },
    list: {
        flex: 1,
    },
    item: {
        marginVertical: 8,
        marginHorizontal: 4,
        borderRadius: 12,
        overflow: 'hidden',
        width: Dimensions.get('window').width - 8,
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
    },
    fabOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        zIndex: 1,
    },
});

export default VideoFeed;