// Enhanced PlaybackManager with VOD/LIVE handling, low-end support, and sequencing
import {EventEmitter} from 'eventemitter3';
import {MediaCardVisibility} from './MediaCardVisibility';
import {AppConfig} from '../config/AppConfig';
import {WidgetType} from '../types';
import {logger} from '../utilities/Logger';

export const playbackEvents = new EventEmitter();
export type PlaybackEvent = 'play' | 'pause' | 'prefetch' | 'sequence';
export type PlayItemType = WidgetType;

// Widget priority system - higher number = higher priority
const WIDGET_PRIORITY = {
  short: 3,
  carousel: 2,
  merch: 1,
  default: 0,
} as const;

// type PlayItemType = 'short' | 'ad' | 'carousel' | 'merch';
// type MediaCardVisibility = 'prepareToActive' | 'Active' | 'willResignActive' | 'notActive';

interface VideoState {
  id: string;
  type: 'VOD' | 'LIVE';
  category: WidgetType;
  visibilityState: MediaCardVisibility;
  isPlaying: boolean;
  isPrefetched: boolean;
  manualPlayOverride?: boolean; // NEW: Ignore preview duration if user manually played
  previewStartTime?: number;
  previewTimer?: NodeJS.Timeout; // DEPRECATED: Will be removed with progress-based approach
  shouldSeekToBeginning?: boolean; // NEW: Flag to seek to beginning on next play
}

interface SoftPlayVideo {
  id: string;
  category: WidgetType;
  priority: number;
}

const videoMap: Map<string, VideoState> = new Map();
const previewTimers = new Map<string, NodeJS.Timeout>();
const softPlayQueue: SoftPlayVideo[] = [];

// Track currently playing widget type for single widget enforcement
let currentlyPlayingWidgetType: WidgetType | null = null;
const playQueue: VideoState[] = [];

function playVideo(videoId: string, videoState: VideoState): void {
  logger.info('playback', `▶️ PLAY: ${videoId}`);
  videoState.isPlaying = true;
  currentlyPlayingWidgetType = videoState.category;
  playbackEvents.emit('play', videoId);
  logger.info('playback', `📢 Play event emitted for: ${videoId}`);

  // Remove from queue if it was queued
  removeFromPlayQueue(videoId);

  // Start preview timer for VOD content if sequencing is enabled
  if (
    AppConfig.config.playback.sequencingEnabled &&
    videoState.type === 'VOD' &&
    AppConfig.config.playback.rotateToSoftPlay
  ) {
    startPreviewTimer(videoId, videoState);
  }
}

function pauseVideo(videoId: string, videoState: VideoState): void {
  logger.info('playback', `⏸️ PAUSE: ${videoId}`);
  videoState.isPlaying = false;
  
  // Check if this was the last video of this widget type playing
  const remainingVideosOfSameType = Array.from(videoMap.values()).filter(
    v => v.category === videoState.category && v.isPlaying
  );
  
  if (remainingVideosOfSameType.length === 0) {
    // No more videos of this widget type playing
    currentlyPlayingWidgetType = null;
  }
  
  playbackEvents.emit('pause', videoId);
  logger.info('playback', `📢 Pause event emitted for: ${videoId}`);

  // Clear preview timer
  clearPreviewTimer(videoId);
}

export function handleVisibilityChange(
  videoId: string,
  videoType: PlayItemType,
  mediaVisibilityState: MediaCardVisibility,
  videoSourceType: 'VOD' | 'LIVE' = 'VOD',
) {
  // Update video state
  const videoState = videoMap.get(videoId) || {
    id: videoId,
    type: videoSourceType,
    category: videoType,
    visibilityState: mediaVisibilityState,
    isPlaying: false,
    isPrefetched: false,
  };

  videoState.visibilityState = mediaVisibilityState;
  videoMap.set(videoId, videoState);

  // Handle different visibility states
  switch (mediaVisibilityState) {
    case MediaCardVisibility.prefetch:
      handlePrefetch(videoId, videoState);
      break;
    case MediaCardVisibility.prepareToBeActive:
      handlePrepareToBeActive(videoId, videoState);
      break;
    case MediaCardVisibility.isActive:
      handleActive(videoId, videoState);
      break;
    case MediaCardVisibility.willResignActive:
      handleWillResignActive(videoId, videoState);
      break;
    case MediaCardVisibility.notActive:
      handleNotActive(videoId, videoState);
      break;
    case MediaCardVisibility.released:
      handleReleased(videoId, videoState);
      break;
  }
}

