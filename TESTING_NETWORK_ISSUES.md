# Testing Guide: Network Issues & Error Handling

## Purpose
Test the app's behavior under various network conditions to identify and reproduce UI freezing and stuck loading states.

## Prerequisites
- iOS Simulator running
- Xcode console open
- Network Link Conditioner enabled (Settings → Developer → Network Link Conditioner)

---

## Test 1: UI Freeze on Network Loss

### Setup
1. Launch app with WiFi enabled
2. Scroll to load 5-10 videos
3. Let videos prefetch (wait for "Buffer target reached" logs)

### Test Steps
1. **Turn off network:**
   - Network Link Conditioner → 100% Loss
   - OR: Settings → Airplane Mode ON

2. **Scroll the feed slowly:**
   - Scroll down to next video
   - Observe UI responsiveness
   - Note freeze duration

3. **Monitor logs** (filter by `[VideoPlayerView]`):
```bash
# Expected logs:
[VIDEO] [vid-X] ⏱️ Player attachment took XXms  ← Check this value
[VideoPlayerView] 🚀 setupPlayer() called
[VideoPlayerView] ✅ Proxied URL: ... (took XXms)  ← Check this value
[VideoPlayerView] ⏱️ setupPlayer() completed in XXms  ← Total time
```

### Success Criteria
- ✅ Logs show timing for each step
- ✅ Identify which step takes > 1000ms (blocking)
- ✅ UI freeze duration logged

### Expected Results
**If KTV proxy blocks:**
```
[VideoPlayerView] ✅ Proxied URL: ... (took 3000ms)  ← BLOCKING!
```

**If AVPlayerItem blocks:**
```
[VideoPlayerView] ✅ Proxied URL: ... (took 10ms)
[VideoPlayerView] ⏱️ setupPlayer() completed in 2500ms  ← BLOCKING!
```

---

## Test 2: Stuck Loading State After Network Failure

### Setup
1. Launch app with WiFi
2. Scroll to video that hasn't been prefetched

### Test Steps
1. **Start video load during network transition:**
   - Scroll to new video (shows thumbnail)
   - Video enters active state (50% visible)
   - **Immediately turn off network** (within 1-2 seconds)

2. **Observe video state:**
   - Does it show loader? ✅ or ❌
   - Does it timeout after 15s? ✅ or ❌
   - Does it show error? ✅ or ❌

3. **Turn network back on:**
   - Wait 5 seconds
   - Does video retry automatically? ✅ or ❌
   - Does it stay stuck? ✅ or ❌

4. **Monitor logs:**
```bash
# Filter by: [VideoPlayerView]

# Expected:
[VideoPlayerView] 📹 Setting up player for video: vid-X
[VideoPlayerView] ⏱️ Started buffering
... (15 seconds) ...
[VideoPlayerView] ⏱️ Load timeout (15s) - cancelling stuck load  ← Should see this
```

### Success Criteria
- ✅ Timeout triggers after 15s
- ✅ Error event emitted to RN
- ✅ Player resources released
- ❌ Automatic retry (not yet implemented)

---

## Test 3: Prefetch Timeout Behavior

### Setup
1. Clear cache
2. Set slow network (Network Link Conditioner → 3G)

### Test Steps
1. **Launch app and scroll:**
   - Scroll slowly through feed
   - Let prefetch system work

2. **Monitor prefetch logs:**
```bash
# Filter by: [CacheManager]

# Expected on slow network:
[CacheManager] 🎬 AVPlayer prefetch: vid-X
[CacheManager] ⏱️ Started buffering (target: 2.0s, timeout: 5.0s)
[CacheManager] 📊 vid-X loaded 0.5s
[CacheManager] 📊 vid-X loaded 1.0s
... (5 seconds total) ...
[CacheManager] ⏱️ Timeout for vid-X  ← Should trigger at 5s
[CacheManager] 🛑 Stopping AVPlayer prefetch (reason: timeout)
```

### Success Criteria
- ✅ Timeout triggers at 5s (not 10s)
- ✅ Player released
- ✅ Next prefetch can proceed

---

## Test 4: Player Pool Under Network Stress

### Setup
1. Set very slow network (Network Link Conditioner → Edge)
2. Launch app

### Test Steps
1. **Scroll quickly through feed:**
   - Trigger many prefetch requests
   - All will timeout slowly

