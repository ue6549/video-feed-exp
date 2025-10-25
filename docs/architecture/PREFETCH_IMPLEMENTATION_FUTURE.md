# Prefetch Implementation & Future Work

## Technical Implementation Details

### FeedPrefetchController Architecture

The `FeedPrefetchController` extends the base `PrefetchController` class and implements vertical feed scrolling prefetch logic.

#### Key Components

```typescript
class FeedPrefetchController extends PrefetchController {
  private lastPrefetchedIndex: number = -1;
  
  constructor() {
    super('FEED', 0); // Top-level controller, no parent priority
  }
  
  // Main entry point for scroll events
  handleVisibleIndicesChanged(visibleIndices: number[], feedData: IFeedItem[]): void
  
  // Widget-specific prefetch strategies
  private prefetchWidget(widget: IFeedItem, distance: number): void
  private prefetchCarousel(widget: IFeedItem, widgetIndex: number, priority: number): void
  private prefetchShortVideo(widget: IFeedItem, widgetIndex: number, priority: number): void
  
  // Lifecycle hooks
  onInitialLoad(feedData: IFeedItem[]): void
  onPageLoad(allFeedData: IFeedItem[], newPageStartIndex: number): void
}
```

**Location**: `rn_app/services/FeedPrefetchController.ts`

#### Priority Calculation Algorithm

```typescript
// Distance-based priority calculation
const distancePriority = 100 - distance * 10;

// Carousel strategy
// First N videos: basePriority (high)
// Remaining videos: 10 (low)
this.prefetchVideos(initialVideos, basePriority);  // High priority
this.prefetchVideos(remainingVideos, 10);          // Low priority
```

**Code Reference**: Lines 76-149 in `FeedPrefetchController.ts`

### PrefetchManager Priority Queue

The `PrefetchManager` manages the priority queue and concurrent downloads.

#### Queue Management

```typescript
class PrefetchManager {
  private queue: PrefetchRequest[] = [];
  private activeDownloads = new Map<string, AbortController>();
  private statusMap = new Map<string, PrefetchStatus>();
  
  async prefetchVideo(
    videoId: string,
    videoUrl: string,
    videoType: 'VOD' | 'LIVE',
    priority: number
  ): Promise<void>
  
  private async processQueue(): Promise<void>
}
```

**Location**: `rn_app/services/PrefetchManager.ts`

#### Priority Queue Processing

**Algorithm**:
1. Sort queue by priority (descending)
2. Process up to `maxConcurrent` downloads simultaneously
3. Track active downloads with AbortController
4. Update status on completion/error
5. Process next items from queue

**Code Reference**: Lines 192-250 in `PrefetchManager.ts`

### AVAsset Prefetching API Usage

#### iOS Implementation

The native iOS implementation uses AVPlayer's native prefetching:

```swift
// Load asset values asynchronously
let asset = AVURLAsset(url: videoURL)
asset.loadValuesAsynchronously(forKeys: ["playable", "duration"]) {
    // Asset is ready for playback
    // KTVHTTPCache proxy URL is automatically used
}
```

**Benefits**:
- Native iOS optimization
- Automatic cache integration
- Network-aware prefetching
- Background download support

### KTVHTTPCache Integration

#### Cache Manager Bridge

```typescript
class CacheManager {
  // Generate proxy URL for video
  async generateProxyURL(originalURL: string): Promise<string | null>
  
  // Check cache status
  getCacheStatus(url: string): 'cached' | 'downloading' | 'not_cached'
  
  // Clear cache
  clearCache(): Promise<void>
}
```

**Location**: `rn_app/services/CacheManager.ts`

#### Proxy URL Generation Flow

```
Original Video URL
    ↓
KTVHTTPCache Check (disk + memory)
    ↓
Proxy URL Generation
    ↓
AVPlayer uses Proxy URL
    ↓
KTVHTTPCache downloads segments
    ↓
Segments cached on disk
```

### Widget-Specific Prefetch Strategies

#### Short Video Widget