// Enhanced handler functions
function handlePrefetch(videoId: string, videoState: VideoState): void {
  logger.info('playback', `${videoId} → prefetch (type: ${videoState.type})`);
  videoState.visibilityState = MediaCardVisibility.prefetch;
  // No-op - prefetch will be handled by FeedScreen (future work)
}

function handlePrepareToBeActive(
  videoId: string,
  videoState: VideoState,
): void {
  logger.info('playback', `${videoId} → prepareToBeActive`);
  videoState.visibilityState = MediaCardVisibility.prepareToBeActive;

  // Add to soft play queue
  addToSoftPlayQueue(videoId, videoState.category);
}

function handleActive(videoId: string, videoState: VideoState): void {
  logger.info('playback', `${videoId} → isActive (type: ${videoState.type})`);

  // Reset preview state as fallback to ensure video can replay
  resetPreviewState(videoId);

  const isLowEndDevice = AppConfig.config.performance.isLowEndDevice;
  logger.info('playback', `  isLowEndDevice: ${isLowEndDevice}`);

  if (isLowEndDevice) {
    logger.info('playback', '  → Calling handleLowEndDeviceActive()');
    handleLowEndDeviceActive(videoId, videoState);
  } else {
    logger.info('playback', '  → Calling handleNormalDeviceActive()');
    handleNormalDeviceActive(videoId, videoState);
  }
}

function handleLowEndDeviceActive(
  videoId: string,
  videoState: VideoState,
): void {
  // On low-end devices, check autoplay setting
  const autoplayEnabled = AppConfig.config.performance.autoplayOnLowEnd;

  if (!autoplayEnabled) {
    // Don't autoplay on low-end devices unless user manually starts
    logger.info('playback', `${videoId} autoplay disabled on low-end device`);
    return;
  }

  // Only play one video at a time
  if (getPlayingCount() === 0) {
    playVideo(videoId, videoState);
  } else {
    // Add to soft play queue for later
    addToSoftPlayQueue(videoId, videoState.category);
  }
}

function handleNormalDeviceActive(
  videoId: string,
  videoState: VideoState,
): void {
  // Check if we can play this video based on priority rules
  const canPlay = canStartPlaying(videoId, videoState);
  logger.info('playback', `  canStartPlaying(${videoId}, ${videoState.category}): ${canPlay}`);

  if (canPlay) {
    logger.info('playback', `  ✅ Calling playVideo(${videoId})`);
    playVideo(videoId, videoState);
  } else {
    logger.info('playback', `  ⏳ Adding to play queue: ${videoId}`);
    addToPlayQueue(videoId, videoState);
  }
}

function handleWillResignActive(videoId: string, videoState: VideoState): void {
  logger.info('playback', `${videoId} → willResignActive`);

  if (videoState.isPlaying) {
    pauseVideo(videoId, videoState);
  }

  // Remove from play queue and try to play next
  removeFromPlayQueue(videoId);
  playNextInQueue();
}

function handleNotActive(videoId: string, videoState: VideoState): void {
  logger.info('playback', `${videoId} → notActive`);

  if (videoState.isPlaying) {
    pauseVideo(videoId, videoState);
  }

  // Reset preview state to allow replay when video cycles back
  resetPreviewState(videoId);

  // Clear preview timer
  clearPreviewTimer(videoId);

  // Remove from play queue
  removeFromPlayQueue(videoId);

  // Remove from active videos
  videoMap.delete(videoId);

  // Remove from soft play queue
  removeFromSoftPlayQueue(videoId);

  // Try to activate waiting videos
  tryToActivateWaiting();
}