2. **Monitor pool state:**
```bash
# Filter by: [VideoPlayerPool]

# Expected:
[VideoPlayerPool] ✅ Acquired player (active: 1)
[VideoPlayerPool] ✅ Acquired player (active: 2)
[VideoPlayerPool] ✅ Acquired player (active: 3)
[VideoPlayerPool] ⚠️ Pool exhausted (active: 3/3)
... (5s timeout) ...
[CacheManager] ✅ Player released
[VideoPlayerPool] (active: 2/3)  ← Pool recovers
```

### Success Criteria
- ✅ Pool caps at 3/3
- ✅ Players release after timeout
- ✅ Pool recovers (not permanently exhausted)
- ✅ Manifest fallback kicks in

---

## Test 5: Network Recovery

### Setup
1. Videos in various states (some prefetched, some loading, some not started)

### Test Steps
1. **Turn off network**
2. **Scroll around** (some videos will try to load)
3. **Wait 20 seconds** (timeouts should trigger)
4. **Turn network back on**
5. **Scroll to failed videos** - Do they retry?

### Current Behavior (Expected)
- ❌ No automatic retry (videos stay in error state)
- ✅ Scroll away and back triggers reload
- ✅ New videos load normally

### Future Behavior (After NetworkMonitor)
- ✅ Automatic retry on network return
- ✅ Clear error states
- ✅ Resume prefetch

---

## Debugging Commands

### Monitor UI Freeze
```bash
# In Xcode console, search for:
Player attachment took

# If you see > 1000ms, that's the blocking operation
[VIDEO] [vid-X] ⏱️ Player attachment took 3245ms  ← FREEZE!
```

### Monitor Stuck Loads
```bash
# Search for timeouts:
Load timeout

# Count how many:
grep "Load timeout" xcode.log | wc -l
```

### Monitor Pool Health
```bash
# Pool should recover:
grep "Pool exhausted\|Player released" xcode.log

# Expected pattern:
Pool exhausted (active: 3/3)
Player released (active: 2/3)  ← Recovers
Player released (active: 1/3)
```

---

## Known Issues Reference

See `KNOWN_ISSUES.md` for:
- Issue #1: UI Freezing on Network Loss
- Issue #2: Stuck Loading States
- Issue #3: Rebuffering (expected behavior)
- Issue #4: Master Playlists in Fallback Mode

---

## Success Metrics

### Good Performance
- UI freeze: < 100ms (imperceptible)
- Load timeout: < 5% of requests
- Pool recovery: Always recovers within 10s
- Prefetch success rate: > 80%

### Acceptable Performance
- UI freeze: < 500ms (noticeable but tolerable)
- Load timeout: < 20% of requests
- Pool recovery: Recovers within 30s
- Prefetch success rate: > 50%

### Unacceptable Performance (Needs Fix)
- UI freeze: > 1000ms (very noticeable)
- Load timeout: > 30% of requests
- Pool never recovers (stuck at 3/3)
- Prefetch success rate: < 30%

---

## Next Steps Based on Results

### If UI Freeze < 500ms:
- Acceptable, optimize later
- Focus on other issues

### If UI Freeze > 1000ms:
**Option A**: Move player attachment off main thread
**Option B**: Investigate KTV proxy threading
**Option C**: Consider AVAssetDownloadTask migration

### If Players Don't Release:
- Debug timeout mechanism
- Check KVO observations
- Verify cleanup logic

### If Network Recovery Fails:
- Implement NetworkMonitor
- Add retry logic
- Add error UI

---

## Test Report Template

```
Test Date: ___________
iOS Version: ___________
Simulator: ___________
Network Profile: ___________

Test 1 (UI Freeze):
- Freeze duration: _____ms
- Blocking step: _______
- Acceptable: YES / NO

Test 2 (Stuck Loading):
- Timeout triggered: YES / NO
- Recovery on network return: YES / NO
- Acceptable: YES / NO

Test 3 (Prefetch Timeout):
- Timeout at 5s: YES / NO
- Player released: YES / NO
- Acceptable: YES / NO

Test 4 (Pool Recovery):
- Pool caps at 3: YES / NO
- Pool recovers: YES / NO
- Time to recover: _____s

Test 5 (Network Recovery):
- Auto retry: YES / NO
- Manual retry works: YES / NO

Overall Assessment:
- Critical issues: _______
- Medium issues: _______
- Ready for production: YES / NO

Recommendation:
______________________________
______________________________
```

