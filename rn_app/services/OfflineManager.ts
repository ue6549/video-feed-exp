import { AppConfig } from '../config/AppConfig';
import { IFeedItem, VideoData, OfflineVideoInfo } from '../types';
import CacheManager from './CacheManager';
import ManifestTemplateManager from '../config/ManifestTemplates';

class OfflineManager {
  private cachedVideos: Map<string, OfflineVideoInfo> = new Map();
  private isOfflineMode = false;

  constructor() {
    this.initializeOfflineMode();
  }

  /**
   * Initialize offline mode based on configuration
   */
  private async initializeOfflineMode(): Promise<void> {
    this.isOfflineMode = AppConfig.config.offline.mockOfflineMode;
    
    // Subscribe to config changes
    AppConfig.subscribe((config) => {
      this.isOfflineMode = config.offline.mockOfflineMode;
    });

    // Load cached videos if in offline mode
    if (this.isOfflineMode) {
      await this.loadCachedVideos();
    }
  }

  /**
   * Check if offline mode is enabled
   */
  isOfflineModeEnabled(): boolean {
    return this.isOfflineMode;
  }

  /**
   * Filter feed items for offline mode
   */
  async filterFeedForOffline(feedItems: IFeedItem[]): Promise<IFeedItem[]> {
    if (!this.isOfflineMode || !AppConfig.config.offline.showOnlyCachedVideos) {
      return feedItems;
    }

    const offlineItems: IFeedItem[] = [];

    for (const item of feedItems) {
      if (item.widgetType === 'merch') {
        // Merch items are always available offline (images)
        offlineItems.push(item);
      } else if (item.widgetType === 'short' || item.widgetType === 'carousel') {
        // Check if video is cached
        const isCached = await this.isVideoCached(item);
        if (isCached) {
          offlineItems.push(item);
        }
      }
    }

    return offlineItems;
  }

  /**
   * Check if a video is cached
   */
  async isVideoCached(feedItem: IFeedItem): Promise<boolean> {
    if (feedItem.widgetType === 'merch') {
      return true; // Images are always considered "cached"
    }

    const videoData = this.extractVideoData(feedItem);
    if (!videoData) return false;

    // Check if video URL is cached
    const isCached = await CacheManager.isCached(videoData.videoSource.url);
    
    if (isCached) {
      // Update cached videos map
      this.cachedVideos.set(videoData.videoSource.url, {
        videoUrl: videoData.videoSource.url,
        cachedSegments: [], // Would be populated from cache
        isFullyCached: true,
        manifestUrl: await this.generateOfflineManifest(videoData.videoSource.url),
      });
    }

    return isCached;
  }

  /**
   * Get cached video info
   */
  getCachedVideoInfo(videoUrl: string): OfflineVideoInfo | undefined {
    return this.cachedVideos.get(videoUrl);
  }

  /**
   * Generate offline manifest for a video
   */
  async generateOfflineManifest(videoUrl: string): Promise<string> {
    try {
      // Get cached segments (this would be implemented with actual cache data)
      const cachedSegments = await this.getCachedSegments(videoUrl);
      
      // Generate manifest using template
      const manifest = ManifestTemplateManager.generateManifest(
        AppConfig.config.cache.manifestTemplateId,
        cachedSegments
      );

      return manifest;
    } catch (error) {
      console.error(`Failed to generate offline manifest for ${videoUrl}:`, error);
      return videoUrl; // Fallback to original URL
    }
  }

  /**
   * Get cached segments for a video
   */
  private async getCachedSegments(videoUrl: string): Promise<Array<{ url: string; duration: number; sequence: number }>> {
    // This would be implemented to get actual cached segments
    // For now, return empty array
    return [];
  }

  /**
   * Load cached videos from cache manager
   */
  private async loadCachedVideos(): Promise<void> {
    try {
      const cachedVideoUrls = await CacheManager.getCachedVideos();
      
      for (const videoUrl of cachedVideoUrls) {
        const isFullyCached = await CacheManager.isVideoFullyCached(videoUrl);
        
        this.cachedVideos.set(videoUrl, {
          videoUrl,
          cachedSegments: [],
          isFullyCached,
          manifestUrl: await this.generateOfflineManifest(videoUrl),
        });
      }
    } catch (error) {
      console.error('Failed to load cached videos:', error);
    }
  }

  /**
   * Extract video data from feed item
   */
  private extractVideoData(feedItem: IFeedItem): VideoData | null {
    if (feedItem.widgetType === 'short') {
      return feedItem.data as VideoData;
    } else if (feedItem.widgetType === 'carousel') {
      const carouselData = feedItem.data as VideoData[];
      return carouselData[0]; // Return first video for simplicity
    }
    
    return null;
  }

  /**
   * Get offline status message
   */
  getOfflineStatusMessage(): string {
    if (!this.isOfflineMode) {
      return 'Online mode';
    }

    const cachedCount = this.cachedVideos.size;
    return `Offline mode - ${cachedCount} videos cached`;
  }

  /**
   * Get offline statistics
   */
  getOfflineStats(): {
    isOfflineMode: boolean;
    cachedVideos: number;
    fullyCachedVideos: number;
    partiallyCachedVideos: number;
  } {
    let fullyCached = 0;
    let partiallyCached = 0;

    for (const videoInfo of this.cachedVideos.values()) {
      if (videoInfo.isFullyCached) {
        fullyCached++;
      } else {
        partiallyCached++;
      }
    }

    return {
      isOfflineMode: this.isOfflineMode,
      cachedVideos: this.cachedVideos.size,
      fullyCachedVideos: fullyCached,
      partiallyCachedVideos: partiallyCached,
    };
  }

  /**
   * Toggle offline mode
   */
  async toggleOfflineMode(): Promise<void> {
    const newOfflineMode = !this.isOfflineMode;
    
    // Update config
    AppConfig.update({
      offline: {
        ...AppConfig.config.offline,
        mockOfflineMode: newOfflineMode,
      },
    });

    if (newOfflineMode) {
      await this.loadCachedVideos();
    } else {
      this.cachedVideos.clear();
    }
  }

  /**
   * Clear offline cache
   */
  async clearOfflineCache(): Promise<void> {
    await CacheManager.clearCache();
    this.cachedVideos.clear();
  }

  /**
   * Get offline video URL (with manifest if needed)
   */
  async getOfflineVideoUrl(originalUrl: string): Promise<string> {
    if (!this.isOfflineMode) {
      return originalUrl;
    }

    const cachedInfo = this.cachedVideos.get(originalUrl);
    if (cachedInfo && cachedInfo.manifestUrl) {
      return cachedInfo.manifestUrl;
    }

    // Fallback to cached URL
    return await CacheManager.getCachedURL(originalUrl);
  }

  /**
   * Check if video can be played offline
   */
  canPlayOffline(videoUrl: string): boolean {
    if (!this.isOfflineMode) {
      return true; // Online mode - all videos can play
    }

    const cachedInfo = this.cachedVideos.get(videoUrl);
    return cachedInfo ? cachedInfo.isFullyCached : false;
  }

  /**
   * Get offline video list
   */
  getOfflineVideoList(): OfflineVideoInfo[] {
    return Array.from(this.cachedVideos.values());
  }
}

export default new OfflineManager();

