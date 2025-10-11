import { EventEmitter } from 'eventemitter3';
import { AppConfig } from '../config/AppConfig';
import { WidgetType } from '../types';
import { MediaCardVisibility } from '../platback_manager/MediaCardVisibility';
import PrefetchManager from './PrefetchManager';

export const playbackEvents = new EventEmitter();
export type PlaybackEvent = 'play' | 'pause' | 'prefetch' | 'sequence';

interface VideoState {
  id: string;
  type: 'VOD' | 'LIVE';
  category: WidgetType;
  visibilityState: MediaCardVisibility;
  isPlaying: boolean;
  isPrefetched: boolean;
  previewStartTime?: number;
  previewTimer?: NodeJS.Timeout;
}

interface SoftPlayVideo {
  id: string;
  category: WidgetType;
  priority: number;
}

class EnhancedPlaybackManager {
  private activeVideos = new Map<string, VideoState>();
  private previewTimers = new Map<string, NodeJS.Timeout>();
  private softPlayQueue: SoftPlayVideo[] = [];
  private isLowEndDevice: boolean;

  constructor() {
    this.isLowEndDevice = AppConfig.config.performance.isLowEndDevice;
    
    // Subscribe to config changes
    AppConfig.subscribe((config) => {
      this.isLowEndDevice = config.performance.isLowEndDevice;
    });
  }

  /**
   * Handle visibility change for a video
   */
  handleVisibilityChange(
    videoId: string,
    videoType: 'VOD' | 'LIVE',
    state: MediaCardVisibility,
    category: WidgetType
  ): void {
    // Update video state
    const videoState = this.activeVideos.get(videoId) || {
      id: videoId,
      type: videoType,
      category,
      visibilityState: state,
      isPlaying: false,
      isPrefetched: false,
    };

    videoState.visibilityState = state;
    this.activeVideos.set(videoId, videoState);

    // Handle different visibility states
    switch (state) {
      case MediaCardVisibility.prepareToBeActive:
        this.handlePrepareToBeActive(videoId, videoState);
        break;
      case MediaCardVisibility.isActive:
        this.handleActive(videoId, videoState);
        break;
      case MediaCardVisibility.willResignActive:
        this.handleWillResignActive(videoId, videoState);
        break;
      case MediaCardVisibility.notActive:
        this.handleNotActive(videoId, videoState);
        break;
    }
  }

  /**
   * Handle prepare to be active state
   */
  private handlePrepareToBeActive(videoId: string, videoState: VideoState): void {
    // Prefetch VOD content only
    if (videoState.type === 'VOD' && !videoState.isPrefetched) {
      this.prefetchVideo(videoId, videoState);
    }

    // Add to soft play queue
    this.addToSoftPlayQueue(videoId, videoState.category);
  }

  /**
   * Handle active state
   */
  private handleActive(videoId: string, videoState: VideoState): void {
    if (this.isLowEndDevice) {
      this.handleLowEndDeviceActive(videoId, videoState);
    } else {
      this.handleNormalDeviceActive(videoId, videoState);
    }
  }

  /**
   * Handle low-end device active state
   */
  private handleLowEndDeviceActive(videoId: string, videoState: VideoState): void {
    // On low-end devices, only play one video at a time
    if (this.getPlayingCount() === 0) {
      this.playVideo(videoId, videoState);
    } else {
      // Add to soft play queue for later
      this.addToSoftPlayQueue(videoId, videoState.category);
    }
  }

  /**
   * Handle normal device active state
   */
  private handleNormalDeviceActive(videoId: string, videoState: VideoState): void {
    // Check if we can play this video based on category limits
    const canPlay = this.canPlayVideo(videoState.category);
    
    if (canPlay) {
      this.playVideo(videoId, videoState);
    } else {
      // Try to make room by pausing lower priority videos
      if (this.tryToMakeRoom(videoState.category)) {
        this.playVideo(videoId, videoState);
      } else {
        this.addToSoftPlayQueue(videoId, videoState.category);
      }
    }
  }

