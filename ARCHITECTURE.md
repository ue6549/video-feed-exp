# VideoFeedApp Architecture

## System Overview

VideoFeedApp is a React Native application for displaying a scrollable feed of videos with advanced features like visibility-based playback, video caching, offline support, and performance monitoring.

### Technology Stack

- **React Native:** 0.72.3
- **TypeScript:** 4.8.4
- **iOS:** Custom native modules (Swift + Objective-C)
- **Video Caching:** KTVHTTPCache 3.1.0
- **List Rendering:** RecyclerListView 4.2.3
- **Image Caching:** @d11/react-native-fast-image 8.12.0
- **Navigation:** React Navigation Stack 6.3.20

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     React Native Layer                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │ FeedScreen   │────▶│ VideoCard    │───▶│VideoPlayerView││
│  └──────────────┘     └──────────────┘    └──────┬────────┘ │
│                              │                     │          │
│  ┌──────────────┐     ┌──────▼────────┐          │          │
│  │SettingsModal │────▶│PlaybackManager│          │          │
│  └──────────────┘     └───────────────┘          │          │
│                                                    │          │
│  ┌──────────────┐     ┌──────────────┐           │          │
│  │DebugHUD      │────▶│ VideoMetrics │           │          │
│  │MetricsModal  │     └──────────────┘           │          │
│  └──────────────┘                                 │          │
│                                                    │          │
├────────────────────────────────────────────────────┼─────────┤
│                    Native Bridge                   │          │
├────────────────────────────────────────────────────┼─────────┤
│                                                    │          │
│  iOS Native Modules                                │          │
│                                                    ▼          │
│  ┌──────────────────┐  ┌──────────────────────────────────┐│
│  │ VideoPlayerPool  │◀─│    VideoPlayerView (Swift)       ││
│  │   (Swift)        │  │  - AVPlayer integration          ││
│  │                  │  │  - Pooling support               ││
│  │ - Pool AVPlayer  │  │  - Event emission                ││
│  │ - Pool AVLayer   │  └──────────────────────────────────┘│
│  └──────────────────┘                                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ VisibilityTrackingView (Swift)                       │  │
│  │  - Native visibility detection                       │  │
│  │  - Configurable thresholds                           │  │
│  │  - Efficient scrolling performance                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ CacheManager (Objective-C)                           │  │
│  │  - KTVHTTPCache integration                          │  │
│  │  - Proxy server management                           │  │
│  │  - Segment caching                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Third-Party Libraries                                       │
│  ┌──────────────────┐                                       │
│  │ KTVHTTPCache     │ - HTTP proxy for video caching       │
│  └──────────────────┘                                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Core Components

### React Native Components

#### 1. FeedScreen
**Location:** `rn_app/screens/FeedScreen.tsx`

**Responsibility:**
- Main screen displaying video feed
- Manages RecyclerListView for efficient rendering
- Handles pagination via DataProvider
- Renders different widget types (shorts, carousel)

**Key Features:**
- Windowed rendering (only visible items in DOM)
- Responsive layout with max-width constraint
- Pull-to-refresh and infinite scroll
- FAB menu for settings and actions

---

#### 2. VideoCard
**Location:** `rn_app/components/VideoCard.tsx`

**Responsibility:**
- Displays individual video items
- Manages visibility-based playback lifecycle
- Integrates with PlaybackManager for orchestration
- Tracks playback metrics

**Lifecycle States:**
1. **notActive** (< 20% visible) - Thumbnail only, no video mounted
2. **prepareToBeActive** (25-50% visible) - Video mounted but paused
3. **isActive** (> 50% visible) - Video playing
4. **willResignActive** (< 90% visible outgoing) - Video pausing

**Props:**
- `item: VideoItem` - Video data (URL, thumbnail, metadata)
- `visibilityConfig?: VisibilityTransitioningConfig` - Custom thresholds
- `geekMode?: boolean` - Show debug HUD

