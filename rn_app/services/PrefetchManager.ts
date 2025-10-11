import { AppConfig } from '../config/AppConfig';
import { PrefetchRequest, PrefetchStatus } from '../types';
import { logger } from '../utilities/Logger';

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
   */
  async prefetchVideo(
    videoUrl: string,
    videoType: 'VOD' | 'LIVE',
    priority: number = 0
  ): Promise<void> {
    logger.info('prefetch', `📥 PrefetchManager.prefetchVideo() called`);
    logger.info('prefetch', `  URL: ${videoUrl}`);
    logger.info('prefetch', `  Type: ${videoType}`);
    logger.info('prefetch', `  Priority: ${priority}`);
    
    // Skip if prefetching is disabled
    if (!this.isEnabled) {
      logger.warn('prefetch', '⚠️ Prefetch is DISABLED in config');
      return;
    }

    // VOD-only check
    if (videoType === 'LIVE' && AppConfig.config.prefetch.vodOnly) {
      logger.info('prefetch', `ℹ️ Skipping prefetch for LIVE video (VOD-only mode)`);
      return;
    } else if (!AppConfig.config.prefetch.vodOnly) {
      logger.info('prefetch', `🎬 Prefetching for both VOD and LIVE`);
    } else {
      logger.info('prefetch', `🎬 Prefetching VOD only`);
    }

    const videoId = this.getVideoId(videoUrl);
    
    // Check if already prefetching or completed
    const existingStatus = this.statusMap.get(videoId);
    if (existingStatus && ['downloading', 'completed'].includes(existingStatus.state)) {
      logger.debug('prefetch', `✅ Already prefetching or completed: ${videoId}`);
      return;
    }

    // Add to queue
    const request: PrefetchRequest = {
      videoUrl,
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

    logger.info('prefetch', `✅ Prefetch queued for: ${videoId}`);
    logger.info('prefetch', `📊 Queue size: ${this.queue.length}, Active downloads: ${this.activeDownloads.size}`);

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
    this.queue = this.queue.filter(req => this.getVideoId(req.videoUrl) !== videoId);

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

    const videoId = this.getVideoId(request.videoUrl);
    
    // Start download
    this.startDownload(request);
  }

  /**
   * Start downloading segments for a video
   */
  private async startDownload(request: PrefetchRequest): Promise<void> {
    const videoId = this.getVideoId(request.videoUrl);
    const controller = new AbortController();
    
    this.activeDownloads.set(videoId, controller);
    
    // Update status
    this.statusMap.set(videoId, {
      videoId,
      state: 'downloading',
      progress: 0,
      segmentsDownloaded: 0,
      totalSegments: 0,
    });

    try {
      // 1. Fetch and parse manifest
      const manifest = await this.fetchManifest(request.videoUrl, controller.signal);
      
      // 2. Detect if actually VOD from manifest
      if (this.isLiveManifest(manifest)) {
        console.warn(`PrefetchManager: Manifest indicates LIVE, skipping prefetch for ${videoId}`);
        this.statusMap.set(videoId, {
          videoId,
          state: 'failed',
          progress: 0,
          segmentsDownloaded: 0,
          totalSegments: 0,
        });
        return;
      }

      // 3. Extract segments
      const segments = this.parseSegments(manifest).slice(0, request.segmentCount);
      
      // Update total segments
      this.statusMap.set(videoId, {
        videoId,
        state: 'downloading',
        progress: 0,
        segmentsDownloaded: 0,
        totalSegments: segments.length,
      });

      // 4. Download segments
      await this.downloadSegments(videoId, segments, controller.signal);

      // Mark as completed
      this.statusMap.set(videoId, {
        videoId,
        state: 'completed',
        progress: 100,
        segmentsDownloaded: segments.length,
        totalSegments: segments.length,
      });

    } catch (error) {
      if (controller.signal.aborted) {
        console.log(`PrefetchManager: Download cancelled for ${videoId}`);
        this.statusMap.set(videoId, {
          videoId,
          state: 'cancelled',
          progress: 0,
          segmentsDownloaded: 0,
          totalSegments: 0,
        });
      } else {
        console.error(`PrefetchManager: Download failed for ${videoId}:`, error);
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
   * Fetch HLS manifest
   */
  private async fetchManifest(url: string, signal: AbortSignal): Promise<string> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch manifest: ${response.status}`);
    }
    return response.text();
  }

  /**
   * Check if manifest indicates live content
   */
  private isLiveManifest(manifest: string): boolean {
    // Check for live indicators:
    // - No #EXT-X-ENDLIST tag
    // - #EXT-X-PLAYLIST-TYPE:EVENT
    return !manifest.includes('#EXT-X-ENDLIST') || 
           manifest.includes('#EXT-X-PLAYLIST-TYPE:EVENT');
  }

  /**
   * Parse segments from manifest
   */
  private parseSegments(manifest: string): SegmentInfo[] {
    const segments: SegmentInfo[] = [];
    const lines = manifest.split('\n');
    
    let currentDuration = 0;
    let sequence = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Parse duration
      if (line.startsWith('#EXTINF:')) {
        const durationMatch = line.match(/#EXTINF:([0-9.]+)/);
        if (durationMatch) {
          currentDuration = parseFloat(durationMatch[1]);
        }
      }
      
      // Parse segment URL
      if (line && !line.startsWith('#')) {
        segments.push({
          url: line,
          duration: currentDuration,
          sequence: sequence++,
        });
      }
    }
    
    return segments;
  }

  /**
   * Download video segments
   */
  private async downloadSegments(
    videoId: string,
    segments: SegmentInfo[],
    signal: AbortSignal
  ): Promise<void> {
    for (let i = 0; i < segments.length; i++) {
      if (signal.aborted) {
        throw new Error('Download cancelled');
      }

      const segment = segments[i];
      
      try {
        // Download segment (this would integrate with cache manager)
        await this.downloadSegment(segment.url, signal);
        
        // Update progress
        const progress = Math.round(((i + 1) / segments.length) * 100);
        this.statusMap.set(videoId, {
          videoId,
          state: 'downloading',
          progress,
          segmentsDownloaded: i + 1,
          totalSegments: segments.length,
        });
        
      } catch (error) {
        console.error(`Failed to download segment ${segment.url}:`, error);
        throw error;
      }
    }
  }

  /**
   * Download a single segment
   */
  private async downloadSegment(url: string, signal: AbortSignal): Promise<void> {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      throw new Error(`Failed to download segment: ${response.status}`);
    }
    
    // In a real implementation, this would save to cache
    // For now, just consume the response
    await response.arrayBuffer();
  }

  /**
   * Generate video ID from URL
   */
  private getVideoId(url: string): string {
    // Simple hash of URL for ID
    let hash = 0;
    for (let i = 0; i < url.length; i++) {
      const char = url.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
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