```typescript
private prefetchShortVideo(
  widget: IFeedItem,
  widgetIndex: number,
  priority: number
): void {
  const video = widget.data as VideoData;
  const videoId = generateVideoId(widgetIndex, 0);
  
  this.prefetchVideos([{
    id: videoId,
    url: video.videoSource.url,
    type: video.videoSource.videoType,
  }], priority);
}
```

**Characteristics**:
- Single video per widget
- High priority based on distance
- Prefetch when entering prefetch range

#### Carousel Widget

```typescript
private prefetchCarousel(
  widget: IFeedItem,
  widgetIndex: number,
  basePriority: number
): void {
  const videos = widget.data as VideoData[];
  const maxInitial = AppConfig.config.prefetch.carousel?.initialVideos ?? 2;
  
  // High priority: First N videos
  const initialVideos = videos.slice(0, maxInitial).map((v, idx) => ({
    id: generateVideoId(widgetIndex, idx),
    url: v.videoSource.url,
    type: v.videoSource.videoType,
  }));
  this.prefetchVideos(initialVideos, basePriority);
  
  // Low priority: Remaining videos
  const remainingVideos = videos.slice(maxInitial).map((v, idx) => ({
    id: generateVideoId(widgetIndex, idx + maxInitial),
    url: v.videoSource.url,
    type: v.videoSource.videoType,
  }));
  this.prefetchVideos(remainingVideos, 10);
}
```

**Characteristics**:
- First 2 videos: High priority (initially visible)
- Remaining videos: Low priority (for horizontal scroll)
- Strategies for horizontal prefetch

### Prefetch Initiation Flow

#### Initial Load

```typescript
onInitialLoad(feedData: IFeedItem[]): void {
  // Simulate first widget visible
  this.handleVisibleIndicesChanged([0], feedData);
}
```

**Location**: Lines 154-165 in `FeedPrefetchController.ts`

#### Scroll Events

```typescript
handleVisibleIndicesChanged(
  visibleIndices: number[],
  feedData: IFeedItem[]
): void {
  const lastVisible = Math.max(...visibleIndices);
  const range = AppConfig.config.visibility.prefetchRange;
  const prefetchUntil = lastVisible + range;
  
  // Prefetch forward only
  for (let i = Math.max(this.lastPrefetchedIndex + 1, lastVisible + 1); 
       i <= prefetchUntil; 
       i++) {
    this.prefetchWidget(feedData[i], i - lastVisible);
  }
}
```

**Location**: Lines 30-68 in `FeedPrefetchController.ts`

### Performance Considerations

#### Throttling and Timing

- **Scroll Events**: Handled by RecyclerListView native module
- **Prefetch Timing**: Triggered on visible indices change
- **Concurrent Downloads**: Limited to 3 simultaneous downloads
- **Queue Processing**: Asynchronous, non-blocking

#### Memory Management

- **Cache Size**: Limited by `AppConfig.config.cache.maxSizeMB` (default: 500MB)
- **LRU Eviction**: Oldest segments evicted when cache full
- **AbortController**: Cancels active downloads when needed
- **Status Tracking**: Minimal memory footprint per request

#### Network Bandwidth Management

- **Priority Sorting**: Higher priority videos downloaded first
- **Concurrent Limits**: Max 3 downloads prevents bandwidth saturation
- **VOD-Only Mode**: Skips LIVE streams to save bandwidth
- **Segment-Based**: Only downloads N segments per video (default: 2)

## Platform-Agnostic Patterns

### Generic Prefetch Controller Interface

```typescript
abstract class PrefetchController {
  protected name: string;
  protected parentPriority: number;
  
  protected prefetchVideos(
    videos: PrefetchVideo[],
    basePriority: number
  ): void
  
  protected logPrefetch(message: string): void
}
```

**Benefits**:
- Reusable across different scroll contexts
- Priority propagation support
- Nested controller architecture
- Type-safe implementation

### Priority Propagation System

**Parent to Child**: Priority values propagate from parent to child controllers

```
FeedPrefetchController (priority: 0)
  └─ CarouselPrefetchController (inherits parent priority)
       └─ Individual videos (parent priority + base priority)
```

