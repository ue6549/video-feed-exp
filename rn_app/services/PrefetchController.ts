/**
 * Base PrefetchController - Abstract class for reusable, nestable prefetch coordination
 *
 * This enables:
 * - FeedPrefetchController (vertical scroll in feed)
 * - CarouselPrefetchController (horizontal scroll in carousel) - Future
 * - Any other scrollable video collection
 *
 * Priority context propagates from parent to child controllers
 */

import PrefetchManager from './PrefetchManager';
import {logger} from '../utilities/Logger';

export interface PrefetchVideo {
  id: string; // Clean video ID (vid-X-Y)
  url: string; // Actual video URL for KTVHTTPCache
  type: 'VOD' | 'LIVE'; // Video type
}

export abstract class PrefetchController {
  protected name: string;
  protected parentPriority: number;

  constructor(name: string, parentPriority: number = 0) {
    this.name = name;
    this.parentPriority = parentPriority;
  }

  /**
   * Prefetch a batch of videos with priority calculation
   * Priority = parentPriority + basePriority
   */
  protected prefetchVideos(
    videos: PrefetchVideo[],
    basePriority: number,
  ): void {
    if (videos.length === 0) {return;}

    const finalPriority = this.parentPriority + basePriority;

    logger.debug(
      'prefetch',
      `[${this.name}] Prefetching ${videos.length} videos (priority: ${finalPriority})`,
    );

    videos.forEach(video => {
      PrefetchManager.prefetchVideo(
        video.id,
        video.url,
        video.type,
        finalPriority,
      );
    });
  }

  /**
   * Log prefetch activity
   */
  protected logPrefetch(message: string): void {
    logger.info('prefetch', `[${this.name}] ${message}`);
  }
}
