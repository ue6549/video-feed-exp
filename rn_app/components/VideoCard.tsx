import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, ViewProps, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { VisibilityTrackingView, VisibilityStateChangeEvent } from './native_components/VisibilityTrackingView'; // Import your components
import Video, { OnLoadData, OnLoadStartData, OnVideoErrorData, ReactVideoProps } from 'react-native-video';
import FastImage from '@d11/react-native-fast-image';

// Sample interface for your video item data
interface VideoItem {
    id: string;
    videoSource: { url: string };
    thumbnailUrl: string;
}

/**
 * ReactVideoProps are a way to customise the behaviour of this video card.
 * Only things additional it is doing right now 
 * 1. Not loading the video player but just making do with and image view if the video is not in view port or area of interest.
 *      Thus saving memory and CPU usage.
 * 2. Is using a FastImage for thumbnail fetching and caching. Leveraging just the Video component props for better UI and loading handling
 */
interface VideoCardProps extends ViewProps {
    item: VideoItem;
    videoProps?: ReactVideoProps;
}

// Define the visibility thresholds for our custom logic
const THRESHOLDS = {
    // 10% or more visible (incoming) -> Add video component, paused
    prepareToBeActive: 75,
    // 50% or more visible (incoming) -> Play video
    isActive: 90,
    // 30% or less visible (outgoing) -> Pause video
    willResignActive: 30,
    // 0% visible (outgoing) -> Remove video component
    notActive: 0,
};

type LoaderState = 'loading' | 'none' | 'error';


const VideoCard: React.FC<VideoCardProps> = ({ item, videoProps, ...rest }) => {
    const [isPlayerAttached, setIsPlayerAttached] = useState(false);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    const [lastVisibilityPercentage, setLastVisibilityPercentage] = useState(0);
    const [retryKey, setRetryKey] = useState<number>(0);
    const [loaderState, setLoaderState] = useState<LoaderState>('loading');

    const onVisibilityChange = (event: { nativeEvent: VisibilityStateChangeEvent }) => {
        const { currentVisibilityPercentage } = event.nativeEvent;
        const incoming = currentVisibilityPercentage > lastVisibilityPercentage;
        setLastVisibilityPercentage(currentVisibilityPercentage);

        // Logic based on incoming/outgoing direction
        if (incoming) {
            if (currentVisibilityPercentage >= THRESHOLDS.isActive) {
                setIsPlayerAttached(true);
                setIsPlayerPlaying(true);
            } else if (currentVisibilityPercentage >= THRESHOLDS.prepareToBeActive) {
                setIsPlayerAttached(true);
                setIsPlayerPlaying(false);
            }
        } else { // Outgoing
            if (currentVisibilityPercentage <= THRESHOLDS.notActive) {
                setIsPlayerAttached(false);
                setIsPlayerPlaying(false);
            } else if (currentVisibilityPercentage <= THRESHOLDS.willResignActive) {
                setIsPlayerPlaying(false);
            }
        }
    };


    // Video event handlers
    const handleLoadStart = (data: OnLoadStartData) => {
        // Only show the loading state if a player is attached
        if (isPlayerAttached) {
            setLoaderState('loading');
        }
    };

    const handleLoad = (data: OnLoadData) => {
        setLoaderState('none');
    };

    const handleError = (error: OnVideoErrorData) => {
        console.error('Video playback error', error);
        setLoaderState('error');
    };

    const handleRetry = () => {
        // Force a re-render of the Video component by changing its key
        setRetryKey(prevKey => prevKey + 1);
        setLoaderState('loading');
    };

    const renderLoader = () => {
        // Use the same renderLoader function, but change the content based on state
        if (loaderState === 'error') {
            return (
                <View style={styles.errorContainer}>
                    <FastImage
                        source={{
                            uri: item.thumbnailUrl,
                            priority: FastImage.priority.high,
                            cache: FastImage.cacheControl.immutable,
                        }}
                        style={[styles.media, StyleSheet.absoluteFill]}
                        resizeMode="contain"
                    />
                    <Text style={styles.errorText}>Video failed to load.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        return (
            <View style={styles.loaderContainer}>
                <FastImage
                    source={{
                        uri: item.thumbnailUrl,
                        priority: FastImage.priority.high,
                        cache: FastImage.cacheControl.immutable,
                    }}
                    style={[styles.media, StyleSheet.absoluteFill]}
                    resizeMode="contain"
                />
                <ActivityIndicator animating={true} size={'large'} />
            </View>
        );
    };

    // const renderAccessoryContentView = () => (
    //     <View style={{ position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 5, borderRadius: 5 }}>
    //         <Image source={{ uri: item.thumbnailUrl }} style={{ width: 50, height: 50 }} />
    //     </View>
    // );

    return (
        // Spread the rest props (including 'style') to the VisibilityTrackingView
        <VisibilityTrackingView
            {...rest}
            throttleInterval={50}
            visibilityThresholds={THRESHOLDS}
            uniqueId={item.id}
            onVisibilityStateChange={onVisibilityChange}>

            {/* Thumbnail Image - show a image view when player is not attached, card is outside the view port */}
            {!isPlayerAttached && (
                <FastImage
                    source={{
                        uri: item.thumbnailUrl,
                        priority: FastImage.priority.high,
                        cache: FastImage.cacheControl.immutable
                    }}
                    style={styles.media}
                    resizeMode="contain"
                />
            )}

            {isPlayerAttached && (
                <Video
                    {...videoProps}
                    key={item.id + retryKey}
                    source={{ uri: item.videoSource.url }}
                    style={styles.media}
                    controls={true}
                    resizeMode="contain"
                    // poster={{source: { uri: item.thumbnailUrl}, resizeMode: 'contain' }}
                    renderLoader={loaderState !== 'none' ? renderLoader : undefined}
                    progressUpdateInterval={250}
                    onError={handleError}
                    onLoadStart={handleLoadStart}
                    onLoad={handleLoad}
                    paused={!isPlayerPlaying}
                    repeat={true}   // Take this from props if needed, repeat in full page feed but not in main feed
                    playInBackground={false}
                    muted={true}
                    volume={0}
                />
            )}
        </VisibilityTrackingView>
    );
};

const styles = StyleSheet.create({
    media: {
        width: '100%',
        height: '100%',
    },
    loaderContainer: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'green',
    },
    errorContainer: {
        ...StyleSheet.absoluteFillObject,
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.8)',
    },
    errorText: {
        color: 'white',
        fontSize: 16,
        marginBottom: 10,
        textAlign: 'center',
    },
    retryButton: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 5,
    },
    retryButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
});

export default VideoCard;