**Code Reference**: Lines 41-52 in `PrefetchController.ts`

## Future POC Considerations for Android

### ExoPlayer Prefetch Capabilities

#### Android Implementation Strategy

```kotlin
// ExoPlayer prefetching
val exoPlayer = ExoPlayer.Builder(context).build()
val mediaItem = MediaItem.fromUri(videoUrl)

// ExoPlayer's internal prefetching
exoPlayer.setMediaItem(mediaItem)
exoPlayer.prepare()

// Custom prefetch cache
val cache = SimpleCache(
    cacheDirectory,
    LeastRecentlyUsedCacheEvictor(maxCacheSize)
)
```

**Key Differences**:
- ExoPlayer vs AVPlayer APIs
- Android cache system (File-based vs SQLite)
- Background download restrictions

### Cache Implementation Options

#### Option 1: ExoPlayer SimpleCache
- Built-in cache manager
- LRU eviction support
- Simpler integration
- Limited control

#### Option 2: Custom Cache Layer
- Full control over caching
- More complexity
- Custom prefetch logic
- Better optimization

## Scope for Improvements

### Nested Prefetch Controllers (HIGH PRIORITY)

**Current Limitation**: No horizontal scroll prefetch for carousels

**Proposed Solution**: CarouselPrefetchController

```typescript
class CarouselPrefetchController extends PrefetchController {
  private parentWidgetIndex: number;
  
  constructor(parentPriority: number, widgetIndex: number) {
    super('CAROUSEL', parentPriority);
    this.parentWidgetIndex = widgetIndex;
  }
  
  handleHorizontalScroll(currentIndex: number, videos: VideoData[]): void {
    // Prefetch next N videos based on horizontal scroll
    const lookahead = AppConfig.config.prefetch.carousel.horizontalLookahead;
    // ... prefetch logic
  }
}
```

**Challenges**:
1. **Horizontal Scroll Detection**: Integrate with RecyclerListView horizontal scroll
2. **Parent Priority Propagation**: Inherit feed-level priority
3. **Balancing**: Prefetch feed vs horizontal carousel prefetch
4. **Resource Management**: Coordinate between vertical and horizontal prefetch

**Architecture**:
```
FeedPrefetchController
  ├─ Detects carousel widget
  ├─ Creates CarouselPrefetchController
  └─ Manages nested prefetch coordination
  
CarouselPrefetchController
  ├─ Inherits feed priority
  ├─ Manages horizontal prefetch
  └─ Independent prefetch coordination
```

### AVAssetDownloadTask & HLS Download APIs (HIGH PRIORITY)

**Alternative to KTVHTTPCache**: Native iOS HLS download support

#### AVAssetDownloadTask Advantages

1. **Native API**: Built into AVFoundation
2. **Better HLS Support**: Optimized for HLS streams
3. **Offline Playback**: Download complete playlists
4. **Background Downloads**: Download while app backgrounded
5. **Progress Tracking**: Built-in download progress

#### Implementation Considerations

```swift
// AVAssetDownloadTask usage
let downloadURL = AVURLAsset(url: videoURL)
let downloadTask = URLSession.shared.downloadTask(with: downloadURL.url)

// Track download progress
downloadTask.progress.observe(\.fractionCompleted) { progress, _ in
    // Update progress
}
```

#### Comparison: AVAssetDownloadTask vs KTVHTTPCache

| Feature | KTVHTTPCache | AVAssetDownloadTask |
|---------|--------------|---------------------|
| Integration | Third-party pod | Native iOS |
| HLS Support | Proxy-based | Direct HLS support |
| Offline Playback | Limited | Full support |
| Background Downloads | Yes | Yes |
| Cache Control | Manual | Automatic |
| API Complexity | Medium | High |

#### Migration Strategy

**Phase 1**: Proof of Concept
- Implement AVAssetDownloadTask alongside KTVHTTPCache
- A/B test performance and reliability
- Measure cache hit rates and download speeds

**Phase 2**: Gradual Migration
- Use AVAssetDownloadTask for new features
- Keep KTVHTTPCache as fallback
- Monitor for compatibility issues