function handleReleased(videoId: string, videoState: VideoState): void {
  // Full cleanup - cancel prefetch, clear timers, remove from maps
  logger.info('playback', `${videoId} → released`);

  // Prefetch cleanup removed - will be handled by FeedScreen in future

  // Reset preview state to allow replay when video cycles back
  resetPreviewState(videoId);

  // Clear preview timer if active
  clearPreviewTimer(videoId);

  // Remove from play queue
  removeFromPlayQueue(videoId);

  // Remove from soft play queue
  removeFromSoftPlayQueue(videoId);

  // Remove from video map
  videoMap.delete(videoId);
}

function getCurrentPlayingType(): PlayItemType | null {
  for (let v of videoMap.values()) {
    if (v.isPlaying) {
      return v.category;
    }
  }
  return null;
}

// Old attemptToPlay function removed - using newer implementation with proper VideoState structure

// /**
//  * PlaybackManager class to manage video playback based on visibility and priority.
//  *
//  * Combination of Media types that can play together
//  * 1. Short videos can not play with Carousels
//  * 2. Only one Short video can play at a time
//  * 3. Multiple viedos in a carousel can play at a time, upto 3
//  * 4. Ad = Short = Carousel in terms of priority and only 1 of them can play at a time. All > Merch.
//  * 5. If there is less then 3 videos playing on screen, one of the Merch video can play along with them.
//  */
// class PlaybackManager {
//     private mediaSourceToVisbility: Map<string, MediaCardVisibility> = new Map();
//     private mediaSourceToType: Map<string, PlayItemType> = new Map();
//     private maxConcurrentPlayingVideos: number = 3;
//     private maxConcurrentShortVideos: number = 1;
//     private maxConcurrentCarouselVideos: number = 3;
//     private maxConcurrentMerchVideos: number = 1;
//     private maxConcurrentAdVideos: number = 1;

//     private currentPlayingShortVideos: Set<string> = new Set();
//     private currentPlayingCarouselVideos: Set<string> = new Set();
//     private currentPlayingMerchVideos: Set<string> = new Set();
//     private currentPlayingAdVideos: Set<string> = new Set();

//     private currentPlayingVideos: () => Set<string> = () => {
//         const all = new Set<string>();
//         this.currentPlayingShortVideos.forEach(v => all.add(v));
//         this.currentPlayingCarouselVideos.forEach(v => all.add(v));
//         this.currentPlayingMerchVideos.forEach(v => all.add(v));
//         this.currentPlayingAdVideos.forEach(v => all.add(v));
//         return all;
//     }

//     handleVisibilityChange(videoId: string, videoType: PlayItemType, mediaVisibilityState: MediaCardVisibility) {
//         const isHardAsk = mediaVisibilityState === MediaCardVisibility.isActive;
//         const isSoftAsk = mediaVisibilityState === MediaCardVisibility.prepareToBeActive;

//         if (mediaVisibilityState === MediaCardVisibility.notActive) {
//             this.mediaSourceToVisbility.delete(videoId);
//             this.mediaSourceToType.delete(videoId);
//         }
//         else if (mediaVisibilityState === MediaCardVisibility.prepareToBeActive
//             || mediaVisibilityState === MediaCardVisibility.isActive
//             || mediaVisibilityState === MediaCardVisibility.willResignActive) {

//             this.mediaSourceToVisbility.set(videoId, mediaVisibilityState);
//             this.mediaSourceToType.set(videoId, videoType);

//             if (mediaVisibilityState === MediaCardVisibility.prepareToBeActive) {
//                 if (this.currentPlayingVideos().size == 0) {
//                     // Play any video, add to approapriate set
//                 }
//             } else if (mediaVisibilityState === MediaCardVisibility.isActive) {
//                 if (this.currentPlayingVideos().size == 0) {
//                     // Play any video, add to approapriate set
//                 }
//                 if (videoType === 'short'
//                     && this.currentPlayingShortVideos.size < this.maxConcurrentShortVideos
//                     && this.currentPlayingCarouselVideos.size === 0) {

//                 }
//                 if (videoType === 'merch' && this.currentPlayingVideos().size < this.maxConcurrentPlayingVideos) {
//                     // Play if there is space
//                 }
//             }
//         }
//     }
// }

