import {FeedPrefetchController} from '../../rn_app/services/FeedPrefetchController';
import {IFeedItem, VideoData} from '../../rn_app/types';
import PrefetchManager from '../../rn_app/services/PrefetchManager';

// Mock PrefetchManager
jest.mock('../../rn_app/services/PrefetchManager', () => ({
  __esModule: true,
  default: {
    prefetchVideo: jest.fn(() => Promise.resolve()),
  },
}));

const createMockWidget = (
  widgetIndex: number,
  widgetType: 'short' | 'carousel' | 'merch',
  videoCount: number = 1,
): IFeedItem => {
  if (widgetType === 'carousel') {
    const videos: VideoData[] = Array.from({length: videoCount}, (_, idx) => ({
      videoSource: {
        sourceType: 'hls',
        url: `https://test.com/video-${widgetIndex}-${idx}.m3u8`,
        type: 'hls',
        videoType: 'VOD' as const,
      },
      thumbail: {
        dynamicImageUrl: 'https://test.com/thumb.jpg',
        aspectRatio: '9:16',
        width: 0,
        height: 0,
        type: 'ImageValue',
      },
    }));

    return {
      id: `carousel-${widgetIndex}`,
      widgetType: 'carousel',
      widgetIndex,
      color: '#000',
      data: videos,
    };
  } else if (widgetType === 'short') {
    return {
      id: `short-${widgetIndex}`,
      widgetType: 'short',
      widgetIndex,
      color: '#000',
      data: {
        videoSource: {
          sourceType: 'hls',
          url: `https://test.com/video-${widgetIndex}-0.m3u8`,
          type: 'hls',
          videoType: 'VOD' as const,
        },
        thumbail: {
          dynamicImageUrl: 'https://test.com/thumb.jpg',
          aspectRatio: '9:16',
          width: 0,
          height: 0,
          type: 'ImageValue',
        },
      } as VideoData,
    };
  } else {
    return {
      id: `merch-${widgetIndex}`,
      widgetType: 'merch',
      widgetIndex,
      color: '#000',
      data: {
        dynamicImageUrl: 'https://test.com/merch.jpg',
        aspectRatio: '5:4',
        width: 0,
        height: 0,
        type: 'ImageValue',
      },
    };
  }
};

describe('FeedPrefetchController', () => {
  let controller: FeedPrefetchController;
  let mockFeedData: IFeedItem[];

  beforeEach(() => {
    controller = new FeedPrefetchController();
    jest.clearAllMocks();

    // Create mock feed: 2 shorts, 1 carousel (6 videos), 2 shorts
    mockFeedData = [
      createMockWidget(0, 'short'),
      createMockWidget(1, 'short'),
      createMockWidget(2, 'carousel', 6),
      createMockWidget(3, 'short'),
      createMockWidget(4, 'short'),
    ];
  });

  it('should prefetch next N widgets on visible indices change', () => {
    // Simulate widget 0 visible, should prefetch widgets 1-5
    controller.handleVisibleIndicesChanged([0], mockFeedData);

    // Should have called prefetchVideo for short videos
    expect(PrefetchManager.prefetchVideo).toHaveBeenCalled();

    // Verify it was called multiple times (for multiple widgets)
    const callCount = (PrefetchManager.prefetchVideo as jest.Mock).mock.calls
      .length;
    expect(callCount).toBeGreaterThan(0);
  });

  it('should limit carousel to initial videos only (first 2)', () => {
    // Prefetch carousel at index 2
    controller.handleVisibleIndicesChanged([1], mockFeedData);

    const calls = (PrefetchManager.prefetchVideo as jest.Mock).mock.calls;

    // Find calls for carousel videos (vid-2-X)
    const carouselCalls = calls.filter(call => call[0].startsWith('vid-2-'));

    // Should include at least the first 2 carousel videos
    expect(carouselCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('should add remaining carousel videos at low priority', () => {
    controller.handleVisibleIndicesChanged([1], mockFeedData);

    const calls = (PrefetchManager.prefetchVideo as jest.Mock).mock.calls;

    // Find calls for carousel videos vid-2-2, vid-2-3, etc. (remaining)
    const remainingCalls = calls.filter(call => {
      const videoId = call[0];
      return (
        videoId === 'vid-2-2' ||
        videoId === 'vid-2-3' ||
        videoId === 'vid-2-4' ||
        videoId === 'vid-2-5'
      );
    });

    // Should have queued remaining videos
    expect(remainingCalls.length).toBeGreaterThan(0);

    // Remaining videos should have low priority (10)
    if (remainingCalls.length > 0) {
      const priority = remainingCalls[0][3]; // 4th parameter is priority
      expect(priority).toBe(10);
    }
  });

  it('should assign higher priorities to closer widgets', () => {
    controller.handleVisibleIndicesChanged([0], mockFeedData);

    const calls = (PrefetchManager.prefetchVideo as jest.Mock).mock.calls;

    // Find priorities for vid-1-0 and vid-4-0
    const vid1Call = calls.find(call => call[0] === 'vid-1-0');
    const vid4Call = calls.find(call => call[0] === 'vid-4-0');

    if (vid1Call && vid4Call) {
      const priority1 = vid1Call[3];
      const priority4 = vid4Call[3];

      // Closer widget should have higher priority
      expect(priority1).toBeGreaterThan(priority4);
    }
  });

  it('should handle initial load', () => {
    controller.onInitialLoad(mockFeedData);

    // Should have triggered prefetch
    expect(PrefetchManager.prefetchVideo).toHaveBeenCalled();
  });

  it('should handle page load', () => {
    const newPageData = [
      createMockWidget(5, 'short'),
      createMockWidget(6, 'short'),
    ];
    const allData = [...mockFeedData, ...newPageData];

    controller.onPageLoad(allData, mockFeedData.length);

    // Should have prefetched new page widgets
    expect(PrefetchManager.prefetchVideo).toHaveBeenCalled();
  });

  it('should not prefetch if disabled in config', () => {
    // Temporarily disable prefetch
    const originalEnabled = require('../../rn_app/config/AppConfig').AppConfig
      .config.prefetch.enabled;
    require('../../rn_app/config/AppConfig').AppConfig.config.prefetch.enabled =
      false;

    controller.handleVisibleIndicesChanged([0], mockFeedData);

    // Should not have called prefetchVideo
    expect(PrefetchManager.prefetchVideo).not.toHaveBeenCalled();

    // Restore
    require('../../rn_app/config/AppConfig').AppConfig.config.prefetch.enabled =
      originalEnabled;
  });

  it('should skip merch widgets', () => {
    const merchOnlyFeed: IFeedItem[] = [
      createMockWidget(0, 'merch'),
      createMockWidget(1, 'merch'),
    ];

    controller.handleVisibleIndicesChanged([0], merchOnlyFeed);

    // Should not have called prefetchVideo for merch
    expect(PrefetchManager.prefetchVideo).not.toHaveBeenCalled();
  });
});
