import { NativeModules } from 'react-native';
import { AppConfig } from '../config/AppConfig';
import { SegmentInfo } from '../types';
import { logger } from '../utilities/Logger';

const { CacheManager: NativeCacheManager } = NativeModules;

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
    templateContent: string
  ): Promise<void> {
    try {
      await NativeCacheManager.updateManifestTemplate(templateId, templateContent);
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
    templateId?: string
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
        templateId || AppConfig.config.cache.manifestTemplateId
      );
    } catch (error) {
      console.error('CacheManager: Failed to generate offline manifest:', error);
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
      console.error('CacheManager: Failed to check if video is fully cached:', error);
      return false;
    }
  }

  /**
   * Get cache utilization percentage
   */
  async getCacheUtilization(): Promise<number> {
    const stats = await this.getCacheStats();
    const maxSizeMB = AppConfig.config.cache.maxSizeMB;
    
    if (maxSizeMB === 0) return 0;
    
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
      logger.debug('prefetch', `Cache status for ${url}: ${status.isCached ? 'HIT' : 'MISS'} (${status.cachedBytes} bytes)`);
      return status;
    } catch (error) {
      logger.error('prefetch', `Failed to get cache status: ${error}`);
      return { isCached: false, cachedBytes: 0 };
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
}

export default new CacheManagerService();