// Helper functions for enhanced playback management

// Prefetch removed - will be handled by FeedScreen in future

function startPreviewTimer(videoId: string, videoState: VideoState): void {
  const previewDuration = AppConfig.config.playback.previewDuration * 1000;

  const timer = setTimeout(() => {
    onPreviewEnd(videoId, videoState);
  }, previewDuration);

  previewTimers.set(videoId, timer);
  videoState.previewStartTime = Date.now();
}

function clearPreviewTimer(videoId: string): void {
  const timer = previewTimers.get(videoId);
  if (timer) {
    clearTimeout(timer);
    previewTimers.delete(videoId);
  }
}

function onPreviewEnd(videoId: string, videoState: VideoState): void {
  clearPreviewTimer(videoId);

  // Find next soft play video
  const nextVideo = findNextSoftPlayVideo(videoState.category);

  if (nextVideo) {
    // Pause current video
    pauseVideo(videoId, videoState);

    // Play next video
    const nextVideoState = videoMap.get(nextVideo.id);
    if (nextVideoState) {
      playVideo(nextVideo.id, nextVideoState);
      playbackEvents.emit('sequence', {from: videoId, to: nextVideo.id});
    }
  }
}

function addToSoftPlayQueue(videoId: string, category: WidgetType): void {
  // Remove if already in queue
  removeFromSoftPlayQueue(videoId);

  // Add with priority
  const priority = getCategoryPriority(category);
  softPlayQueue.push({id: videoId, category, priority});

  // Sort by priority (higher priority first)
  softPlayQueue.sort((a, b) => b.priority - a.priority);
}

function removeFromSoftPlayQueue(videoId: string): void {
  const index = softPlayQueue.findIndex(video => video.id === videoId);
  if (index !== -1) {
    softPlayQueue.splice(index, 1);
  }
}

function findNextSoftPlayVideo(
  currentCategory: WidgetType,
): SoftPlayVideo | null {
  // Look for videos in soft play queue that can play
  for (const video of softPlayQueue) {
    const videoState = videoMap.get(video.id);
    if (
      videoState &&
      videoState.visibilityState === MediaCardVisibility.prepareToBeActive
    ) {
      return video;
    }
  }

  return null;
}

function tryToActivateWaiting(): void {
  // Look for videos that should be playing but aren't
  for (const [videoId, videoState] of videoMap) {
    if (
      videoState.visibilityState === MediaCardVisibility.isActive &&
      !videoState.isPlaying
    ) {
      if (canPlayVideo(videoState.category)) {
        playVideo(videoId, videoState);
      }
    }
  }
}

function canPlayVideo(category: WidgetType): boolean {
  const maxConcurrent =
    AppConfig.config.widgets[category]?.maxConcurrentVideos || 1;
  const currentPlaying = getPlayingCountForCategory(category);

  return currentPlaying < maxConcurrent;
}

function tryToMakeRoom(targetCategory: WidgetType): boolean {
  // For now, simple implementation - pause one video of lower priority
  const targetPriority = getCategoryPriority(targetCategory);

  for (const [videoId, videoState] of videoMap) {
    if (videoState.isPlaying) {
      const currentPriority = getCategoryPriority(videoState.category);
      if (currentPriority < targetPriority) {
        pauseVideo(videoId, videoState);
        return true;
      }
    }
  }

  return false;
}

function getCategoryPriority(category: WidgetType): number {
  const priorities = AppConfig.config.prefetch.priorities;
  return priorities.indexOf(category);
}

function getPlayingCountForCategory(category: WidgetType): number {
  let count = 0;
  for (const videoState of videoMap.values()) {
    if (videoState.isPlaying && videoState.category === category) {
      count++;
    }
  }
  return count;
}

function getPlayingCount(): number {
  let count = 0;
  for (const videoState of videoMap.values()) {
    if (videoState.isPlaying) {
      count++;
    }
  }
  return count;
}

// getVideoUrl removed - PlaybackManager doesn't need URLs

