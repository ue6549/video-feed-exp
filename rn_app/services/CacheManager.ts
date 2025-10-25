import {NativeModules} from 'react-native';
import {AppConfig} from '../config/AppConfig';
import {SegmentInfo} from '../types';
import {logger} from '../utilities/Logger';

const {CacheManager: NativeCacheManager, AVAssetPrefetchManager} =
  NativeModules;

export interface CacheStats {
  totalLength: number;
  totalSize: number;
  totalLengthMB: number;
  totalSizeMB: number;
  isInitialized: boolean;
}

export interface CacheStatusResult {
  isCached: boolean;
  cachedBytes: number;
}

class CacheManagerService {
  private isInitialized = false;

  /**
   * Initialize cache with configuration
   */
  async initialize(): Promise<void> {
    try {
      await NativeCacheManager.setupCache(AppConfig.config.cache.maxSizeMB);
      this.isInitialized = true;
      console.log('CacheManager: Initialized successfully');
    } catch (error) {
      console.error('CacheManager: Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get cached URL for a video
   */
  async getCachedURL(originalURL: string): Promise<string> {
    try {
      const cachedURL = await NativeCacheManager.getCachedURL(originalURL);
      return cachedURL;
    } catch (error) {
      console.error('CacheManager: Failed to get cached URL:', error);
      return originalURL; // Fallback to original URL
    }
  }

  /**
   * Check if a URL is cached
   */
  async isCached(url: string): Promise<boolean> {
    try {
      return await NativeCacheManager.isCached(url);
    } catch (error) {
      console.error('CacheManager: Failed to check cache status:', error);
      return false;
    }
  }

  /**
   * Get current cache size
   */
  async getCacheSize(): Promise<number> {
    try {
      return await NativeCacheManager.getCacheSize();
    } catch (error) {
      console.error('CacheManager: Failed to get cache size:', error);
      return 0;
    }
  }

  /**
   * Clear all cached content
   */
  async clearCache(): Promise<void> {
    try {
      await NativeCacheManager.clearCache();
      console.log('CacheManager: Cache cleared');
    } catch (error) {
      console.error('CacheManager: Failed to clear cache:', error);
      throw error;
    }
  }

  /**
   * Delete cache for a specific URL
   */
  async deleteCache(url: string): Promise<void> {
    try {
      await NativeCacheManager.deleteCache(url);
    } catch (error) {
      console.error('CacheManager: Failed to delete cache:', error);
      throw error;
    }
  }

  /**
   * Update manifest template
   */
  async updateManifestTemplate(
    templateId: string,
    templateContent: string,
  ): Promise<void> {
    try {
      await NativeCacheManager.updateManifestTemplate(
        templateId,
        templateContent,
      );
    } catch (error) {
      console.error('CacheManager: Failed to update manifest template:', error);
      throw error;
    }
  }

  /**
   * Get manifest template
   */
  async getManifestTemplate(templateId: string): Promise<string | null> {
    try {
      return await NativeCacheManager.getManifestTemplate(templateId);
    } catch (error) {
      console.error('CacheManager: Failed to get manifest template:', error);
      return null;
    }
  }

  /**
   * Generate offline manifest
   */
  async generateOfflineManifest(
    videoURL: string,
    cachedSegments: SegmentInfo[],
    templateId?: string,
  ): Promise<string> {
    try {
      const segments = cachedSegments.map(segment => ({
        url: segment.url,
        duration: segment.duration,
        sequence: segment.sequence,
      }));

      return await NativeCacheManager.generateOfflineManifest(
        videoURL,
        segments,
        templateId || AppConfig.config.cache.manifestTemplateId,
      );
    } catch (error) {
      console.error(
        'CacheManager: Failed to generate offline manifest:',
        error,
      );
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const stats = await NativeCacheManager.getCacheStats();
      return stats as CacheStats;
    } catch (error) {
      console.error('CacheManager: Failed to get cache stats:', error);
      return {
        totalLength: 0,
        totalSize: 0,
        totalLengthMB: 0,
        totalSizeMB: 0,
        isInitialized: false,
      };
    }
  }

  /**
   * Get list of cached videos
   */
  async getCachedVideos(): Promise<string[]> {
    try {
      return await NativeCacheManager.getCachedVideos();
    } catch (error) {
      console.error('CacheManager: Failed to get cached videos:', error);
      return [];
    }
  }

  /**
   * Check if a video is fully cached
   */
  async isVideoFullyCached(videoURL: string): Promise<boolean> {
    try {
      return await NativeCacheManager.isVideoFullyCached(videoURL);
    } catch (error) {
      console.error(
        'CacheManager: Failed to check if video is fully cached:',
        error,
      );
      return false;
    }
  }

  /**
   * Get cache utilization percentage
   */
  async getCacheUtilization(): Promise<number> {
    const stats = await this.getCacheStats();
    const maxSizeMB = AppConfig.config.cache.maxSizeMB;

    if (maxSizeMB === 0) {
      return 0;
    }

    return Math.min((stats.totalSizeMB / maxSizeMB) * 100, 100);
  }

  /**
   * Check if cache is healthy (not overutilized)
   */
  async isCacheHealthy(): Promise<boolean> {
    const utilization = await this.getCacheUtilization();
    return utilization < 90; // Consider healthy if under 90% utilization
  }

  /**
   * Log cache statistics
   */
  async logCacheStats(): Promise<void> {
    const stats = await this.getCacheStats();
    const utilization = await this.getCacheUtilization();

    console.log('CacheManager Stats:', {
      ...stats,
      utilization: `${utilization.toFixed(1)}%`,
    });
  }

  /**
   * Check if cache manager is initialized
   */
  getInitializationStatus(): boolean {
    try {
      return NativeCacheManager.getInitializationStatus();
    } catch (error) {
      return this.isInitialized;
    }
  }

  /**
   * Get cache status for a specific URL
   */
  async getCacheStatus(url: string): Promise<CacheStatusResult> {
    try {
      const status = await NativeCacheManager.getCacheStatus(url);
      logger.debug(
        'prefetch',
        `Cache status for ${url}: ${status.isCached ? 'HIT' : 'MISS'} (${
          status.cachedBytes
        } bytes)`,
      );
      return status;
    } catch (error) {
      logger.error('prefetch', `Failed to get cache status: ${error}`);
      return {isCached: false, cachedBytes: 0};
    }
  }

  /**
   * Get total cache size in bytes
   */
  async getTotalCacheSize(): Promise<number> {
    try {
      return await NativeCacheManager.getTotalCacheSize();
    } catch (error) {
      logger.error('prefetch', `Failed to get total cache size: ${error}`);
      return 0;
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache(): Promise<void> {
    try {
      logger.info('prefetch', 'Clearing all cache');
      await NativeCacheManager.clearCache();
    } catch (error) {
      logger.error('prefetch', `Failed to clear cache: ${error}`);
      throw error;
    }
  }
  /**
   * Prefetch video using AVAssetDownloadTask (new implementation)
   * @param videoId Clean video ID for tracking
   * @param proxyURL KTV proxy URL for the video
   * @param durationSeconds Duration to prefetch before canceling (default: 2s)
   */
  async prefetchVideo(
    videoId: string,
    proxyURL: string,
    durationSeconds?: number,
  ): Promise<void> {
    if (!AVAssetPrefetchManager) {
      logger.warn('prefetch', 'AVAssetPrefetchManager not available');
      return;
    }

    const duration =
      durationSeconds ?? AppConfig.config.prefetch.prefetchDurationSeconds ?? 2;

    try {
      logger.info(
        'prefetch',
        `Prefetch request: ${videoId} (duration: ${duration}s)`,
      );
      AVAssetPrefetchManager.prefetchVideo(videoId, proxyURL, duration);
    } catch (error) {
      logger.error('prefetch', `Prefetch failed for ${videoId}: ${error}`);
      throw error;
    }
  }

  /**
   * Legacy prefetch method using KTVHTTPCache (kept for backward compatibility)
   * @deprecated Use prefetchVideo() with AVAssetDownloadTask instead
   */
  async prefetchVideoLegacy(
    videoId: string,
    videoUrl: string,
    segmentCount: number,
  ): Promise<boolean> {
    try {
      logger.debug(
        'prefetch',
        `Legacy prefetch request: ${videoId} (${segmentCount} segments)`,
      );
      const result = await NativeCacheManager.prefetchVideo(
        videoId,
        videoUrl,
        segmentCount,
      );
      return result;
    } catch (error) {
      logger.error('prefetch', `Legacy prefetch failed for ${videoId}: ${error}`);
      throw error;
    }
  }

  /**
   * Cancel ongoing prefetch (AVAssetDownloadTask)
   */
  cancelPrefetch(videoId: string): void {
    if (!AVAssetPrefetchManager) {
      logger.warn('prefetch', 'AVAssetPrefetchManager not available');
      return;
    }

    try {
      AVAssetPrefetchManager.cancelPrefetch(videoId);
      logger.debug('prefetch', `Cancelled prefetch: ${videoId}`);
    } catch (error) {
      logger.error(
        'prefetch',
        `Failed to cancel prefetch ${videoId}: ${error}`,
      );
    }
  }

  /**
   * Cancel all ongoing prefetches (AVAssetDownloadTask)
   */
  cancelAllPrefetch(): void {
    if (!AVAssetPrefetchManager) {
      logger.warn('prefetch', 'AVAssetPrefetchManager not available');
      return;
    }

    try {
      AVAssetPrefetchManager.cancelAll();
      logger.info('prefetch', 'Cancelled all prefetches');
    } catch (error) {
      logger.error('prefetch', `Failed to cancel all prefetches: ${error}`);
    }
  }

  /**
   * Get prefetch statistics for a specific video
   */
  async getPrefetchStats(
    videoId: string,
  ): Promise<{segmentCount: number; totalBytes: number}> {
    try {
      const stats = await NativeCacheManager.getPrefetchStats(videoId);
      return stats;
    } catch (error) {
      logger.error(
        'prefetch',
        `Failed to get prefetch stats for ${videoId}: ${error}`,
      );
      return {segmentCount: 0, totalBytes: 0};
    }
  }

  /**
   * Get prefetch statistics for all videos
   */
  async getAllPrefetchStats(): Promise<
    Record<string, {segmentCount: number; totalBytes: number}>
  > {
    try {
      const stats = await NativeCacheManager.getAllPrefetchStats();
      return stats;
    } catch (error) {
      logger.error('prefetch', `Failed to get all prefetch stats: ${error}`);
      return {};
    }
  }

  /**
   * Update prefetch configuration
   */
  async setPrefetchConfig(
    bufferSeconds: number,
    timeoutSeconds: number,
  ): Promise<void> {
    try {
      await NativeCacheManager.setPrefetchConfig(bufferSeconds, timeoutSeconds);
      logger.info(
        'prefetch',
        `Config updated: buffer=${bufferSeconds}s, timeout=${timeoutSeconds}s`,
      );
    } catch (error) {
      logger.error('prefetch', `Failed to update prefetch config: ${error}`);
    }
  }

  /**
   * Cancel all active prefetches (e.g., on network loss)
   */
  async cancelAllPrefetches(): Promise<void> {
    try {
      await NativeCacheManager.cancelAllPrefetches();
      logger.info('prefetch', 'Cancelled all active prefetches');
    } catch (error) {
      logger.error('prefetch', `Failed to cancel prefetches: ${error}`);
    }
  }

  /**
   * Setup security configuration
   */
  async setupSecurity(securityConfig: any): Promise<void> {
    try {
      await NativeCacheManager.setupSecurity(securityConfig);
      logger.info('security', 'Security configuration applied');
    } catch (error) {
      logger.error('security', `Failed to setup security: ${error}`);
      throw error;
    }
  }

  /**
   * Get security statistics
   */
  async getSecurityStats(): Promise<any> {
    try {
      const stats = await NativeCacheManager.getSecurityStats();
      return stats;
    } catch (error) {
      logger.error('security', `Failed to get security stats: ${error}`);
      return {error: 'Security manager not initialized'};
    }
  }

  /**
   * Update security configuration
   */
  async updateSecurityConfig(securityConfig: any): Promise<void> {
    try {
      await NativeCacheManager.updateSecurityConfig(securityConfig);
      logger.info('security', 'Security configuration updated');
    } catch (error) {
      logger.error('security', `Failed to update security config: ${error}`);
      throw error;
    }
  }

  /**
   * Clear security data
   */
  async clearSecurityData(): Promise<void> {
    try {
      await NativeCacheManager.clearSecurityData();
      logger.info('security', 'Security data cleared');
    } catch (error) {
      logger.error('security', `Failed to clear security data: ${error}`);
      throw error;
    }
  }
}

export default new CacheManagerService();
