import {AppConfig} from '../config/AppConfig';
import {PrefetchRequest, PrefetchStatus} from '../types';
import {logger} from '../utilities/Logger';
import CacheManager from './CacheManager';

interface SegmentInfo {
  url: string;
  duration: number;
  sequence: number;
}

interface ManifestInfo {
  segments: SegmentInfo[];
  isLive: boolean;
  targetDuration: number;
}

class PrefetchManager {
  private queue: PrefetchRequest[] = [];
  private activeDownloads = new Map<string, AbortController>();
  private statusMap = new Map<string, PrefetchStatus>();
  private maxConcurrent: number;
  private isEnabled: boolean;

  constructor() {
    this.maxConcurrent = AppConfig.config.prefetch.maxConcurrent;
    this.isEnabled = AppConfig.config.prefetch.enabled;
  }

  /**
   * Prefetch video segments (VOD only)
   * @param videoId - Clean video ID for logging (e.g., vid-3-2)
   * @param videoUrl - Actual video URL to prefetch
   * @param videoType - VOD or LIVE
   * @param priority - Higher number = higher priority
   */
  async prefetchVideo(
    videoId: string,
    videoUrl: string,
    videoType: 'VOD' | 'LIVE',
    priority: number = 0,
  ): Promise<void> {
    logger.info('prefetch', `🎯 PREFETCH START: ${videoId}`);
    logger.debug('prefetch', `  URL: ${videoUrl}`);
    logger.debug('prefetch', `  Type: ${videoType}`);
    logger.debug('prefetch', `  Priority: ${priority}`);

    // Skip if prefetching is disabled
    if (!this.isEnabled) {
      logger.warn('prefetch', '⚠️ Prefetch is DISABLED in config');
      return;
    }

    // VOD-only check
    if (videoType === 'LIVE' && AppConfig.config.prefetch.vodOnly) {
      logger.info(
        'prefetch',
        'ℹ️ Skipping prefetch for LIVE video (VOD-only mode)',
      );
      return;
    } else if (!AppConfig.config.prefetch.vodOnly) {
      logger.info('prefetch', '🎬 Prefetching for both VOD and LIVE');
    } else {
      logger.info('prefetch', '🎬 Prefetching VOD only');
    }

    // Check if already prefetching or completed
    const existingStatus = this.statusMap.get(videoId);
    if (
      existingStatus &&
      ['downloading', 'completed'].includes(existingStatus.state)
    ) {
      logger.debug(
        'prefetch',
        `✅ Already prefetching or completed: ${videoId}`,
      );
      return;
    }

    // Add to queue
    const request: PrefetchRequest = {
      videoId, // Clean ID for tracking/logging
      videoUrl, // Actual URL to prefetch
      videoType,
      priority,
      segmentCount: AppConfig.config.prefetch.segmentCount,
    };

    this.queue.push(request);
    this.queue.sort((a, b) => b.priority - a.priority); // Higher priority first

    // Update status
    this.statusMap.set(videoId, {
      videoId,
      state: 'queued',
      progress: 0,
      segmentsDownloaded: 0,
      totalSegments: 0,
    });

    logger.info('prefetch', `✅ Queued: ${videoId} (priority: ${priority})`);
    const stats = this.getQueueStats();
    logger.debug(
      'prefetch',
      `📊 Queue: ${stats.queueLength}, Active: ${stats.activeDownloads}`,
    );

    // Process queue
    this.processQueue();
  }

  /**
   * Get prefetch status for a video
   */
  getStatus(videoUrl: string): PrefetchStatus | undefined {
    const videoId = this.getVideoId(videoUrl);
    return this.statusMap.get(videoId);
  }

  /**
   * Cancel prefetch for a video
   */
  async cancelPrefetch(videoUrl: string): Promise<void> {
    const videoId = this.getVideoId(videoUrl);

    // Cancel active download
    const controller = this.activeDownloads.get(videoId);
    if (controller) {
      controller.abort();
      this.activeDownloads.delete(videoId);
    }

    // Remove from queue
    this.queue = this.queue.filter(
      req => this.getVideoId(req.videoUrl) !== videoId,
    );

    // Update status
    const status = this.statusMap.get(videoId);
    if (status) {
      this.statusMap.set(videoId, {
        ...status,
        state: 'cancelled',
      });
    }

    // Process queue to start next item
    this.processQueue();
  }

