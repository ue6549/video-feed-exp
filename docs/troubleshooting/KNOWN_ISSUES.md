# Known Issues & Limitations

## Critical Issues

### 1. UI Freezing on Network Loss During Scroll
**Status**: Under Investigation (Debug Mode Issue)  
**Priority**: Low (Debug mode issue, not production critical)  
**Affects**: Debug builds when scrolling while offline

**Symptoms:**
- User scrolls feed while offline
- UI freezes for several seconds
- Freeze occurs **every time** a video card enters visibility range
- Affects user experience significantly

**Root Cause (Hypothesis):**
Player attachment on main thread blocks UI:
```typescript
// VideoCard.tsx - Runs on main thread during scroll
setIsPlayerAttached(true)
  ↓
// VideoPlayerView.swift - setupPlayer()
KTVHTTPCache.proxyURL(withOriginalURL: url)  // ← May block main thread
AVPlayerItem(url: proxiedURL)                 // ← Network check may block
```

**Potential Causes:**
1. `KTVHTTPCache.proxyURL()` may perform synchronous network check
2. `AVPlayerItem` initialization may block on URL validation
3. VideoPlayerPool acquisition may be slow
4. Combination of all above

**Mitigations Added:**
- ✅ Added timing logs to identify exact blocking point
- ✅ Added 15s timeout for stuck loads
- ✅ Added cancellation mechanism

**Testing Needed:**
1. Measure time for each step (logs added)
2. Test if KTV proxy call blocks
3. Test if AVPlayerItem init blocks
4. Profile with Instruments (Time Profiler)

**Workarounds:**
- Avoid scrolling while offline
- Clear cache before going offline (fewer stuck states)

**Future Solutions:**
- Move player attachment to background thread
- Use async player initialization
- Consider AVAssetDownloadTask (no proxy overhead)

---

### 2. Stuck Loading States After Network Failure
**Status**: Mitigation implemented  
**Priority**: Medium  
**Affects**: Videos that start loading during network transition

