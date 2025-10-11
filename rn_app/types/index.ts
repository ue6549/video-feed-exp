// Shared types for the video feed app

export interface VideoSource {
  sourceType: string;
  url: string;
  type: string;
  videoType: 'VOD' | 'LIVE'; // Added for VOD/LIVE detection
}

export interface Thumbnail {
  width: number;
  aspectRatio: string;
  type: string;
  height: number;
  dynamicImageUrl: string;
}

export interface VideoData {
  videoSource: VideoSource;
  thumbail: Thumbnail;
}

export interface IFeedItem {
  id: string;
  widgetType: string; // 'short' | 'carousel' | 'merch'
  widgetIndex?: number; // Position in the feed (for video ID generation)
  color: string;
  data: VideoData | VideoData[] | Thumbnail;
}

// Widget types
export type WidgetType = 'short' | 'carousel' | 'merch' | 'default';

// Visibility states
export enum VisibilityState {
  PREFETCH = 'prefetch',
  WILL_MOUNT = 'willMount',
  SOFT_PLAY = 'softPlay',
  ACTIVE = 'active',
  SOFT_PAUSE = 'softPause',
  HARD_PAUSE = 'hardPause',
  WILL_UNMOUNT = 'willUnmount',
  OFFSCREEN = 'offscreen',
}

// Video player states
export interface VideoState {
  isPlaying: boolean;
  type: 'VOD' | 'LIVE';
  category: WidgetType;
  visibilityState: VisibilityState;
}

// Prefetch related types
export interface PrefetchRequest {
  videoUrl: string;
  videoType: 'VOD' | 'LIVE';
  priority: number;
  segmentCount: number;
}

export interface PrefetchStatus {
  videoId: string;
  state: 'queued' | 'downloading' | 'completed' | 'cancelled' | 'failed';
  progress: number; // 0-100
  segmentsDownloaded: number;
  totalSegments: number;
}

// Cache related types
export interface SegmentInfo {
  url: string;
  duration: number;
  sequence: number;
}

export interface ManifestTemplate {
  version: string;
  targetDuration: number;
  mediaSequence: number;
  playlistType: 'VOD' | 'EVENT';
  template: string;
}

// Device performance types
export interface DevicePerformanceInfo {
  isLowEnd: boolean;
  availableMemory: number;
  processorCount: number;
  deviceModel: string;
}

// Offline support types
export interface OfflineVideoInfo {
  videoUrl: string;
  cachedSegments: SegmentInfo[];
  isFullyCached: boolean;
  manifestUrl?: string;
}

// Navigation types
export interface NavigationProps {
  navigation: any;
  route: any;
}

// Configuration types
export interface ConfigChangeEvent {
  key: string;
  oldValue: any;
  newValue: any;
  requiresReload: boolean;
}

// Metrics and observability types
export interface VideoMetrics {
  videoId: string;
  playId: string;
  loadTime: number;
  startupTime: number;
  stallCount: number;
  totalStallTime: number;
  timeToFirstStall: number;
  videoType: 'VOD' | 'LIVE';
  category: WidgetType;
  timestamp: number;
}

export interface PerformanceMetrics {
  memoryUsage: number;
  cpuUsage: number;
  activePlayers: number;
  cachedVideos: number;
  prefetchQueue: number;
  timestamp: number;
}

// Error types
export interface VideoError {
  videoId: string;
  error: string;
  errorCode?: string;
  timestamp: number;
  context?: any;
}