**Phase 3**: Complete Migration
- Replace KTVHTTPCache entirely
- Update all prefetch logic to use AVAssetDownloadTask
- Remove KTVHTTPCache dependency

### Adaptive Prefetch Based on Network Conditions

**Current**: Fixed prefetch window and priorities

**Proposed**: Dynamic adjustment based on network quality

```typescript
interface NetworkConditions {
  bandwidth: 'high' | 'medium' | 'low';
  latency: number;
  packetLoss: number;
}

const adaptivePrefetch = {
  high: { prefetchRange: 8, maxConcurrent: 5 },
  medium: { prefetchRange: 5, maxConcurrent: 3 },
  low: { prefetchRange: 2, maxConcurrent: 1 },
};
```

### User Behavior Prediction

**Proposed**: Machine learning or heuristic-based prediction

1. **Scroll Velocity Analysis**: Predict scroll direction and speed
2. **Watch Time Patterns**: Learn which content users typically watch
3. **Interactive Elements**: Prefetch content near interactive elements
4. **Time-Based**: Adjust prefetch based on time of day, day of week

### Prefetch Cancellation for Off-Screen Content

**Current**: Videos stay in queue even when scrolled away

**Proposed**: Automatic cancellation for off-screen content

```typescript
// Cancel prefetch when video scrolls out of prefetch range
if (distance > prefetchRange + 2) {
  PrefetchManager.cancelPrefetch(videoUrl);
}
```

### Multi-Quality Prefetch

**Strategy**: Low-res first, then high-res

```typescript
// Prefetch low quality first
await prefetchVideo(videoId, lowQualityURL, priority + 10);

// Prefetch high quality later
await prefetchVideo(videoId, highQualityURL, priority);
```

### Prefetch Analytics and Optimization

**Metrics to Track**:
- Cache hit rate
- Prefetch completion time
- Network bandwidth usage
- Memory usage
- Playback start delay

**Optimization**:
- Tune prefetch window based on analytics
- Adjust priority algorithms
- Optimize concurrent download limits

### Background Prefetch During Idle Time

**Proposed**: Prefetch videos when app is idle

```typescript
// Background prefetch during idle time
const idleTime = Date.now() - lastUserInteraction;

if (idleTime > IDLE_THRESHOLD) {
  // Prefetch ahead
  const nextWidgets = feedData.slice(currentIndex, currentIndex + 10);
  nextWidgets.forEach(widget => prefetchWidget(widget));
}
```

### Collaborative Prefetch (Share Cache Between Users)

**Concept**: Share prefetched content between users on same network

**Challenges**:
- Privacy and security
- Network coordination
- Cache invalidation
- Implementation complexity

## Performance Considerations

### Prefetch Timing and Throttling

**Current Implementation**:
- Triggered on every scroll event with visible indices
- Throttled by RecyclerListView native module (50ms)
- Queue processing is asynchronous

**Optimizations**:
- Debounce rapid scroll events
- Batch prefetch requests
- Prioritize imminent visibility

### Memory Usage Optimization

**Current Strategies**:
- Limit cache size (500MB)
- LRU eviction
- Concurrent download limits

**Future Optimizations**:
- Compress cached segments
- Predictive cache eviction
- Memory pressure monitoring

### Network Bandwidth Management

**Current Approach**:
- VOD-only prefetch
- Priority-based queue
- Max 3 concurrent downloads

**Future Enhancements**:
- Bandwidth detection
- Adaptive quality
- Night mode (aggressive prefetch on WiFi)

## Summary

The prefetch system provides a robust, scalable foundation for smooth video playback. Key areas for future improvement include nested prefetch controllers for horizontal scroll, AVAssetDownloadTask integration for better HLS support, and adaptive prefetch strategies based on network conditions and user behavior.

**Related Documentation**:
- [Prefetch System Overview](PREFETCH_SYSTEM_OVERVIEW.md)
- [Prefetch Requirements & Design](PREFETCH_REQUIREMENTS_DESIGN.md)
- [Playback System Documentation](./PLAYBACK_SYSTEM_OVERVIEW.md)