**Rendering Strategy:**
- Thumbnail (FastImage) always rendered in background
- VideoPlayerView overlays thumbnail when mounted
- Play button for low-end devices or manual play
- Smooth transitions without flicker

---

#### 3. VideoPlayerView
**Location:** `rn_app/components/VideoPlayerView.tsx` (RN wrapper)  
**Native:** `ios/RNModules/VideoPlayerView/VideoPlayerView.swift`

**Responsibility:**
- Bridge to native AVPlayer
- Emit playback events to React Native
- Manage player lifecycle

**Props:**
- `source: string` - Video URL
- `paused: boolean` - Play/pause control
- `videoId: string` - Unique identifier

**Events:**
- `onLoad` - Video loaded and ready
- `onProgress` - Playback progress (every 250ms)
- `onEnd` - Video finished playing
- `onError` - Playback error occurred
- `onBuffer` - Buffering state changed

**Native Implementation:**
- Acquires AVPlayer and AVPlayerLayer from VideoPlayerPool
- Configures AVPlayerItem with video URL
- Adds KVO observers for status, buffering
- Emits events via RCTDirectEventBlock
- Returns player/layer to pool on unmount

---

#### 4. PlaybackManager
**Location:** `rn_app/platback_manager/PlaybackManager.ts`

**Responsibility:**
- Centralized playback orchestration
- Enforces playback rules (only one video at a time per widget type)
- Handles visibility state transitions
- Manages prefetching and sequencing

**Key Functions:**
- `handleVisibilityChange(videoId, category, state, videoSourceType?)` - Process visibility updates
- `handlePrepareToBeActive(videoId, videoState)` - Video entering viewport
- `handleActive(videoId, videoState)` - Video should play
- `handleWillResignActive(videoId, videoState)` - Video leaving viewport
- `handleNotActive(videoId, videoState)` - Video fully offscreen

**Playback Rules:**
- Shorts: One active at a time
- Carousels: Multiple can play (within same carousel)
- Low-end devices: Manual play only (if configured)

**State Management:**
- Maintains `videoMap: Map<videoId, VideoState>`
- Tracks playback state, visibility, prefetch status
- Uses EventEmitter for play/pause commands

---

### Native Modules

#### 1. VideoPlayerPool
**Location:** `ios/RNModules/VideoPlayerPool/VideoPlayerPool.swift`

**Responsibility:**
- Pool and reuse AVPlayer instances
- Pool and reuse AVPlayerLayer instances
- Reduce memory allocations and initialization overhead

**API:**
```swift
static func acquirePlayer() -> AVPlayer
static func releasePlayer(_ player: AVPlayer)
static func acquireLayer() -> AVPlayerLayer
static func releaseLayer(_ layer: AVPlayerLayer)
static func getPoolStats() -> [String: Any]
static func clearPool()
```

**Pool Configuration:**
- Max players: 5 (configurable)
- Max layers: 5 (configurable)
- Idle timeout: 30 seconds
- Auto-cleanup of unused instances

---

#### 2. VisibilityTrackingView
**Location:** `ios/RNModules/VisibilityTrackingView/VisibilityTrackingView.swift`

**Responsibility:**
- Efficient native visibility detection
- Reduces RN bridge overhead
- Configurable thresholds and debouncing

**Props:**
- `uniqueId: string` - Identifier for the view
- `visibilityConfig: RawVisibilityTransitioningConfig` - Threshold configuration
- `throttleMs: number` - Event throttling (default from AppConfig)

**Events:**
- `onVisibilityChange` - Emits visibility state changes with percentage

**Implementation:**
- Uses UIKit intersection observer
- Calculates visible percentage vs viewport
- Applies hysteresis to prevent rapid toggling
- Native throttling for performance

---

#### 3. CacheManager
**Location:** `ios/RNModules/CacheManager/CacheManager.m`

**Responsibility:**
- Integrate KTVHTTPCache for video segment caching
- Manage cache size and cleanup
- Provide cache status APIs

