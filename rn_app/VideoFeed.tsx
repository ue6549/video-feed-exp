import React, { useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions, Image, Animated, Alert, StatusBar, TouchableWithoutFeedback, Text } from 'react-native';
import { RecyclerListView, DataProvider, LayoutProvider } from 'recyclerlistview';
import feedData from './resources/video-feed';
import VideoCard from './components/VideoCard';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SHORTS_VISIBILITY_CONFIG, CAROUSEL_CARDS_VISIBILITY_CONFIG } from './platback_manager/MediaCardVisibility';

interface VideoSource {
    sourceType: string;
    url: string;
    type: string;
}

interface Thumbnail {
    width: number;
    aspectRatio: string;
    type: string;
    height: number;
    dynamicImageUrl: string;
}

interface VideoData {
    videoSource: VideoSource;
    thumbail: Thumbnail;
}

interface IFeedItem {
    id: string;
    widgetType: string; // 'short' | 'carousel'
    color: string;
    data: VideoData | VideoData[];
}

/**
 * 
 * @param originalArray 
 * @returns Every 4th element is replaced by a sub-array of next 6 elements
 */
function transformArrayToFeed(originalArray: any[]): IFeedItem[] {
    const newArray: IFeedItem[] = [];
    let i = 0; // Index for iterating through the originalArray

    while (i < originalArray.length) {
        // Check if this is the position for the collection (every 4th element)
        if ((newArray.length + 1) % 4 === 0) {
            const feedItem = {
                widgetType: 'carousel',
                color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
                id: `carousel-${i}`,
                data: originalArray.slice(i, i + 6).map(item => ({ videoSource: item.video_source, thumbail: item.thumbail })),
            };
            newArray.push(feedItem);
            i += 6; // Move index forward by 6 for the next iteration
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

const DEFULT_ASPECT_RATIO = 9 / 16; // Fallback aspect ratio
const FALLBACK_MEDIA_WIDTH = 1000;


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
        } else {
            const aspectRatioValue = parseAspectRatio((item.data as VideoData).thumbail.aspectRatio) ?? DEFULT_ASPECT_RATIO;
            dim.width = Dimensions.get('window').width;
            dim.height = dim.width / aspectRatioValue;
        }
    }
);

const parseAspectRatio = (ratioString: string): number | undefined => {
    const parts = ratioString.split(':');
    if (parts.length === 2) {
        const width = parseFloat(parts[1]);
        const height = parseFloat(parts[0]);
        return width / height;
    }
    return undefined;
};


function VideoFeed(): JSX.Element {
    const insets = useSafeAreaInsets();
    // FAB state and animation
    const [isOpen, setIsOpen] = useState<boolean>(false);
    const animation = useRef<Animated.Value>(new Animated.Value(0)).current;

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

    const menuButtonStyles = {
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
                    outputRange: [0, -120],
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

    const _renderCarousel = (feedItem: IFeedItem) => {
        return (
            <FlatList
                data={feedItem.data as VideoData[]}
                keyExtractor={(_, index) => `carousel-item-${index}`}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => {
                    const { width, height, aspectRatio } = _getMediaDimensions(item.thumbail.aspectRatio, undefined, CAROUSEL_HEIGHT - 20);
                    const thumbnailUrl = _getImageUrl(item.thumbail.dynamicImageUrl, width, height, 75);
                    return (
                        <View style={{ width: 200, height: CAROUSEL_HEIGHT - 20, margin: 10, backgroundColor: '#000', borderRadius: 8, overflow: 'hidden' }}>
                            <VideoCard
                                item={{ id: item.videoSource.url, videoSource: item.videoSource, thumbnailUrl, videoCategory: feedItem.widgetType }}
                                style={{ width, height: height, backgroundColor: '#000' }}
                                visibilityConfig={CAROUSEL_CARDS_VISIBILITY_CONFIG}
                            />
                        </View>
                    );
                }}
                contentContainerStyle={{ paddingHorizontal: 8 }}
            />
        );
    }

    const rowRenderer = (type: string | number, item: IFeedItem) => {
        if (item.widgetType === 'carousel') { // Render carousel
            return _renderCarousel(item);
        } else {
            const { width, height, aspectRatio } = _getMediaDimensions((item.data as VideoData).thumbail.aspectRatio);
            const thumbnailUrl = _getImageUrl((item.data as VideoData).thumbail.dynamicImageUrl, width, height, 75);

            return (
                <VideoCard
                    item={{ id: item.id, videoSource: (item.data as VideoData).videoSource, thumbnailUrl, videoCategory: item.widgetType }}
                    style={[styles.item, { aspectRatio, backgroundColor: item.color }]}
                    visibilityConfig={SHORTS_VISIBILITY_CONFIG}
                />
            );
        }
    };

    const _getMediaDimensions = (ratioString: string, width?: number, height?: number) => {
        const aspectRatioValue = parseAspectRatio(ratioString) ?? DEFULT_ASPECT_RATIO;
        if (width && !height) {
            return { width: Math.ceil(width), height: Math.ceil(width / aspectRatioValue), aspectRatio: aspectRatioValue };
        } else if (!width && height) {
            return { width: Math.ceil(height * aspectRatioValue), height: Math.ceil(height), aspectRatio: aspectRatioValue };
        } else if (width && height) {
            return { width: Math.ceil(width), height: Math.ceil(height), aspectRatio: width / height };
        } else {
            return { width: FALLBACK_MEDIA_WIDTH, height: Math.ceil(FALLBACK_MEDIA_WIDTH / aspectRatioValue), aspectRatio: aspectRatioValue }; // Default size
        }
    }

    const _getImageUrl = (parameterizedUrl: String, width?: number, height?: number, q?: number) => {
        return parameterizedUrl.replace('{@width}', `${width ? width : 1000}`)
            .replace('{@height}', `${height ? height : 1000}`)
            .replace('{@quality}', `${q ? q : 75}`);
    }

    const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

    return (
        <SafeAreaProvider>
            <StatusBar hidden />
            <RecyclerListView
                rowRenderer={rowRenderer}
                dataProvider={dataProvider}
                layoutProvider={layoutProvider}
                style={styles.list}
                contentContainerStyle={styles.container}
                forceNonDeterministicRendering={true} // Set to true for variable-height items
            />
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

                <TouchableWithoutFeedback onPress={() => { Alert.alert('Settings', 'Settings action triggered.'); toggleFab(); }}>
                    <Animated.View style={[styles.fab, styles.secondaryFab, menuButtonStyles]}>
                        <Text style={styles.fabText}>Settings</Text>
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