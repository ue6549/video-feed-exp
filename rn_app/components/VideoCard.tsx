import React, { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, ViewProps, ActivityIndicator, Text, TouchableOpacity } from 'react-native';
import { VisibilityTrackingView, VisibilityStateChangeEvent, RawVisibilityTransitioningConfig } from './native_components/VisibilityTrackingView'; // Import your components
import Video, { OnBufferData, OnLoadData, OnLoadStartData, OnPlaybackRateChangeData, OnProgressData, OnVideoErrorData, ReactVideoProps, SelectedTrackType } from 'react-native-video';
import FastImage from '@d11/react-native-fast-image';
import { playbackEvents, handleVisibilityChange } from '../platback_manager/PlaybackManager';
import { MediaCardVisibility, VisibilityTransitioningConfig } from '../platback_manager/MediaCardVisibility';
import { metrics } from '../instrumentation/VideoMetrics';
import { DebugHUD } from '../instrumentation/DebugHUD';

// Sample interface for your video item data
interface VideoItem {
    id: string;
    videoCategory?: string; // e.g., 'short' or 'carousel'
    videoSource: { url: string };
    thumbnailUrl: string;
    aspectRatio?: string; // e.g., '16:9'
}

const toRawVisibilityConfig = (config: VisibilityTransitioningConfig): RawVisibilityTransitioningConfig => {
    return {
        movingIn: [config.movingIn.prepareToBeActive, config.movingIn.isActive],
        movingOut: [config.movingOut.willResignActive, config.movingOut.notActive],
    };
}

/**
 * ReactVideoProps are a way to customise the behaviour of this video card.
 * Only things additional it is doing right now 
 * 1. Not loading the video player but just making do with and image view if the video is not in view port or area of interest.
 *      Thus saving memory and CPU usage.
 * 2. Is using a FastImage for thumbnail fetching and caching. Leveraging just the Video component props for better UI and loading handling
 */
export interface VideoCardProps extends ViewProps {
    item: VideoItem;
    videoProps?: ReactVideoProps;

    geekMode?: boolean; // Show the debug HUD with metrics
    applyLoadConfigOptimisations?: boolean; // Apply the video load config optimisations

    // Althuogh for the native component this a generic key mapping to number threshold. 
    // For the rest of the consumers on the RN side, setting a standard contract
    visibilityConfig?: VisibilityTransitioningConfig;
}

// Define the visibility thresholds for our custom logic
const DEFAULT_VISIBILITY_THRESHOLDS: VisibilityTransitioningConfig = {
    movingIn: {
        // 10% or more visible (incoming) -> Add video component, paused
        prepareToBeActive: 25,
        // 50% or more visible (incoming) -> Play video
        isActive: 50,
    },
    movingOut: {
        // 30% or less visible (outgoing) -> Pause video
        willResignActive: 90,
        // 0% visible (outgoing) -> Remove video component
        notActive: 20,
    }
};

type LoaderState = 'loading' | 'none' | 'error' | 'stopped';

type VideoLoadOptimsationConfig = {
    mute: boolean;
    selectedAudioTrack: SelectedTrackType;
    autoWaits: boolean; // automaticallyWaitsToMinimizeStalling
    pfb: number; // preferredForwardBufferDuration
    maxBR: number; // maxBitRate
}

enum VideoLoadOptiPhase {
    PREFLIGHT,
    JOIN,
    STABILISE,
    STEADY,
    POOR,
}

const VideoLoadOptiPhaseConfig: Record<VideoLoadOptiPhase, VideoLoadOptimsationConfig> = {
    [VideoLoadOptiPhase.PREFLIGHT]: { mute: true, selectedAudioTrack: SelectedTrackType.DISABLED, autoWaits: false, pfb: 0, maxBR: 0 },
    [VideoLoadOptiPhase.JOIN]: { mute: true, selectedAudioTrack: SelectedTrackType.DISABLED, autoWaits: true, pfb: 0, maxBR: 1000000 },
    [VideoLoadOptiPhase.STABILISE]: { mute: false, selectedAudioTrack: SelectedTrackType.SYSTEM, autoWaits: true, pfb: 2, maxBR: 2500000 },
    [VideoLoadOptiPhase.STEADY]: { mute: false, selectedAudioTrack: SelectedTrackType.SYSTEM, autoWaits: true, pfb: 4, maxBR: 5000000 },
    [VideoLoadOptiPhase.POOR]: { mute: true, selectedAudioTrack: SelectedTrackType.DISABLED, autoWaits: true, pfb: 6, maxBR: 1000000 },
};

