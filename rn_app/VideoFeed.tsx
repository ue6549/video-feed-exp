import React, { useRef, useState } from 'react';
import { View, FlatList, StyleSheet, Dimensions, Image, Animated, Alert, StatusBar, TouchableWithoutFeedback, Text } from 'react-native';
import { RecyclerListView, DataProvider, LayoutProvider } from 'recyclerlistview';
import feedData from './resources/video-feed';
import VideoCard from './components/VideoCard';
import FastImage from '@d11/react-native-fast-image';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

interface IFeedItem {
    id: string;
    widgetType: 'short' | 'carousel';
    color: string;
    videoSource: {
        sourceType: string;
        url: string;
        type: string;
    };
    thumbnail: {
        width: number,
        aspectRatio: string,
        type: string,
        height: number,
        dynamicImageUrl: string
    };
}

const DATA: IFeedItem[] = Array.from({ length: feedData.length }, (_, i) => ({
    id: i.toString(),
    widgetType: i % 4 != 3 ? 'short' : 'carousel',
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    videoSource: feedData[i].video_source,
    thumbnail: feedData[i].thumbail,
}));

const DEFULT_ASPECT_RATIO = 9 / 16; // Fallback aspect ratio
const FALLBACK_MEDIA_WIDTH = 1000;

// Create DataProvider
const dataProvider = new DataProvider((r1, r2) => {
    return r1.id !== r2.id;
}).cloneWithRows(DATA);

// Create LayoutProvider
const layoutProvider = new LayoutProvider(
    (index) => {
        // Return a type for each item, allowing for different layouts
        return DATA[index].widgetType;
    },
    (type, dim, index) => {
        const item = DATA[index];
        const aspectRatioValue = parseAspectRatio(item.thumbnail.aspectRatio) ?? DEFULT_ASPECT_RATIO;
        dim.width = Dimensions.get('window').width;
        dim.height = dim.width / aspectRatioValue;
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

    const rowRenderer = (type: string | number, item: IFeedItem) => {
        const { width, height, aspectRatio } = _getMediaDimensions(item.thumbnail.aspectRatio);
        const thumbnailUrl = _getImageUrl(item, width, height, 75);

        return (
            <VideoCard
                item={{ id: item.id, videoSource: item.videoSource, thumbnailUrl }}
                style={[styles.item, { aspectRatio, backgroundColor: item.color }]}
            />
        );
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

    const _getImageUrl = (item: IFeedItem, width?: number, height?: number, q?: number) => {
        return item.thumbnail.dynamicImageUrl.replace('{@width}', `${width ? width : 1000}`)
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