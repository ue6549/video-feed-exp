# VideoFeedApp - Future Work & Backlog

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

### 2. CarouselPrefetchController - Horizontal Scroll Detection
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

### 2. Proper Video IDs (Not URLs)
**Priority**: High - cleaner architecture

**Current Issue**:
- `item.id` is set to full video URL
- Makes logs verbose and unclear
- Mixing concerns (identity vs location)

**Solution**:
- Generate unique IDs: hash of URL, or sequential, or from backend
- Store ID→URL mapping if needed
- Update VideoCard to use clean IDs

**Example**:
```typescript
// In VideoCard or DataProvider
const generateVideoId = (url: string): string => {
  // Option 1: Hash
  return `video_${hashCode(url)}`;
  
  // Option 2: Sequential
  return `video_${index}`;
  
  // Option 3: Extract from URL
  return url.match(/MED[A-Z0-9]+/)?.[0] || url;
};
```

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

## How to Use This Document

1. **After each session**: Move completed items to CHANGELOG.md
2. **When prioritizing**: Pull from High Priority first
3. **When blocked**: Pick from Medium/Low priority
4. **Add new ideas**: Insert in appropriate priority section
5. **Review quarterly**: Re-prioritize based on user feedback

---

**Last Updated**: October 11, 2025