const EARLY_WINDOW_MS = 7_000;     // if first stall happens within this after play -> aggressive fallback
const MAX_STALLS_IN_10S = 2;       // threshold to fallback
const MAX_STALL_MS_IN_10S = 1200;  // total stall ms threshold to fallback
const RECOVER_AFTER_STABLE_MS = 6000; // time without stall before step-up
const SWITCH_COOLDOWN_MS = 2500;      // avoid toggling too frequently

const VideoCard: React.FC<VideoCardProps> = ({ item, videoProps, visibilityConfig, geekMode, applyLoadConfigOptimisations, ...rest }) => {
    const phaseRef = useRef<VideoLoadOptiPhase>(applyLoadConfigOptimisations ? VideoLoadOptiPhase.PREFLIGHT : VideoLoadOptiPhase.STEADY);
    const playStartTs = useRef<number | null>(null);

    // Stall tracking (rolling window)
    const stallCount = useRef(0);
    const stallMs = useRef(0);
    let openStallStart: number | null = null;
    const windowEvents: Array<{t:number, dur:number}> = []; // last N stalls
    let lastStallClearedAt = useRef<number>(Date.now());

    // Hysteresis / cooldowns
    const inCooldown = useRef(false);
    const lastPhaseSwitchTs = useRef(0);

    const [debugText, setDebugText] = useState(`${MediaCardVisibility.notActive} - 0%`);
    const [isPlayerAttached, setIsPlayerAttached] = useState(false);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    const [lastVisibilityPercentage, setLastVisibilityPercentage] = useState(0);
    const [retryKey, setRetryKey] = useState<number>(0);
    const [loaderState, setLoaderState] = useState<LoaderState>('loading');

    const playIdRef = React.useRef<string>('');
    const genPlayId = React.useCallback(() =>
        `${item.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, [item.id]
    );
    const beginAttempt = React.useCallback(() => {
        playIdRef.current = genPlayId();
        // optional: record an explicit start
        metrics.mark('attemptStart', item.id, playIdRef.current);
    }, [genPlayId, item.id]);

    const [mute, setMute] = useState(VideoLoadOptiPhaseConfig[phaseRef.current].mute);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<SelectedTrackType>(VideoLoadOptiPhaseConfig[phaseRef.current].selectedAudioTrack);
    const [autoWaits, setAutoWaits] = useState(VideoLoadOptiPhaseConfig[phaseRef.current].autoWaits); // automaticallyWaitsToMinimizeStalling
    const [pfb, setPfb] = useState(VideoLoadOptiPhaseConfig[phaseRef.current].pfb); // preferredForwardBufferDuration
    const [maxBR, setMaxBR] = useState(VideoLoadOptiPhaseConfig[phaseRef.current].maxBR); // maxBitRate

    {/** state for capture metrics, display HUD */}

    const THRESHOLDS = visibilityConfig || DEFAULT_VISIBILITY_THRESHOLDS;
    
    useEffect(() => {
        const playListener = (videoId: string) => {
            if (videoId === item.id) {
                playStartTs.current = now();
                switchPhase(applyLoadConfigOptimisations ? VideoLoadOptiPhase.PREFLIGHT : VideoLoadOptiPhase.STEADY);
                metrics.mark('video_play', item.id, playIdRef.current);
                setIsPlayerPlaying(true);
            }
        };
        const pauseListener = (videoId: string) => {
            if (videoId === item.id) {
                metrics.mark('video_pause', item.id, playIdRef.current);
                setIsPlayerPlaying(false);
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

    const onVisibilityChange = (event: { nativeEvent: VisibilityStateChangeEvent }) => {
        const { uniqueId, direction, visibilityPercentage } = event.nativeEvent;
        const incoming = direction === 'movingIn';
        setLastVisibilityPercentage(visibilityPercentage);

        if (incoming) {
            if (visibilityPercentage >= THRESHOLDS.movingIn.isActive) {
                if (!isPlayerAttached) beginAttempt();
                setIsPlayerAttached(true);
                handleVisibilityChange(item.id, item.videoCategory ?? 'default', MediaCardVisibility.isActive);
                setDebugText(`${MediaCardVisibility.isActive}`);
                // setIsPlayerPlaying(true);
            } else if (visibilityPercentage >= THRESHOLDS.movingIn.prepareToBeActive) {
                if (!isPlayerAttached) beginAttempt();
                setIsPlayerAttached(true);
                handleVisibilityChange(item.id, item.videoCategory ?? 'default', MediaCardVisibility.prepareToBeActive);
                setDebugText(`${MediaCardVisibility.prepareToBeActive}`);
                // setIsPlayerPlaying(false);
            }
        } else { // Outgoing
            if (visibilityPercentage <= THRESHOLDS.movingOut.notActive) {
                setIsPlayerAttached(false);
                handleVisibilityChange(item.id, item.videoCategory ?? 'default', MediaCardVisibility.notActive);
                setDebugText(`${MediaCardVisibility.notActive}`);
                // setIsPlayerPlaying(false);
            } else if (visibilityPercentage <= THRESHOLDS.movingOut.willResignActive) {
                handleVisibilityChange(item.id, item.videoCategory ?? 'default', MediaCardVisibility.willResignActive);
                setDebugText(`${MediaCardVisibility.willResignActive}`);
                // setIsPlayerPlaying(false);
            }
        }
    };

    // Video event handlers
    const handleLoadStart = (data: OnLoadStartData) => {
        metrics.mark('video_load_started', item.id, playIdRef.current, { videoSource: item.videoSource.url });
        // Only show the loading state if a player is attached
        if (isPlayerAttached) {
            setLoaderState('loading');
        }
    };

    const handleLoad = (data: OnLoadData) => {
        metrics.mark('video_loaded', item.id, playIdRef.current, { duration: data.duration, naturalSize: data.naturalSize });
        setLoaderState('none');
    };

    const handleError = (error: OnVideoErrorData) => {
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

    const onReadyForDisplay = () => {
        metrics.mark('video_ready_for_display', item.id, playIdRef.current);
    };

    const onBuffer = (e: OnBufferData) => {
        if (e.isBuffering) {
            metrics.mark('video_buffer_start', item.id, playIdRef.current);
            if (applyLoadConfigOptimisations) {
                openStallStart = now();
                // Early aggressive fallback: first stall right after join
                if (playStartTs.current && (now() - playStartTs.current) <= EARLY_WINDOW_MS) {
                    switchPhase(VideoLoadOptiPhase.POOR);
                }
            }
        } else {
            if (applyLoadConfigOptimisations && openStallStart != null) {
                const dur = now() - openStallStart;
                addStall(dur);
                metrics.mark('video_buffer_end', item.id, playIdRef.current, { dur });
                openStallStart = null;

                // Threshold-based fallback (rolling 10s window)
                if (stallCount.current >= MAX_STALLS_IN_10S || stallMs.current >= MAX_STALL_MS_IN_10S) {
                    switchPhase(VideoLoadOptiPhase.POOR);
                }
            } else {
                metrics.mark('video_buffer_end', item.id, playIdRef.current);
            }
        }
    };
    
    const onProgress = (e: OnProgressData) => {
        // metrics.mark('video_progress', item.id, playIdRef.current, { currentTime: e.currentTime, playableDuration: e.playableDuration });

        // track when the last stall ended
        if (openStallStart == null) {
            lastStallClearedAt.current = now();
        }

        // Your existing phase timing by currentTime:
        if (applyLoadConfigOptimisations) {
            if (e.currentTime < 3) switchPhase(VideoLoadOptiPhase.JOIN);
            else if (e.currentTime < 10) switchPhase(VideoLoadOptiPhase.STABILISE);
            else switchPhase(VideoLoadOptiPhase.STEADY);
        }

        // If we're in FALLBACK and things have been smooth, step up
        if (applyLoadConfigOptimisations && phaseRef.current === VideoLoadOptiPhase.POOR &&
            (now() - lastStallClearedAt.current) > RECOVER_AFTER_STABLE_MS) {
            // Step up gradually: FALLBACK -> STABILISE -> STEADY (don’t jump straight to STEADY)
            switchPhase(VideoLoadOptiPhase.STABILISE);
            resetStallWindow();
        }
    };
    
    const onEnd = () => {
        metrics.mark('video_ended', item.id, playIdRef.current);
        setIsPlayerPlaying(false);
        // Optionally reset the video to start
        // setRetryKey(prevKey => prevKey + 1); // This will reload the video
        setIsPlayerAttached(false); // This will unload the video component
        setLoaderState('stopped')
    };
    
    const onPlaybackRateChange = (e: OnPlaybackRateChangeData) => {
        metrics.mark('video_playback_rate_change', item.id, playIdRef.current, { playbackRate: e.playbackRate });
        if (!applyLoadConfigOptimisations) return;
        // You can use playbackRate to infer play/pause state if needed
        if (e.playbackRate === 0 && !openStallStart) {
            openStallStart = now();
        }
        if (e.playbackRate > 0 && openStallStart) {
            const dur = now() - openStallStart;
            addStall(dur);
            openStallStart = null;
            if (stallCount.current >= MAX_STALLS_IN_10S || stallMs.current >= MAX_STALL_MS_IN_10S) {
                switchPhase(VideoLoadOptiPhase.POOR);
            }
        }
    };

    const now = () => Date.now();

    const applyVideoLoadConfigProfile = (p: VideoLoadOptiPhase) => {
        const cfg = VideoLoadOptiPhaseConfig[p];
        setMute(cfg.mute);
        setSelectedAudioTrack(cfg.selectedAudioTrack);
        setAutoWaits(cfg.autoWaits);
        setPfb(cfg.pfb);
        setMaxBR(cfg.maxBR);
        setDebugText(`${p} - ${lastVisibilityPercentage}%`);
    }

    function switchPhase(target: VideoLoadOptiPhase) {
        const t = now();
        if (inCooldown.current || t - lastPhaseSwitchTs.current < SWITCH_COOLDOWN_MS) return;
        if (phaseRef.current === target) return;
        phaseRef.current = target;
        lastPhaseSwitchTs.current = t;
        inCooldown.current = true;
        applyVideoLoadConfigProfile(target);
        setTimeout(() => { inCooldown.current = false; }, SWITCH_COOLDOWN_MS);
    }

    function resetStallWindow() {
        stallCount.current = 0;
        stallMs.current = 0;
        windowEvents.length = 0;
    }

    function addStall(durMs: number) {
        const t = now();
        windowEvents.push({ t, dur: durMs });
        // drop anything older than 10s
        while (windowEvents.length && (t - windowEvents[0].t) > 10_000) windowEvents.shift();
        stallCount.current = windowEvents.length;
        stallMs.current = windowEvents.reduce((a, b) => a + b.dur, 0);
    }
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
            throttleInterval={50}
            visibilityConfig={toRawVisibilityConfig(THRESHOLDS)}
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
                    style={[styles.media, StyleSheet.absoluteFill]}
                    resizeMode="contain"
                />
            )}
            {isPlayerAttached && (
                <Video
                    {...videoProps}
                    key={item.id + retryKey}
                    source={{ uri: item.videoSource.url }}
                    style={styles.media}
                    controls={false}
                    muted={mute}
                    volume={0}
                    selectedAudioTrack={{ type: SelectedTrackType.SYSTEM }}
                    automaticallyWaitsToMinimizeStalling={true}
                    preferredForwardBufferDuration={0}
                    maxBitRate={1000000}
                    onError={handleError}
                    onLoadStart={handleLoadStart}
                    onLoad={handleLoad}
                    onReadyForDisplay={onReadyForDisplay}
                    onBuffer={onBuffer}
                    onProgress={onProgress}
                    onEnd={onEnd}
                    onPlaybackRateChange={onPlaybackRateChange}
                    // onPlaybackStateChanged={() => {}}
                    paused={!isPlayerPlaying}
                    repeat={false}   // Take this from props if needed, repeat in full page feed but not in main feed
                    resizeMode="contain"
                    renderLoader={renderLoader}
                    progressUpdateInterval={250}
                    playInBackground={false}
                />
            )}
            {/* Debug Info */}
            <View style={{ position: 'absolute', top: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontSize: 10 }}>{`${debugText} - ${lastVisibilityPercentage}%`}</Text>
            </View>
            <View style={{ position: 'absolute', bottom: 5, left: 5, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ color: 'white', fontSize: 10 }}>{`${debugText} - ${lastVisibilityPercentage}%`}</Text>
            </View>
            { geekMode && playIdRef.current && (<DebugHUD playId={playIdRef.current} key={playIdRef.current} visible />)}
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