**Symptoms:**
- Video enters loading state when network is poor/offline
- Network returns to normal
- Video stays stuck in loading state (doesn't recover)
- Player may be holding resources, not releasing

**Root Cause (Hypothesis):**
1. **AVPlayer doesn't retry** - Once failed, stays failed
2. **KTV session stuck** - Proxy may not handle network transitions well
3. **Player not released** - Holds resources even after failure

**Current Behavior:**
```
Network ON → Video starts loading → Network OFF
  ↓
AVPlayer tries to load → Times out/fails
  ↓
Video stuck in loading state
  ↓
Network ON → No automatic retry ❌
```

**Mitigations Added:**
- ✅ 15s timeout for playback loads
- ✅ Timeout triggers error and releases player
- ✅ `cancelAllPrefetches()` method

**Still Missing:**
- ❌ Automatic retry on network return
- ❌ Network reachability detection
- ❌ Clear error UI (currently just shows loader)

**Workarounds:**
- Scroll away and back (forces reload)
- Kill and restart app

**Future Solutions:**
- Add NetworkMonitor utility
- Retry failed loads on network return
- Show error/retry button after timeout
- Investigate KTV session management

---

## Medium Priority Issues

### 3. Rebuffering of Prefetched Videos During Playback
**Status**: Expected behavior  
**Priority**: Medium  
**Affects**: Videos that were prefetched but switched bitrate during playback

**Symptoms:**
- Video was prefetched successfully
- Video starts playing
- Rebuffering occurs mid-playback
- Cache appears to not help

**Root Cause:**
AVPlayer adaptive bitrate switching:
```
Prefetch: Network good (WiFi) → Downloaded 720p segments
Playback: Network degraded → AVPlayer switches to 540p
Result: 540p segments not cached → Downloads from network
```

**This is EXPECTED AVPlayer behavior** - Not a bug!

**Why It Happens:**
- AVPlayer constantly monitors network conditions
- Switches quality mid-playback for smooth experience
- Prefetched quality may not match current playback quality

**Mitigation (Future):**
- Network-aware prefetch (match quality to current network)
- Set `preferredPeakBitRate` to match prefetched quality
- Manifest rewriting (force cached quality only)

**Current Status:** Acceptable for V1

---

### 4. Master Playlists Not Supported in Manifest-Only Fallback
**Status**: Documented limitation  
**Priority**: Medium  
**Affects**: Videos with master playlists when player pool exhausted

**Symptoms:**
- Prefetch request when pool exhausted
- Falls back to manifest-only mode
- Detects master playlist
- Logs error but caches manifest anyway

**Current Behavior:**
```
Pool exhausted → Manifest fallback
  ↓
Fetch master playlist → Detects #EXT-X-STREAM-INF
  ↓
Logs: "Master playlist detected (manifest-only mode)"
Logs: "Manifest cached, but segments require AVPlayer prefetch"
  ↓
Returns success (manifest cached, no segments)
```

**Impact:**
- Manifest cached (better than nothing)
- No segments cached
- Offline playback won't work for these videos
- Online playback still works (downloads on-demand)

**Workaround:**
- AVPlayer prefetch handles master playlists automatically
- Most videos get AVPlayer prefetch (only ~20-30% fallback to manifest)

**Future Solution:**
- Parse master playlist
- Fetch first variant
- Cache variant's segments
- (This is complex, low priority for now)

---

### 5. Player Pool Exhaustion Shows Thumbnail (No Play Button)
**Status**: Known limitation  
**Priority**: Low  
**Affects**: Edge cases when 4+ videos visible simultaneously

**Symptoms:**
- Video enters active state (should play)
- Player pool exhausted (3/3 busy)
- Video shows thumbnail only (no playback)
- No visual indication that play is unavailable

**Current Behavior:**
- VideoCard tries to attach player
- Pool returns nil (exhausted)
- Video just shows thumbnail
- User may think video is broken

**Mitigation:**
- Visibility thresholds tuned to prevent this
- Rarely occurs in normal usage

**Future Solution:**
- Show play button overlay when pool exhausted
- Manual play triggers queue/retry
- Or implement priority eviction (future work)

---

## Testing & Validation Issues

### 6. AppConfig Changes Not Fully Tested
**Status**: Needs testing framework  
**Priority**: Medium

**Problem:**
- Many configurable parameters
- No systematic testing
- Unknown if all settings actually work
- No validation on invalid values

**Missing:**
- Unit tests for config system
- Integration tests for settings modal
- Manual test checklist
- Config validation logic

**See:** FUTURE_WORK.md → "AppConfig Testing & Verification"

---

## Performance Limitations

### 7. Memory Usage Spikes with 3 Concurrent AVPlayers
**Status**: Expected behavior  
**Priority**: Low

**Typical Memory Usage:**
- Baseline: ~80 MB
- 1 video playing: ~150 MB
- 3 videos playing: ~250-350 MB
- Peak during prefetch: ~300-400 MB

**This is acceptable** for modern iOS devices (2GB+ RAM)

**Mitigation:**
- Hard limit of 3 players
- Players released after prefetch completes
- Memory warnings trigger cleanup (future)

---

## Compatibility & Platform

### 8. iOS Only Implementation
**Status**: By design  
**Priority**: N/A (Android out of scope)

Current implementation is iOS-only:
- KTVHTTPCache (iOS only)
- VideoPlayerView (AVPlayer - iOS)
- VideoPlayerPool (iOS)

Android would need separate implementation.

---

## Network & Connectivity

### 9. No Offline Indicator in UI
**Status**: Missing feature  
**Priority**: Low

**Problem:**
- User doesn't know when offline
- Videos fail to load with no explanation
- Confusing UX

**Future:**
- Add network status indicator
- Filter feed to show only cached videos when offline
- Clear messaging when content unavailable

---

### 10. Concurrent Request Deduplication (Prefetch + Playback Overlap)
**Status**: Known limitation (AVAssetDownloadTask migration)  
**Priority**: Low (Edge case, CDN cache mitigates)  
**Affects**: Videos that are prefetching when user scrolls them into viewport

**Symptoms:**
- Video prefetch starts (AVAssetDownloadTask downloading segment-001.ts)
- User scrolls quickly, video enters viewport
- AVPlayer starts playback, requests same segment-001.ts
- **Result**: Two simultaneous CDN requests for same segment

**Root Cause:**

KTVHTTPCache is a **caching proxy**, not a **request coalescing proxy**:
- ✅ **Cache hits**: Segment already on disk → serves from cache (no CDN request)
- ❌ **Cache misses**: Segment not yet downloaded → forwards BOTH requests to CDN
- ❌ **No in-flight tracking**: Doesn't track "currently downloading" segments to coalesce requests

**Scenario Timeline:**
```
T0: AVAssetDownloadTask → segment-001.ts → KTV → CDN (Request #1 starts)
T1: User scrolls (200ms later)
T2: AVPlayer → segment-001.ts → KTV → CDN (Request #2 starts)
T3: Both requests complete (~500ms later)

Result: 80% of segment downloaded twice from CDN
```

**Impact:**
- Wasted bandwidth (duplicate data transfer)
- Increased CDN costs
- Potential network congestion on slow connections
- **Mitigation**: CDN cache helps (second request may hit CDN cache)

**When This Occurs:**
- User scrolls fast during active prefetch
- Prefetch hasn't completed before video enters viewport
- **Frequency**: Edge case (~5-10% of prefetch scenarios)

**Why Not Fixed Yet:**
- Low priority (CDN cache mitigates latency impact)
- Acceptable for POC/MVP phase
- Would require complex infrastructure changes

**Future Solutions:**

**Option 1: Smart Cancellation** (Simple, recommended for Phase 2)
```typescript
// Cancel prefetch when video enters "prepareToBeActive" (25% visible)
onVisibilityChange(state) {
  if (state === 'prepareToBeActive') {
    CacheManager.cancelPrefetch(videoId);
    setTimeout(() => setIsPlayerAttached(true), 50);
  }
}
```
- ✅ Simple implementation
- ✅ No duplicate requests
- ⚠️ 50ms delay, loses last 200-300ms of prefetch

**Option 2: Request Coalescing Wrapper** (Complex, Phase 3)
```swift
class KTVRequestCoordinator {
  private var inflightRequests: [String: [CompletionHandler]] = [:]
  
  func fetchSegment(url: String, completion: @escaping (Data?) -> Void) {
    if inflightRequests[url] != nil {
      inflightRequests[url]?.append(completion)  // Wait for in-flight
      return
    }
    
    inflightRequests[url] = [completion]
    KTVHTTPCache.fetch(url) { data in
      self.inflightRequests[url]?.forEach { $0(data) }  // Notify all
      self.inflightRequests.removeValue(forKey: url)
    }
  }
}
```
- ✅ Perfect deduplication
- ✅ Transparent to clients
- ❌ Complex KTV integration
- ❌ Memory overhead

**Option 3: Fork KTV** (Most complex, long-term)
- Modify KTVHTTPCache source to track in-flight requests
- ✅ Native solution
- ❌ Maintenance burden, lose upstream updates

**Current Status:** Accepted limitation, monitored via metrics

**See Also:**
- [PREFETCH_IMPLEMENTATION_FUTURE.md](../architecture/PREFETCH_IMPLEMENTATION_FUTURE.md#concurrent-request-handling-known-limitation) - Detailed analysis
- [PREFETCH_REQUIREMENTS_DESIGN.md](../architecture/PREFETCH_REQUIREMENTS_DESIGN.md) - Design decisions

---

## Summary

**Critical (Fix Now):**
- UI freezing on network changes
- Stuck loading states

**Medium (Fix Soon):**
- Rebuffering during playback
- Master playlist support in fallback
- AppConfig testing

**Low (Future):**
- Play button on pool exhaustion
- Memory optimization
- Offline indicators

See `FUTURE_WORK.md` for detailed solutions and implementation plans.

