# Prefetch Requirements & Design

## Requirements Breakdown

### Core Requirements

1. **Prefetch Before Viewport**: Videos must be prefetched before they enter the viewport
2. **Priority-Based Loading**: Higher priority for closer or more visible content
3. **Widget-Aware Strategy**: Different prefetch strategies for different widget types
4. **Cache Integration**: Leverage KTVHTTPCache for efficient segment caching
5. **Resource Optimization**: Avoid excessive network and memory usage

### Functional Requirements

#### 1. Vertical Feed Prefetch
- Prefetch next N widgets (configurable, default: 5)
- Calculate priority based on distance from viewport
- Only prefetch forward (don't re-prefetch processed widgets)
- Handle initial load and pagination

#### 2. Widget-Specific Prefetch
- **Shorts**: Single video, high priority
- **Carousels**: First 2 videos high priority, remaining low priority
- **Merch**: Skip (no video content)

#### 3. Priority Calculation
- Formula: `Priority = Parent Priority + (100 - distance * 10)`
- Distance: Widgets ahead of viewport (1, 2, 3, ...)
- Result: Higher priority for closer widgets

#### 4. Concurrent Downloads
- Maximum concurrent prefetch downloads (default: 3)
- Priority queue management
- Automatic cancellation on low priority

### Non-Functional Requirements

- **Performance**: Prefetch should not impact scroll performance
- **Network Efficiency**: Use intelligent throttling and prioritization
- **Memory Management**: Avoid memory bloat from excessive prefetching
- **Battery Efficiency**: Optimize network usage to preserve battery

## Design Decisions and Rationale

### AVPlayer vs AVAssetDownloadTask for Prefetch

When implementing video prefetching, we evaluated two primary approaches:

| Aspect | AVPlayer | AVAssetDownloadTask |
|--------|----------|---------------------|
| **Resource Usage** | Heavy (rendering pipeline, audio session, time observers) | Light (download only, no playback overhead) |
| **Progress Tracking** | Byte-based (via KVO on loadedTimeRanges) | Time-based (CMTimeRange in delegate) |
| **Integration** | Tight with playback (same API surface) | Separate from playback (dedicated download API) |
| **Cancellation** | Complex teardown (remove observers, deallocate player) | Clean cancel (task.cancel(), simple cleanup) |
| **Use Case** | Streaming prefetch (player-driven loading) | Download prefetch (explicit download control) |
| **Memory Footprint** | ~5-8MB per instance (full player stack) | ~2-3MB per task (download manager only) |
| **Background Support** | Limited (requires audio session) | Native (URLSession background mode) |
| **Cache Integration** | Automatic with KTVHTTPCache proxy | Requires KTV proxy OR local .movpkg storage |

**Current Implementation**: AVPlayer-based prefetch (dummy instances)

**Selected for Migration**: AVAssetDownloadTask + KTVHTTPCache

**Rationale for Migration**:
1. **30-40% lighter resource usage** - No rendering pipeline overhead
2. **Better progress tracking** - Time-based cancellation more precise than byte-based
3. **Cleaner cancellation** - Simple task.cancel() vs complex player teardown
4. **Native background support** - URLSession handles backgrounding automatically
5. **Maintains KTV benefits** - Keep existing cache infrastructure
6. **No playback changes** - VideoPlayerView continues using KTV proxy URLs

See [PREFETCH_IMPLEMENTATION_FUTURE.md](PREFETCH_IMPLEMENTATION_FUTURE.md) for detailed approach evaluation.

### AVPlayer-Based Prefetch (Legacy)

**Implementation**: Dummy AVPlayer instances

**How It Works**:
- Create AVPlayer with video URL (via KTV proxy)
- AVPlayer automatically begins loading asset
- Monitor loading progress via KVO
- Cancel/release player after threshold
- KTVHTTPCache caches segments during loading

**Pros**:
- ✅ Works well with current architecture
- ✅ Tight integration with playback
- ✅ Proven, stable approach

**Cons**:
- ❌ Heavy resource usage
- ❌ Complex teardown
- ❌ Byte-based progress (less precise)

### Widget-Based vs Video-Based Prefetch

**Decision**: Widget-based prefetch with video-level priority

**Rationale**:
- **Content Organization**: Widgets are natural content boundaries
- **Strategic Loading**: Different widget types have different visibility patterns
- **Scalability**: Easy to add new widget types
- **User Experience**: Aligns with user's content consumption patterns

**Alternative Considered**: Video-level only prefetch
- Less context-aware
- Doesn't optimize for different content types

### Priority Calculation Algorithm

**Formula**: `Priority = Parent Priority + (100 - distance * 10)`

**Parameters**:
- **Parent Priority**: 0 for feed controller, propagates to nested controllers
- **Distance**: Number of widgets ahead (1 = next, 2 = after next, etc.)
- **Base Priority**: Distance-based calculation (100 - distance * 10)

**Example Priorities**:
- Widget at distance 1: 90 (high priority)
- Widget at distance 2: 80 (medium priority)
- Widget at distance 3: 70 (lower priority)
- Carousel remaining videos: 10 (very low priority)

**Rationale**:
- Simple and predictable
- Provides enough granularity for priority sorting
- Maintains hierarchy across nested controllers

### Prefetch Window Size

**Decision**: Default 5 widgets ahead

**Rationale**:
- **Balance**: Enough headroom for smooth scrolling without excessive prefetch
- **Network Efficiency**: Doesn't overwhelm network with too many concurrent downloads
- **Memory Management**: Limited prefetch buffer prevents memory issues
- **User Behavior**: Most users scroll at a predictable pace

**Configuration**: Tunable via `AppConfig.config.visibility.prefetchRange`

### Carousel Initial Videos Strategy

**Decision**: Prefetch first 2 videos at high priority, rest at low priority

**Rationale**:
- **Initial Visibility**: First 2 videos are initially visible in carousel
- **User Behavior**: Most users view 1-3 videos in a carousel
- **Network Efficiency**: Prefetch remaining videos only if needed (horizontal scroll)
- **Memory Optimization**: Avoids prefetching entire carousel unnecessarily

**Configuration**: `AppConfig.config.prefetch.carousel.initialVideos`

### VOD-Only Prefetch

**Decision**: Prefetch VOD videos only by default, skip LIVE videos

**Rationale**:
- **LIVE Content**: LIVE streams are continuous and don't benefit from prefetch
- **Network Efficiency**: Avoids unnecessary bandwidth for non-cacheable content
- **Resource Conservation**: Saves network and battery on high-frequency updates
- **Configuration**: Can be disabled via `AppConfig.config.prefetch.vodOnly`

## Configuration Options

### Prefetch Configuration

```typescript
prefetch: {
  enabled: boolean;              // Enable/disable prefetch globally
  vodOnly: boolean;              // Prefetch VOD only, skip LIVE
  segmentCount: number;          // Number of segments to prefetch
  maxConcurrent: number;         // Max concurrent prefetch downloads
  priorities: string[];          // Priority order: ['short', 'carousel', 'merch']
  strategy: 'auto' | 'avplayer' | 'manifest';
  carousel: {
    initialVideos: number;       // Videos to prefetch when carousel appears
    horizontalLookahead: number; // Future: horizontal scroll prefetch
  };
}
```

### Visibility Configuration

```typescript
visibility: {
  prefetchRange: number;         // Number of widgets to prefetch ahead (default: 5)
  // ... other visibility thresholds
}
```

### Cache Configuration

```typescript
cache: {
  maxSizeMB: number;             // Maximum cache size
  strategy: 'LRU';               // Cache eviction strategy
  manifestTemplateId: string;    // HLS manifest template
}
```

## Widget-Specific Prefetch Rules

### Shorts Widget
- **Videos**: 1 per widget
- **Priority**: Distance-based (100 - distance * 10)
- **Timing**: Prefetch when widget enters prefetch range

### Carousel Widget
- **Initial Videos**: First 2 at high priority
- **Remaining Videos**: Low priority (10) for horizontal scroll
- **Timing**: Initial prefetch on widget visibility, remaining on demand

### Merch Widget
- **Videos**: None (image content only)
- **Action**: Skip prefetch

## Prefetch State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                     Prefetch Lifecycle                       │
└─────────────────────────────────────────────────────────────┘

         Widget enters prefetch range
                      │
                      ▼
         ┌──────────────────────────┐
         │     QUEUED               │
         │  - Priority calculated   │
         │  - Added to priority     │
         │    queue                 │
         └────────┬─────────────────┘
                  │
                  │ (priority-based)
                  ▼
         ┌──────────────────────────┐
         │   DOWNLOADING            │
         │  - Concurrent download   │
         │  - KTVHTTPCache active   │
         │  - Segments downloading  │
         └────────┬─────────────────┘
                  │
                  │ (completed)
                  ▼
         ┌──────────────────────────┐
         │   COMPLETED              │
         │  - Cached in KTVHTTPCache│
         │  - Ready for playback    │
         │  - Proxy URL generated   │
         └──────────────────────────┘
                  │
                  │ (error or cancelled)
                  ▼
         ┌──────────────────────────┐
         │   FAILED/CANCELLED       │
         │  - Cleanup resources     │
         │  - Remove from queue     │
         └──────────────────────────┘
```

## Cache Integration Design

### KTVHTTPCache Integration

**Purpose**: Efficient HLS segment caching and proxy server management

**Key Features**:
1. **Proxy Server**: Generates local proxy URLs for remote HLS streams
2. **Segment Cache**: Stores downloaded HLS segments on disk
3. **Automatic Management**: Handles cache eviction and size limits
4. **Background Downloads**: Continues downloading in background

**Flow**:
```
Original URL → KTVHTTPCache → Proxy URL → AVPlayer → Segment Cache → Disk Storage
```

### Cache Coordination

- PrefetchManager triggers prefetch
- KTVHTTPCache receives proxy URL request
- Cache checks disk for existing segments
- Downloads missing segments
- Stores segments with LRU eviction
- Returns proxy URL for playback

## Priority Queue Management

### Queue Structure

```typescript
interface PrefetchRequest {
  videoId: string;        // Clean video ID
  videoUrl: string;       // Actual video URL
  videoType: 'VOD' | 'LIVE';
  priority: number;       // Calculated priority
  segmentCount: number;   // Segments to prefetch
}
```

### Queue Operations

1. **Enqueue**: Add request to queue with priority
2. **Sort**: Sort by priority descending (highest first)
3. **Dequeue**: Process highest priority requests
4. **Concurrent Processing**: Max 3 concurrent downloads
5. **Cancellation**: Cancel low-priority requests if queue grows

## Next Steps

For implementation details, see:
- [Prefetch System Overview](PREFETCH_SYSTEM_OVERVIEW.md)
- [Prefetch Implementation & Future Work](PREFETCH_IMPLEMENTATION_FUTURE.md)