  /**
   * Handle will resign active state
   */
  private handleWillResignActive(videoId: string, videoState: VideoState): void {
    if (videoState.isPlaying) {
      this.pauseVideo(videoId, videoState);
    }
    
    // Try to activate waiting videos
    this.tryToActivateWaiting();
  }

  /**
   * Handle not active state
   */
  private handleNotActive(videoId: string, videoState: VideoState): void {
    if (videoState.isPlaying) {
      this.pauseVideo(videoId, videoState);
    }
    
    // Clear preview timer
    this.clearPreviewTimer(videoId);
    
    // Remove from active videos
    this.activeVideos.delete(videoId);
    
    // Remove from soft play queue
    this.removeFromSoftPlayQueue(videoId);
    
    // Try to activate waiting videos
    this.tryToActivateWaiting();
  }

  /**
   * Play a video
   */
  private playVideo(videoId: string, videoState: VideoState): void {
    videoState.isPlaying = true;
    playbackEvents.emit('play', videoId);
    
    // Start preview timer for VOD content if sequencing is enabled
    if (AppConfig.config.playback.sequencingEnabled && 
        videoState.type === 'VOD' && 
        AppConfig.config.playback.rotateToSoftPlay) {
      this.startPreviewTimer(videoId, videoState);
    }
  }

  /**
   * Pause a video
   */
  private pauseVideo(videoId: string, videoState: VideoState): void {
    videoState.isPlaying = false;
    playbackEvents.emit('pause', videoId);
    
    // Clear preview timer
    this.clearPreviewTimer(videoId);
  }

  /**
   * Prefetch a video
   */
  private async prefetchVideo(videoId: string, videoState: VideoState): Promise<void> {
    if (videoState.type !== 'VOD') return;
    
    try {
      // Get video URL (this would come from the video data)
      const videoUrl = this.getVideoUrl(videoId);
      if (!videoUrl) return;
      
      // Determine priority based on category
      const priority = this.getCategoryPriority(videoState.category);
      
      // Start prefetching
      await PrefetchManager.prefetchVideo(videoUrl, videoState.type, priority);
      videoState.isPrefetched = true;
      
      playbackEvents.emit('prefetch', videoId);
    } catch (error) {
      console.error(`Failed to prefetch video ${videoId}:`, error);
    }
  }

  /**
   * Start preview timer for sequencing
   */
  private startPreviewTimer(videoId: string, videoState: VideoState): void {
    const previewDuration = AppConfig.config.playback.previewDuration * 1000;
    
    const timer = setTimeout(() => {
      this.onPreviewEnd(videoId, videoState);
    }, previewDuration);
    
    this.previewTimers.set(videoId, timer);
    videoState.previewStartTime = Date.now();
  }

  /**
   * Clear preview timer
   */
  private clearPreviewTimer(videoId: string): void {
    const timer = this.previewTimers.get(videoId);
    if (timer) {
      clearTimeout(timer);
      this.previewTimers.delete(videoId);
    }
  }

  /**
   * Handle preview end - rotate to next soft play video
   */
  private onPreviewEnd(videoId: string, videoState: VideoState): void {
    this.clearPreviewTimer(videoId);
    
    // Find next soft play video
    const nextVideo = this.findNextSoftPlayVideo(videoState.category);
    
    if (nextVideo) {
      // Pause current video
      this.pauseVideo(videoId, videoState);
      
      // Play next video
      const nextVideoState = this.activeVideos.get(nextVideo.id);
      if (nextVideoState) {
        this.playVideo(nextVideo.id, nextVideoState);
        playbackEvents.emit('sequence', { from: videoId, to: nextVideo.id });
      }
    }
  }