// Export utility functions
export function getPlaybackStats(): {
  activeVideos: number;
  playingVideos: number;
  softPlayQueue: number;
  previewTimers: number;
} {
  return {
    activeVideos: videoMap.size,
    playingVideos: getPlayingCount(),
    softPlayQueue: softPlayQueue.length,
    previewTimers: previewTimers.size,
  };
}

/**
 * Check if a video can start playing based on widget priority rules
 */
function canStartPlaying(videoId: string, videoState: VideoState): boolean {
  if (!currentlyPlayingWidgetType) return true;
  
  // If same widget type, allow playing (multiple videos within same widget can play)
  if (videoState.category === currentlyPlayingWidgetType) {
    return true;
  }
  
  // Different widget type - check if we have any videos currently playing
  const currentlyPlayingVideos = Array.from(videoMap.values()).filter(v => v.isPlaying);
  if (currentlyPlayingVideos.length === 0) {
    return true;
  }
  
  const requestPriority = WIDGET_PRIORITY[videoState.category];
  const currentPriority = WIDGET_PRIORITY[currentlyPlayingWidgetType];
  
  if (requestPriority > currentPriority) {
    // Higher priority widget can take over - pause ALL currently playing videos
    logger.info('playback', `🔄 Higher priority widget ${videoState.category} (${requestPriority}) taking over from ${currentlyPlayingWidgetType} (${currentPriority})`);
    
    // Pause ALL currently playing videos (not just same widget type)
    for (const [id, state] of videoMap) {
      if (state.isPlaying) {
        pauseVideo(id, state);
      }
    }
    
    return true;
  }
  
  // Lower/same priority must wait
  logger.info('playback', `⏳ Widget ${videoState.category} (${requestPriority}) must wait for ${currentlyPlayingWidgetType} (${currentPriority}) to finish`);
  return false;
}

/**
 * Get the currently playing video state (internal)
 */
function getCurrentlyPlayingVideoInternal(): VideoState | null {
  if (!currentlyPlayingWidgetType) return null;
  
  // Find any playing video of the currently active widget type
  for (const videoState of videoMap.values()) {
    if (videoState.category === currentlyPlayingWidgetType && videoState.isPlaying) {
      return videoState;
    }
  }
  
  return null;
}

/**
 * Add a video to the play queue if it can't play immediately
 */
function addToPlayQueue(videoId: string, videoState: VideoState): void {
  // Remove if already in queue
  const existingIndex = playQueue.findIndex(v => v.id === videoId);
  if (existingIndex !== -1) {
    playQueue.splice(existingIndex, 1);
  }
  
  // Add to queue and sort by priority
  playQueue.push(videoState);
  playQueue.sort((a, b) => WIDGET_PRIORITY[b.category] - WIDGET_PRIORITY[a.category]);
  
  logger.info('playback', `📋 Added ${videoId} (${videoState.category}) to play queue. Queue length: ${playQueue.length}`);
}

/**
 * Remove a video from the play queue
 */
function removeFromPlayQueue(videoId: string): void {
  const index = playQueue.findIndex(v => v.id === videoId);
  if (index !== -1) {
    playQueue.splice(index, 1);
    logger.info('playback', `📋 Removed ${videoId} from play queue. Queue length: ${playQueue.length}`);
  }
}

/**
 * Play the next video in the queue
 */
function playNextInQueue(): void {
  if (playQueue.length === 0) return;
  
  // Find the highest priority eligible video
  for (let i = 0; i < playQueue.length; i++) {
    const videoState = playQueue[i];
    const currentVideo = videoMap.get(videoState.id);
    
    if (!currentVideo) {
      playQueue.splice(i, 1);
      i--; // Adjust index after removal
      continue;
    }
    
    // Check if video is still eligible to play (exclude willResignActive as it's going out of view)
    if (currentVideo.visibilityState === MediaCardVisibility.prepareToBeActive ||
        currentVideo.visibilityState === MediaCardVisibility.isActive) {
      
      // Remove from queue and start playing
      playQueue.splice(i, 1);
      playVideo(currentVideo.id, currentVideo);
      logger.info('playback', `▶️ Playing next in queue: ${currentVideo.id} (${currentVideo.category})`);
      return;
    }
  }
  
  logger.info('playback', `📋 No eligible videos in queue to play next`);
}

