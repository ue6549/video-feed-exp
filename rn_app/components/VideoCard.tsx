import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, ViewProps, ActivityIndicator, Text, TouchableOpacity, Animated } from 'react-native';
import { VisibilityTrackingView, VisibilityStateChangeEvent, RawVisibilityTransitioningConfig } from './native_components/VisibilityTrackingView';
import FastImage from '@d11/react-native-fast-image';
import { playbackEvents, handleVisibilityChange } from '../platback_manager/PlaybackManager';
import { MediaCardVisibility, VisibilityTransitioningConfig } from '../platback_manager/MediaCardVisibility';
import { metrics } from '../instrumentation/VideoMetrics';
import { DebugHUD } from '../instrumentation/DebugHUD';
import VideoPlayerView from './VideoPlayerView';
import PlayButton from './PlayButton';
import { AppConfig } from '../config/AppConfig';
import { WidgetType } from '../types';
import { logger } from '../utilities/Logger';

// Sample interface for your video item data
interface VideoItem {
    id: string;
    videoCategory?: WidgetType; // e.g., 'short' or 'carousel'
    videoSource: { 
        url: string;
        videoType?: 'VOD' | 'LIVE';
    };
    thumbnailUrl: string;
    aspectRatio?: string; // e.g., '16:9'
}

const toRawVisibilityConfig = (config: VisibilityTransitioningConfig): RawVisibilityTransitioningConfig => {
    return {
        movingIn: [config.movingIn.prefetch, config.movingIn.prepareToBeActive, config.movingIn.isActive],
        movingOut: [config.movingOut.willResignActive, config.movingOut.notActive, config.movingOut.released],
    };
}

/**
 * VideoCardProps for customizing video card behavior
 * Uses custom VideoPlayerView native module for playback
 */
export interface VideoCardProps extends ViewProps {
    item: VideoItem;

    geekMode?: boolean; // Show the debug HUD with metrics

    // Visibility configuration for playback control
    visibilityConfig?: VisibilityTransitioningConfig;
}

// Define the visibility thresholds for our custom logic
const DEFAULT_VISIBILITY_THRESHOLDS: VisibilityTransitioningConfig = {
    movingIn: {
        // 5% or more visible (incoming) -> Start prefetch
        prefetch: 5,
        // 25% or more visible (incoming) -> Add video component, paused
        prepareToBeActive: 25,
        // 50% or more visible (incoming) -> Play video
        isActive: 50,
    },
    movingOut: {
        // 90% or less visible (outgoing) -> Pause video
        willResignActive: 90,
        // 20% or less visible (outgoing) -> Remove video component
        notActive: 20,
        // 5% or less visible (outgoing) -> Cancel prefetch, full cleanup
        released: 5,
    }
};

type LoaderState = 'loading' | 'none' | 'error' | 'stopped' | 'loaded';

// Video event data types (for VideoPlayerView callbacks)
interface OnLoadStartData {
    isNetwork: boolean;
    type: string;
    uri: string;
}

interface OnLoadData {
    duration: number;
    naturalSize: { width: number; height: number; orientation: string };
}

interface OnVideoErrorData {
    error: {
        code?: number;
        localizedDescription?: string;
        localizedFailureReason?: string;
        localizedRecoverySuggestion?: string;
        domain?: string;
    };
}

interface OnBufferData {
    isBuffering: boolean;
}

interface OnProgressData {
    currentTime: number;
    playableDuration: number;
    seekableDuration: number;
}

interface OnPlaybackRateChangeData {
    playbackRate: number;
}