  /**
   * Add video to soft play queue
   */
  private addToSoftPlayQueue(videoId: string, category: WidgetType): void {
    // Remove if already in queue
    this.removeFromSoftPlayQueue(videoId);
    
    // Add with priority
    const priority = this.getCategoryPriority(category);
    this.softPlayQueue.push({ id: videoId, category, priority });
    
    // Sort by priority (higher priority first)
    this.softPlayQueue.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove video from soft play queue
   */
  private removeFromSoftPlayQueue(videoId: string): void {
    this.softPlayQueue = this.softPlayQueue.filter(video => video.id !== videoId);
  }

  /**
   * Find next soft play video
   */
  private findNextSoftPlayVideo(currentCategory: WidgetType): SoftPlayVideo | null {
    // Look for videos in soft play queue that can play
    for (const video of this.softPlayQueue) {
      const videoState = this.activeVideos.get(video.id);
      if (videoState && videoState.visibilityState === MediaCardVisibility.prepareToBeActive) {
        return video;
      }
    }
    
    return null;
  }

  /**
   * Try to activate waiting videos
   */
  private tryToActivateWaiting(): void {
    // Look for videos that should be playing but aren't
    for (const [videoId, videoState] of this.activeVideos) {
      if (videoState.visibilityState === MediaCardVisibility.isActive && !videoState.isPlaying) {
        if (this.canPlayVideo(videoState.category)) {
          this.playVideo(videoId, videoState);
        }
      }
    }
  }

  /**
   * Check if a video category can play
   */
  private canPlayVideo(category: WidgetType): boolean {
    const maxConcurrent = AppConfig.config.widgets[category]?.maxConcurrentVideos || 1;
    const currentPlaying = this.getPlayingCountForCategory(category);
    
    return currentPlaying < maxConcurrent;
  }

  /**
   * Try to make room for a video category
   */
  private tryToMakeRoom(targetCategory: WidgetType): boolean {
    // For now, simple implementation - pause one video of lower priority
    const targetPriority = this.getCategoryPriority(targetCategory);
    
    for (const [videoId, videoState] of this.activeVideos) {
      if (videoState.isPlaying) {
        const currentPriority = this.getCategoryPriority(videoState.category);
        if (currentPriority < targetPriority) {
          this.pauseVideo(videoId, videoState);
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get category priority
   */
  private getCategoryPriority(category: WidgetType): number {
    const priorities = AppConfig.config.prefetch.priorities;
    return priorities.indexOf(category);
  }

  /**
   * Get playing count for a category
   */
  private getPlayingCountForCategory(category: WidgetType): number {
    let count = 0;
    for (const videoState of this.activeVideos.values()) {
      if (videoState.isPlaying && videoState.category === category) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get total playing count
   */
  private getPlayingCount(): number {
    let count = 0;
    for (const videoState of this.activeVideos.values()) {
      if (videoState.isPlaying) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get video URL (placeholder - would come from video data)
   */
  private getVideoUrl(videoId: string): string | null {
    // This would be implemented to get the actual video URL
    // For now, return null
    return null;
  }

  /**
   * Get playback statistics
   */
  getPlaybackStats(): {
    activeVideos: number;
    playingVideos: number;
    softPlayQueue: number;
    previewTimers: number;
  } {
    return {
      activeVideos: this.activeVideos.size,
      playingVideos: this.getPlayingCount(),
      softPlayQueue: this.softPlayQueue.length,
      previewTimers: this.previewTimers.size,
    };
  }

  /**
   * Clear all playback state
   */
  clearAll(): void {
    // Pause all playing videos
    for (const [videoId, videoState] of this.activeVideos) {
      if (videoState.isPlaying) {
        this.pauseVideo(videoId, videoState);
      }
    }
    
    // Clear all timers
    for (const timer of this.previewTimers.values()) {
      clearTimeout(timer);
    }
    
    // Clear all state
    this.activeVideos.clear();
    this.previewTimers.clear();
    this.softPlayQueue = [];
  }
}

export default new EnhancedPlaybackManager();