**API:**
```typescript
setupCache(maxSizeMB: number): Promise<boolean>
getCachedURL(originalURL: string): string
isCached(url: string): boolean
clearCache(): Promise<boolean>
getCacheSize(): number
```

**KTVHTTPCache Integration:**
- Proxy server runs on startup (AppDelegate)
- Intercepts video requests
- Caches segments automatically
- Serves cached content when available
- Handles HLS manifest rewriting

---

## Data Flow

### Video Playback Flow

```
1. User scrolls feed
   ↓
2. VisibilityTrackingView detects item visibility
   ↓
3. Native event → RN VideoCard.onVisibilityChange
   ↓
4. VideoCard calls PlaybackManager.handleVisibilityChange
   ↓
5. PlaybackManager determines if video should play
   ↓
6. Emits 'play' or 'pause' event via EventEmitter
   ↓
7. VideoCard listens and updates isPlayerPlaying state
   ↓
8. VideoPlayerView paused prop updates
   ↓
9. Native VideoPlayerView calls AVPlayer.play() or pause()
   ↓
10. Video plays, events emitted back to RN
   ↓
11. Metrics recorded for monitoring
```

### Caching Flow

```
1. VideoCard sets source URL on VideoPlayerView
   ↓
2. URL passed to native VideoPlayerView
   ↓
3. CacheManager.getCachedURL(url) called
   ↓
4. If cached: Returns proxy URL (localhost:port/cached/...)
   If not: Returns original URL, KTVHTTPCache will cache on download
   ↓
5. AVPlayer loads from proxy URL
   ↓
6. KTVHTTPCache intercepts request
   ↓
7. Serves from cache OR downloads and caches
   ↓
8. Future requests served from cache instantly
```

### Metrics Flow

```
1. Video events occur (load, play, buffer, etc.)
   ↓
2. VideoCard event handlers call metrics.mark()
   ↓
3. Metrics stored in memory buffer
   ↓
4. Every 5 seconds (if enabled): flush to file
   ↓
5. MetricsReportModal reads from memory snapshot
   ↓
6. Derives KPIs (startup time, stall count, etc.)
   ↓
7. Displays in sortable table
   ↓
8. Can export/share for analysis
```

---

## State Management

### Global State
- **AppConfig:** Runtime configuration (singleton)
- **PlaybackManager:** Playback orchestration (module-level state)
- **VideoMetrics:** Metrics collection (singleton instance)
- **VideoPlayerPool:** Native player pooling (Swift singleton)

### Component State
- **VideoCard:** Local playback state (playing, attached, visibility)
- **FeedScreen:** Scroll position, pagination state
- **SettingsModal:** Form state for config editing

### No Global State Library
- Intentionally avoiding Redux/MobX for simplicity
- EventEmitter for cross-component communication
- Direct props passing where possible

---

## Performance Optimizations

### 1. Efficient List Rendering
- **RecyclerListView** instead of FlatList
- Only renders visible items + small buffer
- Reuses view components during scroll
- Lazy loading for images and videos

### 2. Video Player Pooling
- Reuse AVPlayer instances (expensive to create)
- Pool size: 5 players, 5 layers
- Reduces initialization time by 80%
- Lower memory footprint

### 3. Native Visibility Tracking
- Prevents constant RN bridge calls
- Native throttling (configurable ms)
- Reduces CPU usage during scroll by 40%

### 4. Video Segment Caching
- KTVHTTPCache caches HLS/DASH segments
- Instant playback for cached videos
- Reduces bandwidth usage
- Enables offline playback

### 5. Conditional Rendering
- Thumbnail always rendered (cheap)
- Video player mounted only when approaching viewport
- Unmounted when far offscreen
- Play button only when needed

---

## Native Modules Detail

### VideoPlayerView Architecture