const VideoCard: React.FC<VideoCardProps> = ({ item, visibilityConfig, geekMode, ...rest }) => {
    const playStartTs = useRef<number | null>(null);

    const [debugText, setDebugText] = useState(`${MediaCardVisibility.notActive} - 0%`);
    const [isPlayerAttached, setIsPlayerAttached] = useState(false);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    const [lastVisibilityPercentage, setLastVisibilityPercentage] = useState(0);
    const [retryKey, setRetryKey] = useState<number>(0);
    const [loaderState, setLoaderState] = useState<LoaderState>('loading');
    const [showPlayButton, setShowPlayButton] = useState(false);
    const [isVideoReadyForDisplay, setIsVideoReadyForDisplay] = useState(false);
    const [isBuffering, setIsBuffering] = useState(false);
    
    // Load time tracking for cache verification
    const loadStartTimeRef = useRef<number | null>(null);
    
    // Pending visibility state for proper React synchronization
    const [pendingVisibilityState, setPendingVisibilityState] = useState<MediaCardVisibility | null>(null);
    
    // Animated opacity for smooth crossfade
    const thumbnailOpacity = useRef(new Animated.Value(1)).current;

    const playIdRef = React.useRef<string>('');
    const genPlayId = React.useCallback(() =>
        `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, [item.id]
    );
    const beginAttempt = React.useCallback(() => {
        playIdRef.current = genPlayId();
        metrics.mark('attemptStart', item.id, playIdRef.current);
    }, [genPlayId, item.id]);

    const THRESHOLDS = visibilityConfig || DEFAULT_VISIBILITY_THRESHOLDS;
    
    const now = () => Date.now();

    useEffect(() => {
        const playListener = (videoId: string) => {
            if (videoId === item.id) {
                logger.info('video', `[${item.id}] ⏯️ PLAY event received`);
                playStartTs.current = now();
                metrics.mark('video_play', item.id, playIdRef.current);
                setIsPlayerPlaying(true);
                setShowPlayButton(false);
                logger.info('video', `[${item.id}] ✅ Set isPlayerPlaying=true, paused prop will be: ${false}`);
            }
        };
        const pauseListener = (videoId: string) => {
            if (videoId === item.id) {
                logger.info('video', `[${item.id}] ⏸️ PAUSE event received`);
                metrics.mark('video_pause', item.id, playIdRef.current);
                setIsPlayerPlaying(false);
                logger.info('video', `[${item.id}] ✅ Set isPlayerPlaying=false, paused prop will be: ${true}`);
                // Show play button for low-end devices or manual play
                if (AppConfig.config.performance.isLowEndDevice || !AppConfig.config.performance.autoplayOnLowEnd) {
                    setShowPlayButton(true);
                }
            }
        };

        playbackEvents.on('play', playListener);
        playbackEvents.on('pause', pauseListener);

        return () => {
            //TODO: Report notActive here to remove from the pubsub
            //TODO: Also send willResignActive on video end
            handleVisibilityChange(item.id, item.videoCategory ?? 'default', MediaCardVisibility.notActive);
            playbackEvents.off('play', playListener);
            playbackEvents.off('pause', pauseListener);
        };
    }, [item.id]);

    const lastVisibilityStateRef = useRef<MediaCardVisibility>(MediaCardVisibility.notActive);

    // useLayoutEffect to handle pending visibility state after player attachment
    useLayoutEffect(() => {
        if (pendingVisibilityState && isPlayerAttached) {
            // Player is NOW attached, emit the state
            handleVisibilityChange(item.id, item.videoCategory ?? 'default', pendingVisibilityState, item.videoSource.videoType);
            setDebugText(`${pendingVisibilityState}`);
            lastVisibilityStateRef.current = pendingVisibilityState;
            setPendingVisibilityState(null);
        }
    }, [isPlayerAttached, pendingVisibilityState]);

    const onVisibilityChange = (event: { nativeEvent: VisibilityStateChangeEvent }) => {
        const { uniqueId, direction, visibilityPercentage } = event.nativeEvent;
        const incoming = direction === 'movingIn';
        setLastVisibilityPercentage(visibilityPercentage);

        logger.debug('visibility', `[${item.id}] ${direction} ${visibilityPercentage}%`);

        let newState: MediaCardVisibility | null = null;

        if (incoming) {
            // Determine current state based on visibility percentage
            if (visibilityPercentage >= THRESHOLDS.movingIn.isActive) {
                newState = MediaCardVisibility.isActive;
            } else if (visibilityPercentage >= THRESHOLDS.movingIn.prepareToBeActive) {
                newState = MediaCardVisibility.prepareToBeActive;
            } else if (visibilityPercentage >= THRESHOLDS.movingIn.prefetch) {
                newState = MediaCardVisibility.prefetch;
            }
        } else { // Outgoing
            if (visibilityPercentage <= THRESHOLDS.movingOut.released) {
                newState = MediaCardVisibility.released;
            } else if (visibilityPercentage <= THRESHOLDS.movingOut.notActive) {
                newState = MediaCardVisibility.notActive;
            } else if (visibilityPercentage <= THRESHOLDS.movingOut.willResignActive) {
                newState = MediaCardVisibility.willResignActive;
            }
        }

        // Only emit state change if state actually changed
        if (newState && newState !== lastVisibilityStateRef.current) {
            logger.info('visibility', `[${item.id}] ${lastVisibilityStateRef.current} → ${newState}`);
            
            // ⚠️ CRITICAL: Apply player attachment SYNCHRONOUSLY before emitting state change
            const shouldHavePlayer = (
                newState === MediaCardVisibility.prepareToBeActive || 
                newState === MediaCardVisibility.isActive
            );
            
            const shouldNotHavePlayer = (
                newState === MediaCardVisibility.notActive || 
                newState === MediaCardVisibility.released
            );
            
            if (shouldHavePlayer && !isPlayerAttached) {
                logger.info('video', `[${item.id}] 🔌 Attaching player BEFORE state emission`);
                beginAttempt();
                setIsPlayerAttached(true);
                setPendingVisibilityState(newState); // Queue the state change for useLayoutEffect
                return; // Exit early
            } else if (shouldNotHavePlayer && isPlayerAttached) {
                logger.info('video', `[${item.id}] 🔌 Detaching player BEFORE state emission`);
                setIsPlayerAttached(false);
                setIsVideoReadyForDisplay(false);
                thumbnailOpacity.setValue(1);
                loadStartTimeRef.current = null; // Reset for next play attempt
            }

            // Emit state change to PlaybackManager (player state is now correct)
            handleVisibilityChange(item.id, item.videoCategory ?? 'default', newState, item.videoSource.videoType);
            setDebugText(`${newState}`);
            lastVisibilityStateRef.current = newState;
        }
    };

    // Video event handlers
    const handleError = (error: OnVideoErrorData) => {
        logger.error('video', `[${item.id}] Playback error: ${error.error || 'Unknown error'}`);
        metrics.error('video_error', item.id, playIdRef.current, error);
        console.error('Video playback error', error);
        setLoaderState('error');
    };

    const handleRetry = () => {
        // Force a re-render of the Video component by changing its key
        // TODO: should the load config be rest here or will onLodStart takecare of it
        setRetryKey(prevKey => prevKey + 1);
        setLoaderState('loading');
    };

    const handleManualPlay = () => {
        if (!isPlayerAttached) {
            beginAttempt();
            setIsPlayerAttached(true);
        }
        playbackEvents.emit('play', item.id);
        setShowPlayButton(false);
    };

    const onBuffer = (e: OnBufferData) => {
        // Track buffer events for metrics - no optimization logic
        setIsBuffering(e.isBuffering);
        if (e.isBuffering) {
            metrics.mark('video_buffer_start', item.id, playIdRef.current);
        } else {
            metrics.mark('video_buffer_end', item.id, playIdRef.current);
        }
    };
    
    const onReadyForDisplay = () => {
        const loadTime = loadStartTimeRef.current ? Date.now() - loadStartTimeRef.current : null;
        logger.info('video', `[${item.id}] ✅ Video ready for display (load time: ${loadTime}ms)`);
        metrics.mark('video_ready_for_display', item.id, playIdRef.current);
        setIsVideoReadyForDisplay(true);
        setIsBuffering(false);
        
        // Smooth crossfade from thumbnail to video
        Animated.timing(thumbnailOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };
    
    const onProgress = (e: OnProgressData) => {
        // Progress tracking - uncomment if you need detailed progress metrics
        // metrics.mark('video_progress', item.id, playIdRef.current, { currentTime: e.currentTime, playableDuration: e.playableDuration });
    };
    
    const onEnd = () => {
        metrics.mark('video_ended', item.id, playIdRef.current);
        setIsPlayerPlaying(false);
        setIsPlayerAttached(false);
        setLoaderState('stopped');
    };
    
    const onPlaybackRateChange = (e: OnPlaybackRateChangeData) => {
        metrics.mark('video_playback_rate_change', item.id, playIdRef.current, { playbackRate: e.playbackRate });
    };
    const renderLoader = () => {
        // Use the same renderLoader function, but change the content based on state
        if (loaderState === 'error') {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Video failed to load.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Try again</Text>
                    </TouchableOpacity>
                </View>
            );
        }

        if (loaderState === 'stopped') {
            return (
                <View style={styles.errorContainer}>
                    <Text style={styles.errorText}>Video failed to load.</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                        <Text style={styles.retryButtonText}>Video ended</Text>
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

    return (
        // Spread the rest props (including 'style') to the VisibilityTrackingView
        <VisibilityTrackingView
            {...rest}
            throttleInterval={AppConfig.config.visibility.nativeThrottleMs}
            visibilityConfig={toRawVisibilityConfig(THRESHOLDS)}
            uniqueId={item.id}
            onVisibilityStateChange={onVisibilityChange}>

            {/* Thumbnail ALWAYS visible as background - smooth crossfade using Animated */}
            <Animated.View style={[StyleSheet.absoluteFill, { opacity: thumbnailOpacity }]}>
                <FastImage
                    source={{
                        uri: item.thumbnailUrl,
                        priority: FastImage.priority.high,
                        cache: FastImage.cacheControl.immutable
                    }}
                    style={[styles.media, StyleSheet.absoluteFill]}
                    resizeMode="contain"
                />
            </Animated.View>

            {/* Video player overlays thumbnail when mounted */}
            {isPlayerAttached && (
                <VideoPlayerView
                    source={item.videoSource.url}
                    videoId={item.id}
                    paused={!isPlayerPlaying}
                    muted={true}
                    style={[styles.media, StyleSheet.absoluteFill]}
                    onLoad={(event) => {
                        // Track load start time on first onLoad (emitted when player setup starts)
                        if (!loadStartTimeRef.current) {
                            loadStartTimeRef.current = Date.now();
                            logger.info('video', `[${item.id}] 📥 Load started: ${item.videoSource.url}`);
                            metrics.mark('video_load_started', item.id, playIdRef.current, { videoSource: item.videoSource.url });
                            setLoaderState('loading');
                        }
                        // Also track when fully loaded (duration available)
                        if (event.nativeEvent.duration) {
                            logger.info('video', `[${item.id}] Loaded successfully (duration: ${event.nativeEvent.duration}s)`);
                            metrics.mark('video_loaded', item.id, playIdRef.current, event.nativeEvent);
                            setLoaderState('loaded');
                        }
                    }}
                    onProgress={(event) => {
                        metrics.mark('video_progress', item.id, playIdRef.current, event.nativeEvent);
                    }}
                    onEnd={(event) => {
                        metrics.mark('video_end', item.id, playIdRef.current, event.nativeEvent);
                        setLoaderState('stopped');
                    }}
                    onError={(event) => {
                        metrics.error('video_error', item.id, playIdRef.current, event.nativeEvent.error);
                        setLoaderState('error');
                    }}
                    onBuffer={(event) => {
                        if (event.nativeEvent.isBuffering) {
                            metrics.mark('buffer_start', item.id, playIdRef.current);
                        } else {
                            metrics.mark('buffer_end', item.id, playIdRef.current);
                        }
                    }}
                    onReadyForDisplay={onReadyForDisplay}
                />
            )}

            {/* Loading indicator when player attached but not ready, or when buffering */}
            {isPlayerAttached && (!isVideoReadyForDisplay || isBuffering) && (
                <View style={styles.loaderContainer}>
                    <ActivityIndicator animating={true} size={'large'} color="#fff" />
                </View>
            )}

            {/* Play button for manual play (low-end devices or when paused) */}
            {showPlayButton && (
                <PlayButton 
                    onPress={handleManualPlay}
                    visible={showPlayButton}
                />
            )}

            {/* Debug Info */}
            {geekMode && (
                <>
                    <View style={{ position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: 'white', fontSize: 10 }}>{`${debugText} - ${lastVisibilityPercentage}%`}</Text>
                    </View>
                    <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: 'white', fontSize: 10 }}>{`${debugText} - ${lastVisibilityPercentage}%`}</Text>
                    </View>
                    {playIdRef.current && (<DebugHUD playId={playIdRef.current} key={playIdRef.current} visible />)}
                </>
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


/**
 * function onBuffer(e) {
  if (e.isBuffering) metrics.mark("bufferStart", videoId, playId);
  else metrics.mark("bufferEnd", videoId, playId);
}

function onPlaybackRateChange(e) {
  if (e.playbackRate === 0 && !paused) metrics.mark("bufferStart", videoId, playId);
  if (e.playbackRate > 0) metrics.mark("bufferEnd", videoId, playId);
}

// Optional guard using onProgress
let lastProg = { t: 0, wall: 0 };
function onProgress(e) {
  if (e.currentTime !== lastProg.t) { lastProg = { t: e.currentTime, wall: Date.now() }; return; }
  if (!paused && Date.now() - lastProg.wall > 1500) metrics.mark("bufferStart", videoId, playId);
}

Dumping metrics

const dump = metrics.flush();
const ndjson = dump.map(r => JSON.stringify({ ...r, sessionId: metrics.sessionId })).join("\n");
// write to FileSystem or send
console.log(ndjson);

 */