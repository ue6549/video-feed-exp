# VideoFeedApp - Future Work & Backlog

## High Priority (Next Session)

### 1. AppConfig Testing & Verification
**Priority**: High (ensure settings work correctly)
**Status**: Not implemented

**Problem**:
- AppConfig has many configurable parameters
- Settings modal allows runtime changes
- No systematic testing to verify:
  - Config changes actually apply to native modules
  - Settings persist correctly
  - Changes take effect (some require reload, some don't)
  - No invalid config values break the app

**What Needs Testing**:

**Player Pool Configuration:**
```typescript
playerPool: {
    maxPlayers: 3,  // Change to 2, 4, 5 - verify pool respects limit
    avplayerPrefetchBufferSeconds: 2,  // Change to 1, 3, 5 - verify buffer stops at target
    avplayerPrefetchTimeoutSeconds: 10,  // Change to 5, 15 - verify timeout triggers
}
```

**Prefetch Configuration:**
```typescript
prefetch: {
    enabled: true,  // Toggle - verify prefetch stops/starts
    segmentCount: 2,  // Change to 1, 3, 5 - verify correct number downloaded
    maxConcurrent: 3,  // Change to 1, 5, 10 - verify concurrency limit
    strategy: 'auto',  // Change to 'avplayer', 'manifest' - verify strategy used
}
```

**Visibility Configuration:**
```typescript
visibility: {
    prefetchRange: 5,  // Change - verify lookahead distance
    nativeThrottleMs: 50,  // Change - verify throttling behavior
}
```

**Testing Approach**:

**1. Unit Tests for Config System:**
```typescript
describe('AppConfig', () => {
    test('update() applies changes', () => {
        AppConfig.update({ playerPool: { maxPlayers: 5 } });
        expect(AppConfig.config.playerPool.maxPlayers).toBe(5);
    });
    
    test('native modules receive config on init', async () => {
        // Mock native modules
        // Verify setPrefetchConfig called with correct values
    });
    
    test('requiresReload() detects breaking changes', () => {
        const requires = AppConfig.update({ cache: { strategy: 'FIFO' } });
        expect(requires).toBe(true);
    });
});
```

**2. Integration Tests:**
```typescript
describe('Settings Modal Integration', () => {
    test('changing maxPlayers updates native pool', async () => {
        render(<SettingsModal />);
        
        // Change maxPlayers from 3 to 2
        fireEvent.changeText(maxPlayersInput, '2');
        fireEvent.press(saveButton);
        
        // Verify native call
        expect(VideoPlayerPool.setMaxPlayers).toHaveBeenCalledWith(2);
    });
});
```

**3. Manual Testing Checklist:**

Settings to Test:
- [ ] playerPool.maxPlayers (2, 3, 5) - Check pool logs
- [ ] playerPool.avplayerPrefetchBufferSeconds (1, 3, 5) - Check buffer logs
- [ ] playerPool.avplayerPrefetchTimeoutSeconds (5, 15, 30) - Check timeout logs
- [ ] prefetch.enabled (true/false) - Verify prefetch starts/stops
- [ ] prefetch.strategy ('auto', 'avplayer', 'manifest') - Verify correct path taken
- [ ] prefetch.maxConcurrent (1, 5, 10) - Check queue logs
- [ ] prefetch.segmentCount (1, 3, 5) - Verify download count
- [ ] cache.maxSizeMB (100, 500, 1000) - Check cache size limits

**4. Settings Persistence Testing:**
- [ ] Change settings
- [ ] Kill app
- [ ] Relaunch
- [ ] Verify settings persisted

**5. Config Validation Testing:**
- [ ] Set maxPlayers to -1 (should reject)
- [ ] Set bufferSeconds to 0 (should reject or use default)
- [ ] Set invalid strategy string (should reject)

**Implementation:**

```typescript
// AppConfig.ts - Add validation
static update(newConfig: Partial<AppConfigType>): boolean {
    // Validate before applying
    if (!this.validateConfig(newConfig)) {
        console.error('[AppConfig] Invalid config values');
        return false;
    }
    
    const oldConfig = { ...this.config };
    this.config = this.deepMerge(this.config, newConfig);
    
    // Apply to native modules
    this.syncToNative();
    
    // Notify listeners
    this.listeners.forEach(listener => listener(this.config));
    
    return this.requiresReload(oldConfig, this.config);
}

static validateConfig(config: Partial<AppConfigType>): boolean {
    if (config.playerPool?.maxPlayers !== undefined) {
        if (config.playerPool.maxPlayers < 1 || config.playerPool.maxPlayers > 10) {
            return false;
        }
    }
    
    if (config.playerPool?.avplayerPrefetchBufferSeconds !== undefined) {
        if (config.playerPool.avplayerPrefetchBufferSeconds < 0.5 || 
            config.playerPool.avplayerPrefetchBufferSeconds > 30) {
            return false;
        }
    }
    
    // ... more validation
    return true;
}

static async syncToNative(): Promise<void> {
    try {
        await VideoPlayerPool.setMaxPlayers(this.config.playerPool.maxPlayers);
        await CacheManager.setPrefetchConfig(
            this.config.playerPool.avplayerPrefetchBufferSeconds,
            this.config.playerPool.avplayerPrefetchTimeoutSeconds
        );
    } catch (error) {
        console.error('[AppConfig] Failed to sync to native:', error);
    }
}
```

**Priority**: High - Critical for settings modal to work correctly

---

### 2. Player Pool Exhaustion Strategy
**Priority**: High (affects UX in edge cases)

**Problem**:
When screen layout shows more videos than available players:
- Example: 1 short (willResignActive) + 3.5 carousel cards (isActive) = 4-5 players needed
- Pool hard limit: 3 players
- Result: Visible videos fail to acquire player → stuck thumbnail or black screen

**Current Behavior (V1)**:
- Hard limit of 3 players
- Failed acquisition → Show play button (manual override)
- Graceful degradation but poor UX

**Future Solutions to Explore**:

**Option A: Priority-Based Eviction**
```
Priority: isActive > willResignActive > prefetch
When pool exhausted: Evict lower priority player
Pro: Visible videos always play
Con: Abrupt stops (e.g., short video pauses mid-play)
```

**Option B: Flexible Pool with Burst Capacity**
```
Normal: 3 players (targetSize)
Emergency: 5 players (maxSize)
Auto-shrink back to 3 when players released
Pro: Smooth UX, all videos play
Con: Temporary memory spike, complexity
```

**Option C: Visibility Rules Tuning**
```
Adjust thresholds to ensure ≤3 videos can be "isActive" simultaneously
isActive: 70% (stricter, was 60%)
notActive: 30% (release earlier, was 20%)
Pro: Problem never occurs
Con: May not work for all screen sizes/layouts
```

**Recommended Approach**:
1. **Primary**: Tune visibility rules (Option C)
2. **Fallback**: Flexible pool 3→5 (Option B) for edge cases
3. **Last Resort**: Priority eviction (Option A)

**Metrics to Track**:
- Pool expansion events (target → max)
- Play button shows (failed acquisition)
- Player evictions
- User manual play button taps

### 3. Thumbnail prefetch
Is this required if I am doing video prefetch?
Is there a way to use first frame of video for thumbnail?

### 4. Prefetching through offline HLS APIs

---

## High Priority (Next Session)

### 1. Secure KTVHTTPCache Local Proxy Server
**Priority**: Critical for production security

**Problem**:
- KTVHTTPCache runs a local HTTP proxy server (localhost:PORT)
- Currently has no authentication or access control
- Could be vulnerable to local attacks or malicious apps
- No request validation or rate limiting

**Solution**:
Implement security measures for the local proxy:

**Security Measures**:
1. **Authentication Token**:
   - Generate random token on proxy startup
   - Require token in custom HTTP header for all requests
   - Rotate token periodically or on app restart

2. **Request Validation**:
   - Whitelist allowed video URL patterns
   - Validate URL format before proxying
   - Block suspicious or malformed requests
   - Rate limiting per URL to prevent abuse

3. **Access Control**:
   - Verify requests originate from app's process
   - Consider using Unix domain sockets instead of TCP (if KTVHTTPCache supports)
   - Bind to 127.0.0.1 only (never 0.0.0.0)

4. **Request Sanitization**:
   - Validate all URL parameters
   - Prevent directory traversal attacks
   - Limit request size and headers

**Implementation Example**:
```swift
// In CacheManager.swift or AppDelegate
func setupSecureCache() {
    let config = KTVHTTPCacheConfiguration()
    
    // Generate auth token
    let authToken = UUID().uuidString
    UserDefaults.standard.set(authToken, forKey: "cache_auth_token")
    
    // Configure with security middleware
    config.addRequestInterceptor { request in
        guard let token = request.value(forHTTPHeaderField: "X-Cache-Auth"),
              token == authToken else {
            return nil // Reject unauthorized requests
        }
        
        guard let url = request.url,
              isValidVideoURL(url) else {
            return nil // Reject invalid URLs
        }
        
        return request
    }
    
    KTVHTTPCache.setup(with: config)
}

// In VideoPlayerView.swift
private func getProxiedURL(_ originalURL: URL) -> URL? {
    guard var proxiedURL = KTVHTTPCache.proxyURL(withOriginalURL: originalURL) else {
        return nil
    }
    
    // Add auth token to request
    if let token = UserDefaults.standard.string(forKey: "cache_auth_token") {
        // Add as query param or handle via URLRequest with custom header
    }
    
    return proxiedURL
}
```

**Testing**:
- Verify authenticated requests work
- Verify unauthenticated requests fail
- Test with malicious URLs
- Performance impact testing

**Related**:
- Update CacheManager to handle auth tokens
- Update VideoPlayerView to include auth in requests
- Add security documentation
- Consider security audit before production

---

### 2. Preview Duration & Sequencing Implementation
**Priority**: High - playback feature completeness
**Status**: Currently disabled (set to 0/false in AppConfig)

**Problem**:
- `previewDuration`, `sequencingEnabled`, `rotateToSoftPlay` are not properly implemented
- Preview timer lifecycle not managed correctly (can trigger after video released)
- Sequencing logic needs proper state management
- Features disabled for stability

**Preview Duration Needs**:
- Start timer when video becomes active
- Cancel timer on visibility state changes
- Clean up timer on unmount
- Handle edge cases (pausing, backgrounding)

**Sequencing Needs**:
- Detect video end event
- Check if another video in "waiting" state
- Smoothly transition to next video
- Respect user scroll interruptions

**Implementation**:
```typescript
// In VideoCard.tsx
useEffect(() => {
  if (!isActive || previewDuration === 0) return;
  
  const timer = setTimeout(() => {
    // Only trigger if still active
    if (currentVisibilityState === 'isActive') {
      handleVisibilityChange('willResignActive');
    }
  }, previewDuration * 1000);
  
  return () => clearTimeout(timer); // Cleanup on unmount or state change
}, [isActive, previewDuration]);

// In PlaybackManager.ts
function handleVideoEnd(videoId: string): void {
  if (!AppConfig.config.playback.sequencingEnabled) return;
  
  const waitingVideos = getVideosInState('prepareToBeActive');
  if (waitingVideos.length > 0) {
    const nextVideo = waitingVideos[0]; // Highest priority
    handleVisibilityChange(nextVideo.id, 'isActive');
  }
}
```

**Testing**:
- Verify timer cancellation on state changes
- Test sequencing with multiple videos
- Test interaction with user scroll
- Memory leak detection

---

### 3. Network-Aware Bitrate Selection for Prefetch
**Priority**: High (improves cache hit rate)
**Status**: Not implemented

**Problem**:
- Current prefetch doesn't consider network speed or quality tiers
- AVPlayer picks quality adaptively during playback
- Prefetched quality may not match playback quality → cache miss
- Cache hit rate: ~40-50%

**Solution**: Network-aware prefetch with playback constraints

**Phase 1: Network Speed Measurement**
```objc
// NetworkSpeedMonitor.m
- Periodic bandwidth measurement (every 30s)
- Use AVPlayer accessLog when available
- Fall back to interface type (WiFi/Cellular)
- Estimate: 1-20 Mbps range
```

**Phase 2: Bitrate Tier Selection**
```
Network Speed → Bitrate Tier Mapping:
< 1 Mbps:   Low (360p, ~600 Kbps)
1-3 Mbps:   Medium (540p, ~1.3 Mbps)
3-8 Mbps:   High (720p, ~4 Mbps)
> 8 Mbps:   Very High (1080p, ~6 Mbps)
```

**Phase 3: Apply to Prefetch**
```objc
// CacheManager.m - prefetchWithManifest
1. Measure network speed
2. Parse master playlist → get bitrate ladder
3. Select variant matching network tier
4. Fetch that variant's media playlist
5. Prefetch segments from selected quality
6. Store metadata: {prefetchedBitrate, quality, ladder}
```

**Phase 4: Playback Constraint**
```typescript
// VideoCard.tsx
const metadata = await CacheManager.getPrefetchMetadata(videoId);
if (metadata.prefetchedBitrate) {
    // Strategy options:
    // A) match_prefetch: Force exact match
    // B) prefetch_plus_one: Allow 1 tier higher
    // C) adaptive: Let AVPlayer decide (may miss cache)
    
    const preferredBitrate = calculatePreferredBitrate(
        metadata.prefetchedBitrate,
        metadata.bitrateLadder,
        AppConfig.playback.bitrateStrategy
    );
    
    // Set on AVPlayerItem
    item.preferredPeakBitRate = preferredBitrate;
}
```

**Expected Results**:
- Cache hit rate: 80-90% (up from 40-50%)
- Better bandwidth utilization
- Adaptive to network conditions

**Limitations**:
- `preferredPeakBitRate` is a hint, not guarantee
- Network may change between prefetch and playback
- Still better than random/no consideration

**Future Enhancement: Force Cached Mode**
```typescript
// Rewrite master playlist to ONLY include prefetched variant
// AVPlayer has no choice but to use cached quality
// Result: 100% cache hit, even offline!
```

**Config**:
```typescript
prefetch: {
    networkAware: true,
    measureInterval: 30, // seconds
    conservativeBitrate: false, // Pick 1 tier lower if true
},
playback: {
    bitrateStrategy: 'prefetch_plus_one', // match_prefetch | prefetch_plus_one | adaptive
}
```

---

### 4. AVAssetDownloadTask Exploration
**Priority**: Medium (long-term improvement)
**Status**: Research/exploration phase

**Current Issues with KTVHTTPCache:**
- UI freezing when network changes (main thread blocking)
- Stuck loading states after network failure
- Local proxy server overhead
- Recovery issues on network changes

**Alternative Approach 1: AVAssetDownloadTask + KTV Hybrid**

**Concept:**
- Use `AVAssetDownloadTask` for prefetch (instead of AVPlayer)
- Download stops after 2 seconds (partial .movpkg)
- Playback uses AVPlayer with local asset URL OR KTV proxy

**Benefits**:
✅ Lighter than AVPlayer prefetch (no player overhead)
✅ Returns local URL immediately (can play while downloading)
✅ Continues downloading if played online
✅ Apple-native API

**Challenges**:
❌ Partial downloads may not play offline (without .movpkg plist manipulation)
❌ Need to manage local asset URLs
❌ Coordination between download task and KTV
⚠️ Unknown: Does KTV recognize segments downloaded by AVAssetDownloadTask?

**Implementation:**
```swift
// Use download task for prefetch instead of AVPlayer
let task = downloadSession.makeAssetDownloadTask(
    asset: AVURLAsset(url: ktvProxiedURL),
    assetTitle: videoId,
    assetArtworkData: nil,
    options: nil
)

// Monitor progress, cancel after 2s buffered
task.resume()

// For playback: Try local URL first, fallback to KTV proxy
if let localURL = task.urlAsset.url {
    AVPlayerItem(url: localURL)
}
```

---

**Alternative Approach 2: Pure AVAssetDownloadTask (No KTV)**

**Concept:**
- Completely replace KTV with download tasks
- All videos use download tasks (prefetch + playback)
- Always play from local .movpkg URLs
- Accept: Partial downloads don't play offline (v1 limitation)

**Benefits**:
✅ No KTV complexity/overhead
✅ No UI freezing risk
✅ Apple-native, App Store friendly
✅ Clear architecture (one caching path)
✅ Background downloads supported

**Challenges**:
❌ Partial offline playback broken (major UX issue)
❌ Must manage download task lifecycle
❌ Must track local asset URLs per video
❌ Migration effort (large refactor)

**Partial Offline Workaround: Dummy Manifest Approach**

User's clever idea:
```
1. Generate dummy HLS manifest (only first 2 segments)
2. Download dummy manifest fully (marks as completed)
3. Offline: Plays 2 seconds from local (acceptable for prefetch)
4. Online: Play 2s instantly, simultaneously download full video, swap asset
```

**Complexity:**
- Must generate truncated manifests
- Must manage asset swapping mid-playback
- Storage overhead (dummy + full video)

---

**Alternative Approach 3: Fix KTV Issues (Current Path)**

**Immediate fixes:**
- Add timeouts (5s prefetch, 15s playback)
- Add cancellation on network loss
- Investigate main thread blocking
- Add error recovery

**Future investigation:**
- KTV threading model
- KTV session management
- Network transition handling

**Recommendation:** Fix KTV first, then prototype download tasks if issues persist

---

**Current Approach: KTVHTTPCache**
- Third-party library for HTTP caching
- Local proxy server architecture
- Works but has limitations and security concerns

**Benefits**:
✅ Works (segments cache, some offline playback)
✅ Widely used solution (community support)
✅ Transparent caching (AVPlayer doesn't know)

**Challenges**:
❌ UI freezing on network changes
❌ Stuck loading states
❌ Main thread blocking
❌ Session recovery issues

**Use Cases**:
- True offline mode (download full videos for offline viewing)
- Prefetch could use AVAssetDownloadTask
- Playback could use standard AVPlayer with downloaded assets

**Implementation Sketch**:
```swift
// Future: DownloadManager.swift
func downloadVideo(url: URL, quality: String) {
    let asset = AVURLAsset(url: url)
    
    // Create download task with quality selection
    guard let task = downloadSession.makeAssetDownloadTask(
        asset: asset,
        assetTitle: "Video",
        assetArtworkData: nil,
        options: [AVAssetDownloadTaskMinimumRequiredMediaBitrateKey: bitrateForQuality(quality)]
    ) else { return }
    
    task.resume()
}

// Delegate callbacks
func urlSession(_ session: URLSession, 
                assetDownloadTask: AVAssetDownloadTask, 
                didFinishDownloadingTo location: URL) {
    // Asset downloaded, ready for offline playback
}
```

**Migration Path**:
1. Keep KTV for streaming/caching (V1)
2. Add AVAssetDownloadTask for true offline downloads (V2)
3. Eventually migrate fully to AVAssetDownloadTask (V3)

**Decision Point**: Only pursue if:
- Offline mode is critical product requirement
- App Store has issues with KTV proxy approach
- Users demand explicit download functionality

---

### 5. Device & Network Tier-Based Configuration
**Priority**: Medium (broad device support)
**Status**: Not implemented

**Problem**:
- Current config is static (same for all devices/networks)
- Low-end devices struggle with 3 AVPlayers
- Cellular networks waste bandwidth on high-quality prefetch
- One-size-fits-all approach is suboptimal

**Solution**: Adaptive configuration based on device capabilities and network type

**Device Tiers**:
```typescript
enum DeviceTier {
    Low,    // iPhone 8, SE 2016, < 2GB RAM
    Medium, // iPhone X-12, 2-4GB RAM  
    High    // iPhone 13+, > 4GB RAM
}

function detectDeviceTier(): DeviceTier {
    const ram = DeviceInfo.getTotalMemory();
    const cpu = DeviceInfo.get CPUArchitecture();
    const model = DeviceInfo.getModel();
    
    // Detection logic...
    return tier;
}
```

**Network Tiers**:
```typescript
enum NetworkTier {
    Offline,
    Slow,    // 3G, < 1 Mbps
    Medium,  // 4G, 1-10 Mbps
    Fast     // WiFi, 5G, > 10 Mbps
}
```

**Adaptive Config**:
```typescript
const CONFIG_MATRIX = {
    [DeviceTier.Low]: {
        [NetworkTier.Slow]: {
            playerPoolSize: 1,
            prefetchStrategy: 'manifest',
            bufferSeconds: 1,
        },
        [NetworkTier.Medium]: {
            playerPoolSize: 2,
            prefetchStrategy: 'manifest',
            bufferSeconds: 2,
        },
        [NetworkTier.Fast]: {
            playerPoolSize: 2,
            prefetchStrategy: 'auto',
            bufferSeconds: 2,
        },
    },
    [DeviceTier.Medium]: {
        [NetworkTier.Slow]: {
            playerPoolSize: 2,
            prefetchStrategy: 'manifest',
            bufferSeconds: 2,
        },
        [NetworkTier.Medium]: {
            playerPoolSize: 3,
            prefetchStrategy: 'auto',
            bufferSeconds: 2,
        },
        [NetworkTier.Fast]: {
            playerPoolSize: 3,
            prefetchStrategy: 'avplayer',
            bufferSeconds: 3,
        },
    },
    [DeviceTier.High]: {
        [NetworkTier.Slow]: {
            playerPoolSize: 3,
            prefetchStrategy: 'manifest',
            bufferSeconds: 2,
        },
        [NetworkTier.Medium]: {
            playerPoolSize: 3,
            prefetchStrategy: 'auto',
            bufferSeconds: 3,
        },
        [NetworkTier.Fast]: {
            playerPoolSize: 3,
            prefetchStrategy: 'avplayer',
            bufferSeconds: 5,
        },
    },
};

// Usage
const deviceTier = detectDeviceTier();
const networkTier = monitorNetworkTier();
const config = CONFIG_MATRIX[deviceTier][networkTier];

VideoPlayerPool.setMaxPlayers(config.playerPoolSize);
CacheManager.setPrefetchStrategy(config.prefetchStrategy);
```

**Dynamic Adaptation**:
- Monitor network changes (WiFi → Cellular)
- Monitor memory warnings
- Adjust pool size and strategy in real-time
- Graceful degradation under pressure

**Benefits**:
✅ Better UX on low-end devices
✅ Bandwidth savings on cellular
✅ Optimal performance on high-end + WiFi
✅ Adaptive to changing conditions

**Implementation**:
1. Device detection on app launch
2. Network monitoring (continuous)
3. Config selection and application
4. Runtime adaptation on changes

---

### 6. CarouselPrefetchController - Horizontal Scroll Detection
**Priority**: High - better carousel UX
**Status**: ✅ Feed-level prefetch implemented, carousel horizontal scroll is future work

**Implemented:**
- ✅ FeedPrefetchController for vertical scroll
- ✅ Base PrefetchController reusable architecture
- ✅ Carousel initial videos prefetch (first 2 at high priority, rest at low priority)

**Remaining Work:**
- Detect horizontal scroll in carousel FlatList
- Create CarouselPrefetchController extending base
- Prefetch next N videos as user swipes carousel
- Nested controller with parent priority context

**Implementation**:
```typescript
// Future: rn_app/services/CarouselPrefetchController.ts
class CarouselPrefetchController extends PrefetchController {
  handleHorizontalScroll(
    visibleIndices: number[],
    allVideos: VideoData[],
    widgetIndex: number
  ): void {
    const lastVisible = Math.max(...visibleIndices);
    const lookahead = AppConfig.config.prefetch.carousel.horizontalLookahead;
    
    for (let i = 1; i <= lookahead; i++) {
      const idx = lastVisible + i;
      if (idx >= allVideos.length) break;
      
      const video = allVideos[idx];
      this.prefetchVideos([{
        id: generateVideoId(widgetIndex, idx),
        url: video.videoSource.url,
        type: video.videoSource.videoType,
      }], 50); // Medium priority (inherits parent context)
    }
  }
}

// In ShortVideoWidget carousel rendering:
<FlatList
  onViewableItemsChanged={(info) => {
    const visibleIndices = info.viewableItems.map(item => item.index);
    carouselPrefetchController.handleHorizontalScroll(visibleIndices, videos, widgetIndex);
  }}
/>
```

---

### 3. Logger Module Enhancements
**Priority**: Medium - better debugging experience

**Current State:**
- Logging by category (video, playback, prefetch, etc.)
- Logging by level (debug, info, warn, error)
- Config-based module enable/disable (static, requires app restart)

**Needed:**
- **Runtime toggle per module** - Enable/disable specific log categories without restart
- **Console filtering** - Filter logs by level in Metro console
- **UI controls** - Settings modal with checkboxes for each log category
- **Persistent preferences** - Save log settings to AsyncStorage
- **Log export** - Download logs for debugging

**Implementation**:
```typescript
// Enhanced Logger
class Logger {
  private static moduleToggles = new Map<string, boolean>();
  
  static setModuleEnabled(module: string, enabled: boolean): void {
    this.moduleToggles.set(module, enabled);
    AsyncStorage.setItem(`log_module_${module}`, JSON.stringify(enabled));
  }
  
  static isModuleEnabled(module: string): boolean {
    return this.moduleToggles.get(module) ?? true;
  }
  
  info(category: string, message: string): void {
    if (!this.isModuleEnabled(category)) return;
    // ... existing logging
  }
}

// In SettingsModal:
<Switch
  value={Logger.isModuleEnabled('prefetch')}
  onValueChange={(val) => Logger.setModuleEnabled('prefetch', val)}
/>
```

---

### 4. Prefetch Support for Non-HLS Formats
**Priority**: Medium - format flexibility
**Status**: Currently only HLS (m3u8) supported

**Current Limitation**:
- KTVHTTPCache and prefetch logic assume HLS manifests
- DASH (.mpd), MP4 (.mp4), other formats not supported
- No fallback for unknown formats

**Needed**:
- Detect video format from URL/content-type
- Route HLS → KTVHTTPCache
- Route DASH → Alternative caching (if needed)
- Route MP4 → Direct AVAsset caching
- Graceful fallback for unsupported formats

**Implementation**:
```typescript
// In PrefetchManager.ts
function detectVideoFormat(url: string): 'HLS' | 'DASH' | 'MP4' | 'UNKNOWN' {
  if (url.includes('.m3u8')) return 'HLS';
  if (url.includes('.mpd')) return 'DASH';
  if (url.includes('.mp4')) return 'MP4';
  return 'UNKNOWN';
}

async prefetchVideo(videoId: string, videoUrl: string, ...): Promise<void> {
  const format = detectVideoFormat(videoUrl);
  
  switch (format) {
    case 'HLS':
      await CacheManager.prefetchVideo(videoId, videoUrl, segmentCount);
      break;
    case 'MP4':
      // Use AVAsset preloading or direct download
      await CacheManager.prefetchMP4(videoId, videoUrl);
      break;
    case 'DASH':
      // Implement DASH prefetch if needed
      logger.warn('prefetch', `DASH not supported yet: ${videoId}`);
      break;
    default:
      logger.warn('prefetch', `Unknown format, skipping: ${videoId}`);
  }
}
```

**Native Side**:
```swift
// For MP4 direct caching
RCT_EXPORT_METHOD(prefetchMP4:(NSString *)videoId
                  videoUrl:(NSString *)videoUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    let url = URL(string: videoUrl)!
    let asset = AVURLAsset(url: url)
    
    // Preload asset for faster playback
    asset.loadValuesAsynchronously(forKeys: ["playable", "duration"]) {
        NSLog("[CacheManager] ✅ MP4 preloaded: \(videoId)")
        resolve(true)
    }
}
```

---

### 5. Separate AVPlayer and AVPlayerLayer Pooling
**Priority**: Medium - better resource management
**Status**: Currently pools AVPlayer instances, layers are created on-demand

**Problem**:
- Creating AVPlayerLayer is moderately expensive
- Multiple layers could share same player for memory efficiency
- Current design: 1 player = 1 layer (tight coupling)

**Proposed Design**:
- Pool AVPlayerLayer instances separately
- Reuse layers across different videos
- Multiple layers could point to same player (e.g., PiP scenarios)

**Benefits**:
- More layers than players (memory efficient)
- Faster layer attachment to views
- Better support for future features (PiP, multi-view)

**Implementation**:
```swift
// VideoPlayerPool.swift
class VideoPlayerPool {
    private var playerPool: [AVPlayer] = []
    private var layerPool: [AVPlayerLayer] = []  // NEW
    
    // Separate acquisition
    func acquirePlayer() -> AVPlayer { ... }
    func acquireLayer() -> AVPlayerLayer { ... }  // NEW
    
    func releasePlayer(_ player: AVPlayer) { ... }
    func releaseLayer(_ layer: AVPlayerLayer) { ... }  // NEW
}

// VideoPlayerView.swift
private var player: AVPlayer?
private var playerLayer: AVPlayerLayer?

func setupPlayer() {
    self.player = VideoPlayerPool.shared.acquirePlayer()
    self.playerLayer = VideoPlayerPool.shared.acquireLayer()
    self.playerLayer?.player = self.player
}

func cleanupPlayer() {
    self.playerLayer?.player = nil
    VideoPlayerPool.shared.releaseLayer(self.playerLayer!)
    VideoPlayerPool.shared.releasePlayer(self.player!)
}
```

**Considerations**:
- Layer reuse requires careful cleanup (remove from superlayer)
- Player/layer association management complexity
- Testing for layer lifecycle bugs

---

### 6. Manifest Rewriting for Smooth Offline Playback
**Priority**: Medium - better offline UX
**Status**: Deferred - partial playback works for now

**Current Behavior**:
- Videos prefetch first N segments (e.g., 2 segments)
- Offline playback plays cached segments, shows loader when exhausted
- AVPlayer tries to fetch remaining segments, fails, shows error/loader

**Desired Behavior**:
- Rewrite HLS manifest to only include cached segments
- Video plays smoothly to end of cached content
- Show "Offline - Limited Playback" indicator
- Optionally loop cached portion

**Implementation**:
```objc
// CacheManager.m
RCT_EXPORT_METHOD(generateOfflineManifest:(NSString *)videoId
                  originalManifestUrl:(NSString *)originalUrl
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // 1. Get prefetch stats for this video
    NSDictionary *stats = [self.prefetchStats objectForKey:videoId];
    NSInteger cachedSegments = [stats[@"segmentCount"] integerValue];
    
    // 2. Fetch original manifest
    // 3. Parse and rewrite to include only first N segments
    // 4. Add #EXT-X-ENDLIST tag (mark as complete)
    // 5. Return rewritten manifest as data URL or temp file
}
```

**Use Cases**:
- Airplane mode demos
- Low connectivity playback
- Testing cache behavior
- Offline mode feature

**Related**:
- Update VideoPlayerView to use offline manifest when network unavailable
- Add UI indicator for limited offline playback
- Consider progressive enhancement (download more segments in background)

---

### 3. Proper Error Handling for KTV Proxy Failures
**Priority**: High - currently fails hard

**Current Behavior**:
- If KTV proxy not running → error, don't play
- If URL rewrite fails → error, don't play
- Good for testing, bad for production

**Solution**:
- Fallback to original URL with warning
- Retry mechanism with exponential backoff
- User notification for persistent failures
- Graceful degradation (play without cache)

**Implementation**:
```swift
// In VideoPlayerView.swift
var finalURL = originalURL
if KTVHTTPCache.proxyIsRunning() {
  if let proxiedURL = KTVHTTPCache.proxyURL(withOriginalURL: originalURL) {
    finalURL = proxiedURL
  } else {
    NSLog("[VideoPlayerView] ⚠️ Proxy URL failed - falling back to original")
    // Continue with original URL - graceful degradation
  }
} else {
  NSLog("[VideoPlayerView] ⚠️ Proxy not running - using direct URL")
  // Continue with original URL
}
```

---

### 4. Settings Modal getValue() Fix
**Priority**: Medium - UI correctness

**Current Issue**:
- Settings modal shows incorrect values
- Nested config paths not resolving correctly

**Solution**: Already partially implemented, needs testing

---

### 5. Config-based Cache & Prefetch Toggles
**Priority**: Medium - runtime flexibility

**Add to AppConfig**:
```typescript
cache: {
  enabled: boolean;  // Master switch for cache
  maxSizeMB: number;
  // ... rest
}

prefetch: {
  enabled: boolean;  // Already exists
  feedLevel: boolean;  // New: enable FeedScreen prefetch
  cardLevel: boolean;  // New: enable VideoCard prefetch (future experiment)
  // ... rest
}
```

**Allows**:
- Disable cache entirely for testing
- A/B test different prefetch strategies
- Runtime performance tuning

---

## Medium Priority

### 6. Testing Harness Integration
**Goal**: Automated testing for video playback

**Components**:
- Automated playback tests (play, pause, seek)
- Cache hit/miss metrics
- Network simulation (Fast 3G, offline)
- Performance regression tests

**Tools**:
- Detox for E2E testing
- Custom metrics collection
- CI/CD integration

---

### 7. Manifest Template System
**For**: Offline playback support

**Features**:
- Template-based offline manifests
- Dynamic segment URL rewriting
- HLS/DASH support
- Mock server for offline mode

---

### 8. Prefetch Quality/Bitrate Selection
**Priority**: Medium - bandwidth optimization

**Goal:** Allow configurable prefetch quality to balance bandwidth vs startup time

**Configuration:**
```typescript
prefetch: {
  quality: 'lowest' | 'optimum' | 'maximum',
  adaptiveBitrate: boolean,  // Auto-select based on network speed
}
```

**Quality Levels:**
- **Lowest**: Prefetch lowest bitrate variant (saves bandwidth, slower quality ramp-up)
- **Optimum** (default): Prefetch mid-tier bitrate (balanced)
- **Maximum**: Prefetch highest bitrate (best quality, higher bandwidth)

**Adaptive Bitrate:**
- Detect network speed (slow/fast)
- Automatically select appropriate quality
- Switch quality based on network changes

**Use Cases:**
- Mobile data: Use lowest to save bandwidth
- WiFi: Use optimum or maximum
- Limited data plan: Force lowest
- Premium experience: Force maximum

**Implementation:**
- Parse HLS manifest to identify bitrate variants
- Select appropriate variant URL for prefetch
- Pass quality parameter to PrefetchManager
- Integrate with network detection

---

### 9. Advanced Prefetch Strategies
**Experimental**: ML-based prefetch

**Ideas**:
- User behavior learning (watch patterns)
- Bandwidth-aware prefetching (adjust segment count)
- Time-of-day prediction
- Content popularity scoring

---

## Low Priority

### 9. Cache Eviction Policies
**Current**: Basic LRU

**Enhancements**:
- LRU with priority (don't evict popular content)
- Size-based limits with soft/hard thresholds
- Time-based expiration (TTL)
- User-specific cache partitioning

---

### 10. Performance Monitoring Dashboard
**Goal**: Real-time observability

**Metrics**:
- Cache efficiency (hit rate, bandwidth saved)
- Prefetch success rate
- Video startup latency
- Scroll performance (FPS)
- Memory usage over time

**UI**:
- Expand debug overlays
- Metrics export (JSON, CSV)
- Historical graphs

---

### 11. Documentation Complete Update
**Status**: Partially done

**Remaining**:
- Update TESTING_GUIDE.md with TC-006, TC-007, TC-008
- Update COMPONENT_DOCUMENTATION.md with 6-state visibility model
- Update ARCHITECTURE.md with:
  - State machine diagram
  - KTV cache flow
  - Prefetch architecture (FeedScreen-level)
- Add troubleshooting guide

---

## Research & Exploration

### 12. Alternative Caching Solutions
- Compare KTVHTTPCache vs custom proxy
- Evaluate AVAssetResourceLoader delegate approach
- Consider system-level caching (URLCache)

### 13. Live Streaming Optimizations
- Low-latency HLS (LL-HLS)
- Chunked-CMAF
- Prefetch for live (first few segments)

### 14. Adaptive Bitrate Logic
- Quality selection based on bandwidth
- Smooth quality transitions
- User preference integration

---

## Maintenance & Tech Debt

### 15. Code Cleanup
- Remove commented-out code
- Consolidate utility functions
- Standardize error handling patterns

### 16. Type Safety Improvements
- Remove all `any` types
- Strict null checks
- Proper event type definitions

### 17. Performance Profiling
- Regular Instruments profiling
- Memory leak detection
- Render performance optimization

---

## Low Priority (Future Work)

### 18. UI Freezing on Network Loss
**Priority**: Low (debug mode issue, not production critical)
**Status**: Under investigation

**Problem:**
- UI freezes for several seconds when scrolling while offline
- Occurs every time a video card enters visibility range
- May be related to debug mode or KTV proxy operations

**Current Mitigations:**
- ✅ Added timing logs to identify blocking operations
- ✅ Added 15s timeout for stuck loads
- ✅ Added cancellation mechanism

**Future Solutions:**
- Move player attachment to background thread
- Use async player initialization
- Consider AVAssetDownloadTask (no proxy overhead)
- Investigate KTV threading model

**Note**: This appears to be a debug mode issue and may not affect production builds.

### 19. Network Recovery/Auto-retry
**Priority**: Low (graceful degradation works)
**Status**: Not implemented

**Problem:**
- Videos stuck in loading state after network failure
- No automatic retry when network returns
- User must scroll away and back to retry

**Future Solutions:**
- Add NetworkMonitor utility
- Retry failed loads on network return
- Show error/retry button after timeout
- Investigate KTV session management

---

## How to Use This Document

1. **After each session**: Move completed items to CHANGELOG.md
2. **When prioritizing**: Pull from High Priority first
3. **When blocked**: Pick from Medium/Low priority
4. **Add new ideas**: Insert in appropriate priority section
5. **Review quarterly**: Re-prioritize based on user feedback

---

**Last Updated**: October 11, 2025

