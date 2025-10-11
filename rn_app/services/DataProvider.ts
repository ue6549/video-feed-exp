import { IFeedItem, VideoData, Thumbnail } from '../types';
import { AppConfig } from '../config/AppConfig';

// Raw video data from the JSON file
interface RawVideoData {
  video_source: {
    sourceType: string;
    type: string;
    resolution: number;
    url: string;
    videoType: 'VOD' | 'LIVE';
  };
  thumbail: Thumbnail;
}

class DataProvider {
  private allWidgets: IFeedItem[] = [];
  private currentPage = 0;
  private isInitialized = false;

  constructor(private rawVideos: RawVideoData[]) {
    this.initializeWidgets();
  }

  /**
   * Transform raw video data into feed widgets
   * Every 4th widget is a carousel (6 videos)
   * Random merch insertion
   */
  private initializeWidgets(): void {
    const widgets: IFeedItem[] = [];
    let i = 0;
    let stepSinceLastMerch = 0;

    while (i < this.rawVideos.length) {
      const widgetIndex = widgets.length; // Current position in feed
      
      // Random merch insertion (25% chance after 2+ steps)
      if (stepSinceLastMerch > 2 && Math.random() > 0.75) {
        stepSinceLastMerch = 0;
        const merchWidget = this.createMerchWidget(i, widgetIndex);
        widgets.push(merchWidget);
      }
      // Every 4th widget is a carousel
      else if ((widgets.length + 1) % 4 === 0) {
        const carouselWidget = this.createCarouselWidget(i, widgetIndex);
        widgets.push(carouselWidget);
        i += 6; // Move index forward by 6 for carousel
        stepSinceLastMerch += 1;
      } 
      // Regular short video widget
      else {
        const shortWidget = this.createShortWidget(i, widgetIndex);
        widgets.push(shortWidget);
        i += 1;
        stepSinceLastMerch += 1;
      }
    }

    this.allWidgets = widgets;
    this.isInitialized = true;
  }

  private createShortWidget(index: number, widgetIndex?: number): IFeedItem {
    const video = this.rawVideos[index];
    return {
      id: `short-${index}`,
      widgetType: 'short',
      widgetIndex, // Track position in feed
      color: this.generateRandomColor(),
      data: {
        videoSource: {
          sourceType: video.video_source.sourceType,
          url: video.video_source.url,
          type: video.video_source.type,
          videoType: video.video_source.videoType,
        },
        thumbail: video.thumbail,
      } as VideoData,
    };
  }

  private createCarouselWidget(startIndex: number, widgetIndex?: number): IFeedItem {
    const carouselVideos = this.rawVideos.slice(startIndex, startIndex + 6);
    return {
      id: `carousel-${startIndex}`,
      widgetType: 'carousel',
      widgetIndex, // Track position in feed
      color: this.generateRandomColor(),
      data: carouselVideos.map(video => ({
        videoSource: {
          sourceType: video.video_source.sourceType,
          url: video.video_source.url,
          type: video.video_source.type,
          videoType: video.video_source.videoType,
        },
        thumbail: video.thumbail,
      })) as VideoData[],
    };
  }

  private createMerchWidget(index: number, widgetIndex?: number): IFeedItem {
    const imageUrl = `https://picsum.photos/seed/${Math.floor(Math.random() * 10)}/{@width}/{@height}`;
    return {
      id: `merch-${index}`,
      widgetType: 'merch',
      widgetIndex, // Track position in feed
      color: this.generateRandomColor(),
      data: {
        width: 0,
        type: "ImageValue",
        height: 0,
        aspectRatio: '5:4',
        dynamicImageUrl: imageUrl,
      } as Thumbnail,
    };
  }

  private generateRandomColor(): string {
    return `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`;
  }

  /**
   * Get a page of widgets with pagination
   */
  async getPage(page: number): Promise<IFeedItem[]> {
    if (!this.isInitialized) {
      throw new Error('DataProvider not initialized');
    }

    // Simulate network delay
    await this.simulateNetworkDelay();

    const pageSize = page === 0 
      ? AppConfig.config.feed.firstPageSize 
      : AppConfig.config.feed.subsequentPageSize;

    const start = page === 0 ? 0 : 
      AppConfig.config.feed.firstPageSize + 
      (page - 1) * AppConfig.config.feed.subsequentPageSize;

    const end = start + pageSize;
    const pageWidgets = this.allWidgets.slice(start, end);

    // Update current page
    this.currentPage = page;

    return pageWidgets;
  }

  /**
   * Get total number of pages available
   */
  getTotalPages(): number {
    if (!this.isInitialized) return 0;

    const firstPageSize = AppConfig.config.feed.firstPageSize;
    const subsequentPageSize = AppConfig.config.feed.subsequentPageSize;
    const totalWidgets = this.allWidgets.length;

    if (totalWidgets <= firstPageSize) {
      return 1;
    }

    const remainingWidgets = totalWidgets - firstPageSize;
    const subsequentPages = Math.ceil(remainingWidgets / subsequentPageSize);
    
    return 1 + subsequentPages;
  }

  /**
   * Get current page number
   */
  getCurrentPage(): number {
    return this.currentPage;
  }

  /**
   * Check if there are more pages available
   */
  hasMorePages(): boolean {
    return this.currentPage < this.getTotalPages() - 1;
  }

  /**
   * Get total number of widgets
   */
  getTotalWidgets(): number {
    return this.allWidgets.length;
  }

  /**
   * Simulate network delay for realistic pagination behavior
   */
  private async simulateNetworkDelay(): Promise<void> {
    const delay = 200 + Math.random() * 200; // 200-400ms
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Search widgets by type
   */
  getWidgetsByType(type: string): IFeedItem[] {
    return this.allWidgets.filter(widget => widget.widgetType === type);
  }

  /**
   * Get widget by ID
   */
  getWidgetById(id: string): IFeedItem | undefined {
    return this.allWidgets.find(widget => widget.id === id);
  }

  /**
   * Reset pagination state
   */
  reset(): void {
    this.currentPage = 0;
  }
}

export default DataProvider;