/**
 * Handle video progress to check preview duration
 */
export function handleVideoProgress(videoId: string, currentTime: number, duration: number): void {
  const videoState = videoMap.get(videoId);
  if (!videoState || !videoState.isPlaying) return;
  
  // Check if manual play override is set
  if (videoState.manualPlayOverride) return;
  
  const previewDuration = AppConfig.config.playback.widgetPreviewDurations[videoState.category] 
    || AppConfig.config.playback.previewDuration;
  
  if (previewDuration > 0 && currentTime >= previewDuration) {
    // Preview duration reached
    logger.info('playback', `⏱️ Preview duration (${previewDuration}s) reached for ${videoId}`);
    
    // Reset video position to 0 so it plays from beginning when user taps
    logger.info('playback', `🔍 Resetting video position to 0 for ${videoId}`);
    videoState.shouldSeekToBeginning = true;
    
    pauseVideo(videoId, videoState);
    playNextInQueue();
  }
}

/**
 * Set manual play override for a video (ignores preview duration)
 */
export function setManualPlayOverride(videoId: string, override: boolean): void {
  const videoState = videoMap.get(videoId);
  if (videoState) {
    videoState.manualPlayOverride = override;
    logger.info('playback', `🎮 Manual play override ${override ? 'enabled' : 'disabled'} for ${videoId}`);
  }
}

/**
 * Check if video should seek to beginning and clear the flag
 */
export function shouldSeekToBeginning(videoId: string): boolean {
  const videoState = videoMap.get(videoId);
  if (videoState && videoState.shouldSeekToBeginning) {
    videoState.shouldSeekToBeginning = false; // Clear the flag
    logger.info('playback', `🔍 Video ${videoId} should seek to beginning`);
    return true;
  }
  return false;
}

/**
 * Reset preview duration state for a video (allows replay after visibility cycle)
 */
function resetPreviewState(videoId: string): void {
  const videoState = videoMap.get(videoId);
  if (videoState) {
    videoState.manualPlayOverride = false;
    videoState.previewStartTime = undefined;
    logger.info('playback', `🔄 Reset preview state for ${videoId}`);
  }
}

export function clearAllPlayback(): void {
  // Pause all playing videos
  for (const [videoId, videoState] of videoMap) {
    if (videoState.isPlaying) {
      pauseVideo(videoId, videoState);
    }
  }

  // Clear all timers
  for (const timer of previewTimers.values()) {
    clearTimeout(timer);
  }

  // Clear all state
  videoMap.clear();
  previewTimers.clear();
  softPlayQueue.length = 0;
  playQueue.length = 0;
  currentlyPlayingWidgetType = null;
}

// ===== PLAYBACK STATUS APIs =====

/**
 * Get the currently playing widget type
 */
export function getCurrentlyPlayingWidgetType(): WidgetType | null {
  return currentlyPlayingWidgetType;
}

/**
 * Check if a specific video is playing
 */
export function isVideoPlaying(videoId: string): boolean {
  const videoState = videoMap.get(videoId);
  return videoState ? videoState.isPlaying : false;
}

/**
 * Get all currently playing videos (should be 0 or 1 with new system)
 */
export function getPlayingWidgets(): VideoState[] {
  const playingVideos: VideoState[] = [];
  for (const videoState of videoMap.values()) {
    if (videoState.isPlaying) {
      playingVideos.push(videoState);
    }
  }
  return playingVideos;
}

/**
 * Get all videos in the play queue
 */
export function getQueuedVideos(): VideoState[] {
  return [...playQueue];
}

/**
 * Get playback status summary
 */
export function getPlaybackStatus(): {
  currentlyPlayingWidgetType: WidgetType | null;
  playingVideos: VideoState[];
  queuedVideos: VideoState[];
  queueLength: number;
} {
  return {
    currentlyPlayingWidgetType: getCurrentlyPlayingWidgetType(),
    playingVideos: getPlayingWidgets(),
    queuedVideos: getQueuedVideos(),
    queueLength: playQueue.length,
  };
}
