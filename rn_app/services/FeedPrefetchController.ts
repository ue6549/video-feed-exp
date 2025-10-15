/**
 * FeedPrefetchController - Handles vertical scroll prefetching in the main feed
 *
 * Responsibilities:
 * - Track visible widget indices in RecyclerListView
 * - Prefetch next N widgets based on scroll position
 * - Handle carousel widgets (prefetch first 2 videos, rest at low priority)
 * - Trigger prefetch on initial load and page load
 *
 * Priority strategy:
 * - Closer widgets = higher priority (100 - distance * 10)
 * - Carousel first 2 videos = high priority
 * - Carousel remaining videos = low priority (for horizontal scroll)
 */

import {PrefetchController, PrefetchVideo} from './PrefetchController';
import {IFeedItem, VideoData} from '../types';
import {AppConfig} from '../config/AppConfig';
import {generateVideoId} from '../utilities/videoIdGenerator';
import {logger} from '../utilities/Logger';

export class FeedPrefetchController extends PrefetchController {
  private lastPrefetchedIndex: number = -1;

  constructor() {
    super('FEED', 0); // Top-level controller, no parent priority
  }

  /**
   * Handle RecyclerListView visible indices change (scroll event)
   */
  handleVisibleIndicesChanged(
    visibleIndices: number[],
    feedData: IFeedItem[],
  ): void {
    if (!AppConfig.config.prefetch.enabled) {
      logger.debug('prefetch', '[FEED] Prefetch disabled in config');
      return;
    }

    if (visibleIndices.length === 0) {return;}

    const lastVisible = Math.max(...visibleIndices);
    const range = AppConfig.config.visibility.prefetchRange;
    const prefetchUntil = lastVisible + range;

    this.logPrefetch(
      `Visible indices: [${visibleIndices.join(
        ', ',
      )}], prefetch until: ${prefetchUntil}`,
    );

    // Only prefetch forward (don't re-prefetch already processed widgets)
    for (
      let i = Math.max(this.lastPrefetchedIndex + 1, lastVisible + 1);
      i <= prefetchUntil;
      i++
    ) {
      if (i >= feedData.length) {break;}

      const widget = feedData[i];
      const distance = i - lastVisible;
      this.prefetchWidget(widget, distance);
    }

    this.lastPrefetchedIndex = Math.max(
      this.lastPrefetchedIndex,
      prefetchUntil,
    );
  }

  /**
   * Prefetch a single widget (short, carousel, or merch)
   */
  private prefetchWidget(widget: IFeedItem, distance: number): void {
    const distancePriority = 100 - distance * 10; // Closer = higher priority
    const widgetIndex = widget.widgetIndex ?? 0;

    if (widget.widgetType === 'carousel') {
      this.prefetchCarousel(widget, widgetIndex, distancePriority);
    } else if (widget.widgetType === 'short') {
      this.prefetchShortVideo(widget, widgetIndex, distancePriority);
    } else if (widget.widgetType === 'merch') {
      // Merch widgets have no video - skip
      logger.debug(
        'prefetch',
        `[FEED] Skipping merch widget at index ${widgetIndex}`,
      );
    }
  }

  /**
   * Prefetch carousel widget
   * - First N videos at high priority (visible initially)
   * - Remaining videos at low priority (for horizontal scroll)
   */
  private prefetchCarousel(
    widget: IFeedItem,
    widgetIndex: number,
    basePriority: number,
  ): void {
    const videos = widget.data as VideoData[];
    const maxInitial = AppConfig.config.prefetch.carousel?.initialVideos ?? 2;

    // High priority: First N visible videos
    const initialVideos: PrefetchVideo[] = videos
      .slice(0, maxInitial)
      .map((v, idx) => ({
        id: generateVideoId(widgetIndex, idx),
        url: v.videoSource.url,
        type: v.videoSource.videoType,
      }));

    if (initialVideos.length > 0) {
      this.logPrefetch(
        `🎯 Carousel widget ${widgetIndex}: prefetching first ${initialVideos.length} videos ` +
          `[${initialVideos
            .map(v => v.id)
            .join(', ')}] at priority ${basePriority}`,
      );
      this.prefetchVideos(initialVideos, basePriority);
    }

    // Low priority: Remaining videos (for potential horizontal scroll)
    const remainingVideos: PrefetchVideo[] = videos
      .slice(maxInitial)
      .map((v, idx) => ({
        id: generateVideoId(widgetIndex, idx + maxInitial),
        url: v.videoSource.url,
        type: v.videoSource.videoType,
      }));

    if (remainingVideos.length > 0) {
      this.logPrefetch(
        `🔽 Carousel widget ${widgetIndex}: queueing remaining ${remainingVideos.length} videos ` +
          `[${remainingVideos.map(v => v.id).join(', ')}] at low priority (10)`,
      );
      this.prefetchVideos(remainingVideos, 10); // Lowest priority
    }
  }

  /**
   * Prefetch short video widget (single video)
   */
  private prefetchShortVideo(
    widget: IFeedItem,
    widgetIndex: number,
    priority: number,
  ): void {
    const video = widget.data as VideoData;
    const videoId = generateVideoId(widgetIndex, 0);

    this.logPrefetch(
      `🎯 Short video widget ${widgetIndex}: ${videoId} at priority ${priority}`,

    this.prefetchVideos(
      [
        {
          id: videoId,
          url: video.videoSource.url,
          type: video.videoSource.videoType,
        },
      ],
      priority,
    );
  }

  /**
   * Trigger initial prefetch when feed loads
   */
  onInitialLoad(feedData: IFeedItem[]): void {
    if (!AppConfig.config.prefetch.enabled) {return;}

    this.logPrefetch(`📥 Initial load: ${feedData.length} widgets available`);

    // Simulate first widget visible, prefetch next N
    const range = Math.min(
      AppConfig.config.visibility.prefetchRange,
      feedData.length - 1,

    if (range > 0) {
      this.handleVisibleIndicesChanged([0], feedData);
      this.logPrefetch(`✅ Initial prefetch triggered for ${range} widgets`);
    }
  }

  /**
   * Trigger prefetch when new page loads (pagination)
   */
  onPageLoad(allFeedData: IFeedItem[], newPageStartIndex: number): void {
    if (!AppConfig.config.prefetch.enabled) {return;}

    this.logPrefetch(
      `📥 Page loaded: new widgets from index ${newPageStartIndex}`,

    // Prefetch first 3 widgets from new page
    const prefetchCount = Math.min(3, allFeedData.length - newPageStartIndex);

    for (let i = 0; i < prefetchCount; i++) {
      const widget = allFeedData[newPageStartIndex + i];
      this.prefetchWidget(widget, i + 1);
    }

    this.logPrefetch(`✅ Prefetched ${prefetchCount} widgets from new page`);
  }

  /**
   * Get prefetch statistics
   */
  getStats(): {lastPrefetchedIndex: number} {
    return {
      lastPrefetchedIndex: this.lastPrefetchedIndex,
    };
  }

  /**
   * Reset prefetch state (useful for feed refresh)
   */
  reset(): void {
    this.lastPrefetchedIndex = -1;
    this.logPrefetch('🔄 Controller reset');
  }
}