```
┌─────────────────────────────────────────────────┐
│  VideoPlayerView.swift                          │
│  ┌───────────────────────────────────────────┐ │
│  │ Props                                     │ │
│  │  - source: NSString                       │ │
│  │  - paused: Bool                           │ │
│  │  - videoId: NSString                      │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ Internal State                            │ │
│  │  - player: AVPlayer?                      │ │
│  │  - playerLayer: AVPlayerLayer?            │ │
│  │  - playerItem: AVPlayerItem?              │ │
│  │  - timeObserver: Any?                     │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ KVO Observers                             │ │
│  │  - status (readyToPlay, failed)           │ │
│  │  - playbackBufferEmpty                    │ │
│  │  - playbackLikelyToKeepUp                 │ │
│  └───────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────┐ │
│  │ Events (RCTDirectEventBlock)              │ │
│  │  - onLoad(videoId, duration, naturalSize) │ │
│  │  - onProgress(currentTime, duration, etc) │ │
│  │  - onEnd(videoId)                         │ │
│  │  - onError(videoId, error)                │ │
│  │  - onBuffer(videoId, isBuffering)         │ │
│  └───────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### VideoPlayerPool Design

**Problem:** Creating/destroying AVPlayer instances is expensive (100-300ms each)

**Solution:** Object pool pattern
- Pre-create players during idle time
- Acquire from pool when needed (< 5ms)
- Release back to pool after use
- Auto-cleanup after timeout

**Pool Operations:**
```swift
acquire() → Check pool → Return existing OR create new
release() → Add to pool → Schedule cleanup timer
cleanup() → Remove players idle > 30s
```

---

## Configuration System

### AppConfig Structure

**Location:** `rn_app/config/AppConfig.ts`

```typescript
AppConfig.config = {
  performance: {
    isLowEndDevice: boolean
    autoplayOnLowEnd: boolean
    maxConcurrentVideos: number
    poolSize: number
  },
  playback: {
    previewDurationMs: number
    autoplayThreshold: number
  },
  visibility: {
    shorts: VisibilityTransitioningConfig
    carousel: VisibilityTransitioningConfig
    default: VisibilityTransitioningConfig
  },
  cache: {
    maxSizeMB: number
    enablePrefetch: boolean
  },
  ui: {
    showDebugHUD: boolean
    maxFeedWidth: number
  },
  offline: {
    enabled: boolean
    mockOfflineMode: boolean
  }
}
```

**Runtime Editing:**
- Settings modal allows editing any config value
- Changes can apply immediately or require reload
- Config persisted to AsyncStorage (if enabled)

---

## Metrics and Observability

### Metrics Collection

**VideoMetrics Class:**
- In-memory buffer of all events
- Per-play tracking with unique playId
- Delta time calculations
- Sequence numbering

**Event Types:**
- `mark` - Standard timing events
- `error` - Error events
- `info` - Informational events

### Key Metrics

**Load Metrics:**
- `video_load_started` → `video_loaded` = Ready Time
- `video_play` → `video_ready_for_display` = Startup Time

**Playback Metrics:**
- `video_buffer_start` / `video_buffer_end` = Stall events
- `video_progress` = Playback position (if enabled)
- `video_playback_rate_change` = Play/pause state changes

**KPIs Derived:**
- Startup time (time to first frame)
- Ready time (time to load video)
- Stall count and duration
- Time to first stall

### Debug HUD

Shows real-time per-video data:
- Visibility state
- Visibility percentage
- Current metrics phase

### Metrics Report Modal

Aggregate view of all playback sessions:
- Sortable table by startup, stalls, etc.
- Percentile statistics (P50, P90, P99)
- Export functionality
- Filter by stalls

---

## Visibility System

### Why Native Visibility?

React Native's onViewableItemsChanged has limitations:
- High bridge overhead during scroll
- Delayed updates (100-500ms)
- Inaccurate percentages
- Can't be debounced effectively

**Native solution:**
- UIKit intersection observer
- Direct percentage calculation
- Native-side throttling
- < 5ms latency

### Visibility Configuration

**Thresholds:**
```typescript
{
  movingIn: {
    prepareToBeActive: 25,  // Mount video at 25%
    isActive: 50           // Play video at 50%
  },
  movingOut: {
    willResignActive: 90,  // Pause at 90% (leaving)
    notActive: 20          // Unmount at 20%
  }
}
```

**Different configs for:**
- Shorts (full-screen, aggressive)
- Carousels (smaller, conservative)
- Default fallback

---

## Caching Strategy

### KTVHTTPCache

**How It Works:**
1. Proxy server runs on localhost (random port)
2. Video URLs converted to proxy URLs
3. Requests intercepted by proxy
4. Segments cached to disk
5. Cached segments served instantly

**Cache Management:**
- Max size limit (configurable, default 500MB)
- LRU eviction when full
- Per-URL segment tracking
- HLS manifest rewriting

**Cache APIs:**
- `getCachedURL(url)` - Get proxy URL for caching
- `isCached(url)` - Check if fully cached
- `clearCache()` - Delete all cached data
- `getCacheSize()` - Current cache size

### Offline Support

**Offline Mode:**
- Filter feed to show only cached videos
- Mock network failure via config flag
- Cached videos play normally
- Non-cached videos hidden

---

## Navigation Structure

```
NavigationContainer
  └── Stack Navigator
        ├── FeedScreen (initial)
        └── SettingsScreen