  /**
   * Cancel all prefetch operations
   */
  async cancelAll(): Promise<void> {
    // Cancel all active downloads
    for (const [videoId, controller] of this.activeDownloads) {
      controller.abort();
    }
    this.activeDownloads.clear();

    // Clear queue
    this.queue = [];

    // Update all statuses to cancelled
    for (const [videoId, status] of this.statusMap) {
      this.statusMap.set(videoId, {
        ...status,
        state: 'cancelled',
      });
    }
  }

  /**
   * Get all prefetch statuses
   */
  getAllStatuses(): PrefetchStatus[] {
    return Array.from(this.statusMap.values());
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueLength: number;
    activeDownloads: number;
    completed: number;
    failed: number;
  } {
    const statuses = Array.from(this.statusMap.values());
    return {
      queueLength: this.queue.length,
      activeDownloads: this.activeDownloads.size,
      completed: statuses.filter(s => s.state === 'completed').length,
      failed: statuses.filter(s => s.state === 'failed').length,
    };
  }

  /**
   * Process the prefetch queue
   */
  private async processQueue(): Promise<void> {
    // Don't start new downloads if at capacity
    if (this.activeDownloads.size >= this.maxConcurrent) {
      return;
    }

    // Get next request from queue
    const request = this.queue.shift();
    if (!request) {
      return;
    }

    // Start download (videoId now in request)
    this.startDownload(request);
  }

  /**
   * Start prefetch using native KTVHTTPCache
   */
  private async startDownload(request: PrefetchRequest): Promise<void> {
    const {videoId, videoUrl, videoType, segmentCount} = request;

    // Mark as active (for concurrency control)
    const controller = new AbortController();
    this.activeDownloads.set(videoId, controller);

    // Update status
    this.statusMap.set(videoId, {
      videoId,
      state: 'downloading',
      progress: 0,
      segmentsDownloaded: 0,
      totalSegments: segmentCount,
    });

    try {
      // VOD-only check (already checked in prefetchVideo, but double-check here)
      if (videoType === 'LIVE' && AppConfig.config.prefetch.vodOnly) {
        logger.warn(
          'prefetch',
          `⚠️ LIVE video ${videoId}, skipping (VOD-only mode)`,
        );
        this.statusMap.set(videoId, {
          videoId,
          state: 'failed',
          progress: 0,
          segmentsDownloaded: 0,
          totalSegments: 0,
        });
        return;
      }

      // Get proxy URL for the video
      const proxyURL = await CacheManager.getCachedURL(videoUrl);
      
      // Use AVAssetPrefetchManager to prefetch through KTV proxy
      // This downloads segments through KTVHTTPCache, which caches to disk
      // Cancel after 10s, KTV cache persists for offline playback
      await CacheManager.prefetchVideo(videoId, proxyURL);

      // Mark as completed (KTV handles download internally)
      this.statusMap.set(videoId, {
        videoId,
        state: 'completed',
        progress: 100,
        segmentsDownloaded: segmentCount,
        totalSegments: segmentCount,
      });

      logger.info('prefetch', `✅ Prefetch complete: ${videoId}`);
    } catch (error) {
      if (controller.signal.aborted) {
        logger.info('prefetch', `🛑 Prefetch cancelled: ${videoId}`);
        this.statusMap.set(videoId, {
          videoId,
          state: 'cancelled',
          progress: 0,
          segmentsDownloaded: 0,
          totalSegments: 0,
        });
      } else {
        logger.error('prefetch', `❌ Prefetch failed: ${videoId}`, error);
        this.statusMap.set(videoId, {
          videoId,
          state: 'failed',
          progress: 0,
          segmentsDownloaded: 0,
          totalSegments: 0,
        });
      }
    } finally {
      this.activeDownloads.delete(videoId);
      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Generate video ID from URL
   */
  private getVideoId(url: string): string {
    // Simple hash of URL for ID
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Update configuration
   */
  updateConfig(): void {
    this.maxConcurrent = AppConfig.config.prefetch.maxConcurrent;
    this.isEnabled = AppConfig.config.prefetch.enabled;
  }
}

export default new PrefetchManager();
