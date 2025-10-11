# Video Feed App - Component Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Configuration System](#configuration-system)
3. [Navigation System](#navigation-system)
4. [Data Management](#data-management)
5. [Video Player System](#video-player-system)
6. [Caching & Prefetching](#caching--prefetching)
7. [Playback Management](#playback-management)
8. [UI Components](#ui-components)
9. [Native Modules](#native-modules)
10. [Services](#services)

---

## Architecture Overview

The Video Feed App follows a modular architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    React Native Layer                       │
├─────────────────────────────────────────────────────────────┤
│  Screens  │  Components  │  Services  │  Configuration     │
├─────────────────────────────────────────────────────────────┤
│                    Native iOS Layer                         │
├─────────────────────────────────────────────────────────────┤
│  VideoPlayer  │  CacheManager  │  PlayerPool  │  Visibility │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Principles
- **Modularity**: Each component has a single responsibility
- **Performance**: Optimized for smooth video playback and scrolling
- **Configurability**: Runtime configuration for testing and optimization
- **Offline Support**: Intelligent caching and offline playback
- **Device Adaptation**: Different behaviors for low-end vs high-end devices

---

## Configuration System

### AppConfig.ts
Centralized configuration management with runtime editing support.

```typescript
export class AppConfig {
  static config = {
    feed: {
      maxContentWidth: 768,        // Max width for content
      firstPageSize: 10,           // Initial page size
      subsequentPageSize: 8,       // Subsequent page sizes
    },
    performance: {
      isLowEndDevice: false,       // Low-end device mode
      autoplayOnLowEnd: false,     // Autoplay on low-end devices
    },
    prefetch: {
      enabled: true,               // Enable prefetching
      vodOnly: true,               // Only prefetch VOD content
      segmentCount: 2,             // Number of segments to prefetch
      maxConcurrent: 3,            // Max concurrent prefetch operations
    },
    cache: {
      maxSizeMB: 500,              // Max cache size
      strategy: 'LRU',             // Cache eviction strategy
    },
    playback: {
      previewDuration: 30,         // Preview duration in seconds
      sequencingEnabled: true,     // Enable video sequencing
    },
    offline: {
      mockOfflineMode: false,      // Mock offline mode for testing
      showOnlyCachedVideos: true,  // Show only cached videos in offline mode
    }
  };
}
```

**Key Features:**
- Runtime configuration updates
- Change listeners for reactive updates
- Validation and type safety
- Persistence support

---

## Navigation System

### RootNavigator.tsx
Stack-based navigation without tab bar.

```typescript
const Stack = createStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Feed"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#000' },
      }}
    >
      <Stack.Screen name="Feed" component={FeedScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}
```

**Navigation Types:**
```typescript
export type RootStackParamList = {
  Feed: undefined;
  Settings: undefined;
};
```

---

## Data Management

### DataProvider.ts
Paginated data service with widget transformation.

```typescript
class DataProvider {
  async getFeedData(page: number, pageSize: number): Promise<IFeedItem[]> {
    // Simulate API call with pagination
    const startIndex = page * pageSize;
    const endIndex = startIndex + pageSize;
    
    const rawData = videoFeedData.slice(startIndex, endIndex);
    return this.transformToFeedItems(rawData);
  }

  private transformToFeedItems(data: any[]): IFeedItem[] {
    return data.map(item => ({
      id: item.id,
      widgetType: this.determineWidgetType(item),
      data: this.transformWidgetData(item),
    }));
  }
}
```

**Features:**
- Paginated data loading
- Widget type detection
- Data transformation
- Error handling

### Types
```typescript
export interface IFeedItem {
  id: string;
  widgetType: WidgetType;
  data: VideoData | VideoData[] | MerchData;
}

export interface VideoData {
  id: string;
  videoSource: {
    url: string;
    videoType: 'VOD' | 'LIVE';
  };
  thumbnailUrl: string;
  aspectRatio: string;
}
```

---

## Video Player System

### VideoPlayerView.tsx (React Native Wrapper)
React Native component that wraps the native video player.

```typescript
interface VideoPlayerViewProps {
  source: string;
  videoId: string;
  paused: boolean;
  style?: StyleProp<ViewStyle>;
  onLoad?: (event: any) => void;
  onProgress?: (event: any) => void;
  onEnd?: (event: any) => void;
  onError?: (event: any) => void;
  onBuffer?: (event: any) => void;
}

export default function VideoPlayerView(props: VideoPlayerViewProps) {
  return (
    <NativeVideoPlayerView
      {...props}
      style={[styles.player, props.style]}
    />
  );
}
```

### VideoPlayerView.swift (Native Implementation)
Native iOS video player with AVPlayer integration.

```swift
@objc(VideoPlayerView)
class VideoPlayerView: UIView {
  private var player: AVPlayer?
  private var playerLayer: AVPlayerLayer?
  
  @objc var source: NSString? {
    didSet { setupPlayer() }
  }
  
  @objc var paused: Bool = true {
    didSet {
      if paused {
        player?.pause()
      } else {
        player?.play()
      }
    }
  }
  
  private func setupPlayer() {
    // Acquire player from pool
    player = VideoPlayerPool.acquirePlayer()
    playerLayer = VideoPlayerPool.acquireLayer()
    
    // Configure player with source
    guard let urlString = source as String?,
          let url = URL(string: urlString) else { return }
    
    let playerItem = AVPlayerItem(url: url)
    player?.replaceCurrentItem(with: playerItem)
    playerLayer?.player = player
  }
}
```

**Key Features:**
- Player pooling for performance
- Event callbacks to React Native
- Proper lifecycle management
- Error handling

---

## Caching & Prefetching

### CacheManager.ts
React Native service for video caching operations.

```typescript
class CacheManagerService {
  async initialize(): Promise<void> {
    await NativeCacheManager.setupCache(AppConfig.config.cache.maxSizeMB);
  }

  async getCachedURL(originalURL: string): Promise<string> {
    return await NativeCacheManager.getCachedURL(originalURL);
  }

  async isCached(url: string): Promise<boolean> {
    return await NativeCacheManager.isCached(url);
  }

  async clearCache(): Promise<void> {
    await NativeCacheManager.clearCache();
  }

  async generateOfflineManifest(
    videoURL: string,
    cachedSegments: SegmentInfo[],
    templateId?: string
  ): Promise<string> {
    return await NativeCacheManager.generateOfflineManifest(
      videoURL,
      cachedSegments,
      templateId || AppConfig.config.cache.manifestTemplateId
    );
  }
}
```

### CacheManager.swift (Native Implementation)
Native iOS cache manager using KTVHTTPCache.

```swift
@objc(CacheManager)
class CacheManager: NSObject {
  @objc static func setupCache(_ maxSizeMB: Int) {
    let configuration = KTVHTTPCacheConfiguration()
    configuration.maxCacheLength = UInt(maxSizeMB) * 1024 * 1024
    KTVHTTPCache.shared.setup(with: configuration)
  }
  
  @objc static func getCachedURL(_ originalURL: String) -> String {
    guard let url = URL(string: originalURL) else { return originalURL }
    let cachedURL = KTVHTTPCache.shared.cacheURL(with: url)
    return cachedURL?.absoluteString ?? originalURL
  }
  
  @objc static func generateOfflineManifest(
    _ videoURL: String,
    _ cachedSegments: [[String: Any]],
    _ templateId: String
  ) -> String {
    // Generate HLS manifest from template
    return renderManifest(template: template, segments: cachedSegments)
  }
}
```

### PrefetchManager.ts
Intelligent video segment prefetching (VOD only).

```typescript
class PrefetchManager {
  private queue: PrefetchRequest[] = [];
  private activeDownloads = new Map<string, AbortController>();
  private statusMap = new Map<string, PrefetchStatus>();

  async prefetchVideo(
    videoUrl: string,
    videoType: 'VOD' | 'LIVE',
    priority: number = 0
  ): Promise<void> {
    // Skip if prefetching is disabled
    if (!AppConfig.config.prefetch.enabled) return;
    
    // Skip if LIVE content and VOD-only mode is enabled
    if (videoType === 'LIVE' && AppConfig.config.prefetch.vodOnly) return;

    // Add to queue and start processing
    this.queue.push({ videoUrl, videoType, priority, segmentCount: 2 });
    this.processQueue();
  }

  private async startDownload(request: PrefetchRequest): Promise<void> {
    // 1. Fetch and parse manifest
    const manifest = await this.fetchManifest(request.videoUrl);
    
    // 2. Detect if actually VOD from manifest
    if (this.isLiveManifest(manifest)) {
      console.warn('Manifest indicates LIVE, skipping prefetch');
      return;
    }

    // 3. Extract segments
    const segments = this.parseSegments(manifest).slice(0, request.segmentCount);
    
    // 4. Download segments
    await this.downloadSegments(request.videoUrl, segments);
  }
}
```

**Key Features:**
- VOD-only prefetching
- Live content detection from manifest
- Priority-based queue management
- Status tracking and cancellation
- Concurrent download limits

---

## Playback Management

### PlaybackManager.ts
Enhanced playback manager with VOD/LIVE handling and sequencing.

```typescript
class PlaybackManager {
  private activeVideos = new Map<string, VideoState>();
  private previewTimers = new Map<string, NodeJS.Timeout>();
  private softPlayQueue: SoftPlayVideo[] = [];

  handleVisibilityChange(
    videoId: string,
    videoType: 'VOD' | 'LIVE',
    state: MediaCardVisibility,
    category: WidgetType
  ): void {
    const videoState = this.activeVideos.get(videoId) || {
      id: videoId,
      type: videoType,
      category,
      visibilityState: state,
      isPlaying: false,
      isPrefetched: false,
    };

    videoState.visibilityState = state;
    this.activeVideos.set(videoId, videoState);

    switch (state) {
      case MediaCardVisibility.prepareToBeActive:
        this.handlePrepareToBeActive(videoId, videoState);
        break;
      case MediaCardVisibility.isActive:
        this.handleActive(videoId, videoState);
        break;
      case MediaCardVisibility.willResignActive:
        this.handleWillResignActive(videoId, videoState);
        break;
      case MediaCardVisibility.notActive:
        this.handleNotActive(videoId, videoState);
        break;
    }
  }

  private handleLowEndDeviceActive(videoId: string, videoState: VideoState): void {
    // On low-end devices, only play one video at a time
    if (this.getPlayingCount() === 0) {
      this.playVideo(videoId, videoState);
    } else {
      this.addToSoftPlayQueue(videoId, videoState.category);
    }
  }

  private startPreviewTimer(videoId: string, videoState: VideoState): void {
    const previewDuration = AppConfig.config.playback.previewDuration * 1000;
    
    const timer = setTimeout(() => {
      this.onPreviewEnd(videoId, videoState);
    }, previewDuration);
    
    this.previewTimers.set(videoId, timer);
  }
}
```

**Key Features:**
- VOD/LIVE content handling
- Low-end device support
- Video sequencing with rotation
- Priority-based playback
- Soft play queue management

---

## UI Components

### VideoCard.tsx
Enhanced video card with overlay rendering, metrics tracking, and play button support.

**Location:** `rn_app/components/VideoCard.tsx`

**Props:**
```typescript
interface VideoCardProps extends ViewProps {
    item: VideoItem;
    geekMode?: boolean;  // Show debug HUD
    visibilityConfig?: VisibilityTransitioningConfig;
}
```

**Features:**
- Visibility-based playback lifecycle
- Overlay rendering (thumbnail + video, no flicker)
- Comprehensive metrics tracking
- Manual play button for low-end devices
- Integration with PlaybackManager
- Debug HUD overlay (geekMode)

**Usage Example:**
```typescript
<VideoCard
  item={{
    id: 'video-123',
    videoSource: { url: 'https://...', videoType: 'VOD' },
    thumbnailUrl: 'https://...',
    videoCategory: 'short'
  }}
  geekMode={true}
  visibilityConfig={CUSTOM_THRESHOLDS}
/>
```

**Rendering Strategy:**
```typescript
<VisibilityTrackingView>
  {/* Layer 1: Thumbnail (always visible) */}
  <FastImage source={{ uri: thumbnailUrl }} />
  
  {/* Layer 2: Video (overlays when mounted) */}
  {isPlayerAttached && (
    <VideoPlayerView
      source={videoUrl}
      paused={!isPlayerPlaying}
      onLoad={...}
      onProgress={...}
      onEnd={...}
      onError={...}
      onBuffer={...}
    />
  )}
  
  {/* Layer 3: Play button (if needed) */}
  {showPlayButton && <PlayButton onPress={handleManualPlay} />}
  
  {/* Layer 4: Debug HUD (geekMode only) */}
  {geekMode && <DebugHUD data={...} />}
</VisibilityTrackingView>
```

**Lifecycle:**
1. **Mount** - Shows thumbnail only
2. **25% visible** - Mount VideoPlayerView (paused)
3. **50% visible** - Trigger play via PlaybackManager
4. **< 90% visible** - Pause video
5. **< 20% visible** - Unmount VideoPlayerView
6. **Unmount** - Clean up, report notActive

**Metrics Tracked:**
- `attemptStart` - New play attempt begins
- `video_load_started` - Video load initiated  
- `video_loaded` - Video ready to play
- `video_play` - Play command issued
- `video_pause` - Pause command issued
- `video_buffer_start` / `video_buffer_end` - Buffering events
- `video_ended` - Video finished
- `video_error` - Playback error
- `video_playback_rate_change` - Rate changes
- `video_ready_for_display` - First frame ready

**Event Handlers:**
- All handlers track metrics
- No optimization logic (removed for simplicity)
- Clean, predictable behavior

**Simplified (v2.0):**
- Removed multi-phase load optimization (PREFLIGHT, JOIN, STABILISE, STEADY, POOR)
- Removed stall tracking and quality adaptation
- Removed AVPlayer control props (mute, buffer settings, bitrate)
- Kept all metrics tracking intact
- Focus on reliable basic playback

### PlayButton.tsx
Custom play button component.

```typescript
interface PlayButtonProps {
  onPress: () => void;
  size?: number;
  visible?: boolean;
}

export default function PlayButton({ onPress, size = 60, visible = true }) {
  if (!visible) return null;

  return (
    <TouchableOpacity 
      style={[styles.container, { width: size, height: size }]} 
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.playIcon, { 
        borderLeftWidth: size * 0.4,
        borderTopWidth: size * 0.25,
        borderBottomWidth: size * 0.25,
      }]} />
    </TouchableOpacity>
  );
}
```

### SettingsModal.tsx
Runtime configuration editor.

```typescript
export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
  const [config, setConfig] = useState<AppConfigType>(AppConfig.config);
  const [hasChanges, setHasChanges] = useState(false);

  const handleConfigChange = (path: string, value: any) => {
    const newConfig = { ...config };
    const keys = path.split('.');
    let current = newConfig as any;
    
    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]];
    }
    
    current[keys[keys.length - 1]] = value;
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    const requiresReload = AppConfig.update(config);
    // Handle reload if needed
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        <ScrollView style={styles.content}>
          {/* Configuration sections */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Feed Settings</Text>
            {/* Configuration inputs */}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
```

---

## Native Modules

### VideoPlayerPool.swift
AVPlayer and AVPlayerLayer pooling for performance.

```swift
class VideoPlayerPool {
  private static let maxPlayers = 5
  private static let maxLayers = 8
  private static var availablePlayers: [AVPlayer] = []
  private static var availableLayers: [AVPlayerLayer] = []
  private static var usedPlayers: Set<AVPlayer> = []
  private static var usedLayers: Set<AVPlayerLayer> = []

  static func acquirePlayer() -> AVPlayer {
    if let player = availablePlayers.popLast() {
      usedPlayers.insert(player)
      return player
    }
    
    let player = AVPlayer()
    usedPlayers.insert(player)
    return player
  }

  static func releasePlayer(_ player: AVPlayer) {
    usedPlayers.remove(player)
    player.pause()
    player.replaceCurrentItem(with: nil)
    availablePlayers.append(player)
  }

  static func acquireLayer() -> AVPlayerLayer {
    if let layer = availableLayers.popLast() {
      usedLayers.insert(layer)
      return layer
    }
    
    let layer = AVPlayerLayer()
    usedLayers.insert(layer)
    return layer
  }

  static func releaseLayer(_ layer: AVPlayerLayer) {
    usedLayers.remove(layer)
    layer.player = nil
    availableLayers.append(layer)
  }
}
```

### VisibilityTrackingView.swift
Native visibility tracking with throttling.

```swift
class VisibilityTrackingView: RCTView {
  @objc var throttleInterval: NSNumber?
  @objc var visibilityConfig: ViewabilityTransitioningConfig?
  @objc var onVisibilityStateChange: RCTDirectEventBlock?
  @objc var uniqueId: NSString?

  private var displayLink: CADisplayLink?
  private var lastEmittedTime: TimeInterval = 0

  private func processVisibilityEvent(percentage: CGFloat) {
    let currentTimestamp = Date().timeIntervalSince1970
    let interval = throttleInterval?.doubleValue ?? 0
    let elapsedTime = currentTimestamp - lastEmittedTime

    // Check if throttling is active
    if interval > 0 && elapsedTime < interval / 1000.0 {
      return
    }

    // Process visibility change
    // ... visibility logic
  }
}
```

---

## Services

### OfflineManager.ts
Offline playback support with cached video filtering.

```typescript
class OfflineManager {
  private cachedVideos: Map<string, OfflineVideoInfo> = new Map();
  private isOfflineMode = false;

  async filterFeedForOffline(feedItems: IFeedItem[]): Promise<IFeedItem[]> {
    if (!this.isOfflineMode || !AppConfig.config.offline.showOnlyCachedVideos) {
      return feedItems;
    }

    const offlineItems: IFeedItem[] = [];

    for (const item of feedItems) {
      if (item.widgetType === 'merch') {
        // Merch items are always available offline
        offlineItems.push(item);
      } else if (item.widgetType === 'short' || item.widgetType === 'carousel') {
        // Check if video is cached
        const isCached = await this.isVideoCached(item);
        if (isCached) {
          offlineItems.push(item);
        }
      }
    }

    return offlineItems;
  }

  async generateOfflineManifest(videoUrl: string): Promise<string> {
    const cachedSegments = await this.getCachedSegments(videoUrl);
    return ManifestTemplateManager.generateManifest(
      AppConfig.config.cache.manifestTemplateId,
      cachedSegments
    );
  }
}
```

### ManifestTemplateManager.ts
HLS manifest template system with server fetch capability.

```typescript
export class ManifestTemplateManager {
  private templates = new Map<string, ManifestTemplate>();
  private serverTemplates = new Map<string, ManifestTemplate>();

  async fetchTemplate(templateId: string, serverUrl?: string): Promise<ManifestTemplate | null> {
    try {
      const url = serverUrl || `https://api.example.com/templates/${templateId}`;
      const response = await fetch(url);
      
      if (!response.ok) return null;

      const templateData = await response.json();
      const template: ManifestTemplate = {
        version: templateData.version || '3',
        targetDuration: templateData.targetDuration || 10,
        mediaSequence: templateData.mediaSequence || 0,
        playlistType: templateData.playlistType || 'VOD',
        template: templateData.template,
      };

      this.serverTemplates.set(templateId, template);
      return template;
    } catch (error) {
      console.error(`Failed to fetch template ${templateId}:`, error);
      return null;
    }
  }

  generateManifest(
    templateId: string,
    segments: Array<{ url: string; duration: number; sequence: number }>,
    overrides?: Partial<ManifestTemplate>
  ): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      return this.generateDefaultManifest(segments);
    }

    // Render template with segments
    let manifest = template.template;
    manifest = manifest.replace(/\{\{version\}\}/g, template.version);
    manifest = manifest.replace(/\{\{targetDuration\}\}/g, template.targetDuration.toString());
    // ... more replacements

    const segmentLines = segments
      .map(segment => `#EXTINF:${segment.duration},\n${segment.url}`)
      .join('\n');

    manifest = manifest.replace(/\{\{segments\}\}/g, segmentLines);
    return manifest;
  }
}
```

---

## Performance Optimizations

### 1. Video Player Pooling
- Reuse AVPlayer and AVPlayerLayer instances
- Reduce memory allocation overhead
- Improve video startup time

### 2. Overlay Rendering
- Keep thumbnail and video player in view hierarchy
- No view tree changes during video mounting
- Smooth transitions without jank

### 3. Native Throttling
- Configurable visibility event throttling
- Reduce JavaScript bridge overhead
- Improve scrolling performance

### 4. Intelligent Prefetching
- VOD-only prefetching
- Priority-based queue management
- Concurrent download limits

### 5. Low-End Device Support
- Single video playback on low-end devices
- Manual play button for user control
- Reduced concurrent operations

---

## Error Handling

### 1. Network Errors
- Graceful degradation for network failures
- Retry mechanisms for failed requests
- Offline mode fallback

### 2. Video Playback Errors
- Automatic retry for failed videos
- Fallback to thumbnail on persistent errors
- User-friendly error messages

### 3. Cache Errors
- Cache corruption handling
- Automatic cache clearing on errors
- Fallback to direct streaming

### 4. Native Module Errors
- Proper error propagation to React Native
- Graceful fallbacks for native failures
- Comprehensive error logging

---

## Testing Strategy

### 1. Unit Tests
- Component logic testing
- Service method testing
- Configuration validation

### 2. Integration Tests
- Native module integration
- End-to-end video playback
- Cache and prefetch functionality

### 3. Performance Tests
- Memory usage monitoring
- Video startup time measurement
- Scrolling performance validation

### 4. Device Testing
- Low-end device performance
- Different screen sizes
- Network condition simulation

---

## Future Enhancements

### 1. Android Support
- Port native modules to Android
- Platform-specific optimizations
- Cross-platform consistency

### 2. Advanced Analytics
- Video engagement metrics
- Performance monitoring
- User behavior tracking

### 3. AI-Powered Optimizations
- Predictive prefetching
- Quality adaptation
- Content recommendation

### 4. Enterprise Features
- Content management integration
- Advanced analytics dashboard
- Multi-tenant support