```

**Stack Navigation Only:**
- No tab bar (out of scope - hybrid app may have native tabs)
- Modal presentations for settings
- Overlay FAB menu for actions

---

## File Structure

```
VideoFeedApp/
├── rn_app/
│   ├── components/
│   │   ├── VideoCard.tsx              # Main video component
│   │   ├── VideoPlayerView.tsx        # Native player wrapper
│   │   ├── VisibilityTrackingView.tsx # Native visibility wrapper
│   │   ├── SettingsModal.tsx          # Config editor
│   │   ├── PlayButton.tsx             # Manual play UI
│   │   └── native_components/         # Native component typings
│   ├── screens/
│   │   ├── FeedScreen.tsx             # Main feed
│   │   └── SettingsScreen.tsx         # Settings page
│   ├── platback_manager/
│   │   ├── PlaybackManager.ts         # Playback orchestration
│   │   └── MediaCardVisibility.ts     # Visibility enums
│   ├── services/
│   │   ├── DataProvider.ts            # Feed data/pagination
│   │   ├── PrefetchManager.ts         # Video prefetching
│   │   ├── CacheManager.ts            # RN cache wrapper
│   │   ├── OfflineManager.ts          # Offline support
│   │   └── VideoPlayerPool.ts         # RN pool wrapper
│   ├── instrumentation/
│   │   ├── VideoMetrics.ts            # Metrics collection
│   │   ├── DebugHUD.tsx               # Real-time metrics HUD
│   │   ├── MetricsReportModal.tsx     # Aggregate metrics report
│   │   └── MetricsDataRouter.ts       # File persistence
│   ├── config/
│   │   ├── AppConfig.ts               # Centralized config
│   │   └── ManifestTemplates.ts       # HLS/DASH templates
│   ├── navigation/
│   │   ├── RootNavigator.tsx          # Stack navigator
│   │   └── types.ts                   # Navigation types
│   ├── types/
│   │   └── index.ts                   # Shared TypeScript types
│   └── resources/
│       └── video-feed.ts              # Mock video data
├── ios/
│   ├── RNModules/
│   │   ├── VideoPlayerView/
│   │   │   ├── VideoPlayerView.swift
│   │   │   ├── VideoPlayerViewManager.h
│   │   │   └── VideoPlayerViewManager.m
│   │   ├── VideoPlayerPool/
│   │   │   ├── VideoPlayerPool.swift
│   │   │   ├── VideoPlayerPoolBridge.h
│   │   │   └── VideoPlayerPoolBridge.m
│   │   ├── CacheManager/
│   │   │   ├── CacheManager.h
│   │   │   └── CacheManager.m
│   │   ├── VisibilityTrackingView/
│   │   │   ├── VisibilityTrackingView.swift
│   │   │   ├── VisibilityTrackingViewManager.h
│   │   │   ├── VisibilityTrackingViewManager.m
│   │   │   ├── ViewabilityTransitioningConfig.h
│   │   │   ├── ViewabilityTransitioningConfig.m
│   │   │   ├── RCTConvert_ViewabilityTransitioningConfig.h
│   │   │   └── RCTConvert_ViewabilityTransitioningConfig.m
│   │   └── VideoFeedApp-Bridging-Header.h
│   ├── VideoFeedApp/
│   │   ├── AppDelegate.mm             # KTVHTTPCache startup
│   │   └── ...
│   └── Podfile                        # Native dependencies
└── package.json                       # RN dependencies
```

---

## Key Design Decisions

### 1. Custom VideoPlayerView vs react-native-video
**Decision:** Build custom native module

**Rationale:**
- Full control over AVPlayer lifecycle
- Player pooling support
- Tighter integration with app logic
- Smaller bundle size
- No third-party dependency conflicts

### 2. Objective-C for CacheManager
**Decision:** Use Objective-C instead of Swift

**Rationale:**
- Direct KTVHTTPCache API calls (Objective-C library)
- Avoid Swift module import issues
- Simpler bridging (no extra bridge layer)
- Proven compatibility with React Native

### 3. RecyclerListView vs FlatList
**Decision:** Use RecyclerListView

**Rationale:**
- Better performance for large lists
- Predictable memory usage
- View recycling (not recreation)
- Smooth 60 FPS scrolling

### 4. No Advanced Playback Optimization (Current)
**Decision:** Removed multi-phase quality adaptation

**Rationale:**
- Requires AVPlayer properties not yet exposed
- Adds complexity without proven benefit
- MVP focus on basic playback that works
- Can add back later if needed

---

## Error Handling

### Video Playback Errors
- Caught by `onError` callback
- Logged to metrics
- Retry UI shown to user
- Error state prevents infinite retry loops

### Cache Errors
- Gracefully fallback to direct URLs
- Log errors but don't block playback
- Cache failures don't crash app

### Native Module Errors
- Try-catch in Swift/Objective-C
- Reject promises with error messages
- Log to native console for debugging

---

## Future Enhancements

### Planned Features
1. **Advanced AVPlayer Controls** - muted, volume, buffer settings, bitrate limiting
2. **Automated Tests** - Jest unit tests, XCTest for native, Detox E2E
3. **Multi-phase Quality Optimization** - Adaptive quality based on network/device
4. **Live Stream Support** - Enhanced handling for LIVE content
5. **Picture-in-Picture** - Background playback
6. **Casting Support** - AirPlay, Chromecast
7. **A/B Testing Framework** - Test playback strategies
8. **Advanced Prefetching** - ML-based prediction of next videos

### Deferred Scope
- Tab navigation (handled natively in hybrid app)
- User authentication
- Video upload/recording
- Social features (comments, likes)
- Analytics backend integration

---

## Troubleshooting Common Issues

### Build Failures
- Clean DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- Reinstall pods: `cd ios && pod deintegrate && pod install`
- Reinstall node modules: `rm -rf node_modules && npm install`

### Runtime Errors
- Check Metro bundler console
- Check Xcode console for native errors
- Verify all native module files added to Xcode project
- Check bridging header paths

### Performance Issues
- Enable Hermes for better JS performance
- Check VideoPlayerPool stats (max 5 should be enough)
- Monitor memory in Xcode Instruments
- Reduce visibility thresholds if scroll is janky

---

**Version:** 1.0  
**Last Updated:** October 11, 2025  
**Maintained By:** Development Team

