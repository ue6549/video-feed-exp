# Configurable Parameters - Complete Reference

## Overview
All configurable parameters in VideoFeedApp with their purposes, valid ranges, and impact on native modules.

## Configuration Architecture

### AppConfig.ts
**Source of truth** for all configuration
- Centralized in `rn_app/config/AppConfig.ts`
- Synced to native modules on app startup
- Can be updated at runtime via Settings modal
- Some changes require app reload

---

## Player Pool Configuration

### `playerPool.maxPlayers`
**Type:** `number`  
**Default:** `3`  
**Valid Range:** `1-10`  
**Native Module:** `VideoPlayerPool.swift`

**Purpose:**
- Hard limit on AVPlayer pool size
- Controls memory usage and concurrency
- Affects both playback AND prefetch

**Impact:**
- **Lower (1-2):** Less memory, fewer concurrent videos, more pool exhaustion
- **Higher (4-5):** More memory, more concurrent videos, fewer fallbacks
- **Recommended:** 3 for balanced performance

**How It's Used:**
- `VideoPlayerPool.tryAcquirePlayer()` checks this limit
- Returns `nil` if pool exhausted
- Triggers manifest-only fallback for prefetch

**Synced to Native:**
```typescript
// On app startup (App.tsx)
await VideoPlayerPool.setMaxPlayers(AppConfig.config.playerPool.maxPlayers);

// On runtime update (Settings modal)
await VideoPlayerPool.setMaxPlayers(newValue);
```

**Verification:**
```bash
# In Xcode logs, filter by:
[VideoPlayerPool]

# Look for:
[VideoPlayerPool] ✅ Created new player (active: X/3)
[VideoPlayerPool] ⚠️ Pool exhausted (active: 3/3)
```

---

### `playerPool.avplayerPrefetchBufferSeconds`
**Type:** `number`  
**Default:** `2.0`  
**Valid Range:** `0.5-30.0`  
**Native Module:** `CacheManager.m`

**Purpose:**
- Target buffer duration for AVPlayer prefetch
- Controls how much video data to download per prefetch
- Affects bandwidth usage and cache hit rate

**Impact:**
- **Lower (1s):** Less bandwidth, faster prefetch, may stutter on play
- **Higher (5s):** More bandwidth, slower prefetch, smoother playback
- **Recommended:** 2-3s for instant playback

**How It's Used:**
- `item.preferredForwardBufferDuration = bufferSeconds`
- Monitor `loadedTimeRanges` to check when target reached
- Release player after reaching target

**Synced to Native:**
```typescript
await CacheManager.setPrefetchConfig(bufferSeconds, timeoutSeconds);
```

**Verification:**
```bash
# In Xcode logs:
[CacheManager] ⏱️ Started buffering for vid-X (target: 2.0s, timeout: 10.0s)
[CacheManager] 📊 vid-X loaded 2.1s
[CacheManager] ✅ Buffer target reached for vid-X (2.1s)
```

---

### `playerPool.avplayerPrefetchTimeoutSeconds`
**Type:** `number`  
**Default:** `10.0`  
**Valid Range:** `3.0-60.0`  
**Native Module:** `CacheManager.m`

**Purpose:**
- Safety timeout for AVPlayer prefetch
- Prevents hung prefetches on slow/broken networks
- Ensures player is eventually released

**Impact:**
- **Lower (5s):** More aggressive, may timeout on slow networks
- **Higher (30s):** More patient, wastes time on broken connections
- **Recommended:** 10-15s

**How It's Used:**
- `NSTimer` scheduled after starting prefetch
- If reaches timeout before buffer target → Force stop and release player

**Synced to Native:**
```typescript
await CacheManager.setPrefetchConfig(bufferSeconds, timeoutSeconds);
```

**Verification:**
```bash
# Timeout triggered:
[CacheManager] ⏱️ Timeout for vid-X
[CacheManager] 🛑 Stopping AVPlayer prefetch for vid-X (reason: timeout)

# Normal completion (before timeout):
[CacheManager] ✅ Buffer target reached for vid-X
[CacheManager] 🛑 Stopping AVPlayer prefetch for vid-X (reason: buffer_full)
```

---

## Prefetch Configuration

### `prefetch.enabled`
**Type:** `boolean`  
**Default:** `true`  
**Native Module:** None (RN only)

**Purpose:**
- Master switch for all prefetching
- Disable to save bandwidth

**Impact:**
- `false`: No prefetch requests sent, videos load on-demand
- `true`: Proactive prefetching based on scroll position

---

### `prefetch.strategy`
**Type:** `'auto' | 'avplayer' | 'manifest'`  
**Default:** `'auto'`  
**Native Module:** `CacheManager.m` (future)

**Purpose:**
- Control prefetch strategy
- **'auto':** Try AVPlayer first, fallback to manifest
- **'avplayer':** Only AVPlayer (fail if no player available)
- **'manifest':** Only manifest (never use AVPlayer)

**Impact:**
- `'auto'`: Balanced - best UX, graceful degradation
- `'avplayer'`: Best quality matching, but may skip videos
- `'manifest'`: Consistent behavior, but lower cache hit rate

**Status:** ⚠️ Defined in config but not yet implemented in native
**Future:** Pass to `CacheManager.prefetchVideo()` to control strategy

---

### `prefetch.segmentCount`
**Type:** `number`  
**Default:** `2`  
**Valid Range:** `1-10`  
**Native Module:** `CacheManager.m` (manifest-only mode)

**Purpose:**
- How many segments to download in manifest-only fallback
- Affects bandwidth and cache size

**Impact:**
- **Lower (1):** Minimal caching, may stutter
- **Higher (5):** More cached, smoother playback, more bandwidth
- **Note:** For AVPlayer mode, this is controlled by `bufferSeconds`, not segment count

**How It's Used:**
- Passed to `CacheManager.prefetchVideo(videoId, url, segmentCount)`
- Only used in manifest-only fallback path

---

### `prefetch.maxConcurrent`
**Type:** `number`  
**Default:** `3`  
**Valid Range:** `1-10`  
**Native Module:** None (RN only)

**Purpose:**
- Max concurrent native prefetch calls
- Controls bandwidth and CPU usage
- Affects how fast prefetch queue processes

**Impact:**
- **Lower (1):** Sequential prefetch, slower but less resource intensive
- **Higher (10):** Parallel prefetch, faster but more bandwidth/CPU
- **Recommended:** 3-5

**How It's Used:**
- `PrefetchManager.ts` tracks active downloads
- Only dispatches new requests when `active < maxConcurrent`

**Verification:**
```bash
# In logs:
[PREFETCH] 📊 Queue: 6, Active: 3  ← Active never exceeds maxConcurrent
```

---

## Current State Summary

### ✅ Fully Implemented & Synced to Native:
1. **playerPool.maxPlayers** - Synced on startup via `VideoPlayerPool.setMaxPlayers()`
2. **playerPool.avplayerPrefetchBufferSeconds** - Synced via `CacheManager.setPrefetchConfig()`
3. **playerPool.avplayerPrefetchTimeoutSeconds** - Synced via `CacheManager.setPrefetchConfig()`

### ⚠️ Defined But Not Yet Synced to Native:
4. **prefetch.strategy** - Defined in AppConfig, not yet used in native logic

### ✅ RN-Only (No Native Sync Needed):
5. **prefetch.enabled** - Checked in PrefetchManager before dispatching
6. **prefetch.maxConcurrent** - Enforced in PrefetchManager queue
7. **prefetch.segmentCount** - Passed as parameter to native

---

## Initialization Flow

```typescript
// App.tsx - On startup
useEffect(() => {
    initNativeConfig();  // Sync AppConfig to native modules
    metricsInit();
}, []);

async function initNativeConfig() {
    // 1. Player pool
    await VideoPlayerPool.setMaxPlayers(
        AppConfig.config.playerPool.maxPlayers
    );
    
    // 2. Prefetch settings
    await CacheManager.setPrefetchConfig(
        AppConfig.config.playerPool.avplayerPrefetchBufferSeconds,
        AppConfig.config.playerPool.avplayerPrefetchTimeoutSeconds
    );
    
    console.log('[App] ✅ Native config initialized');
}
```

---

## Runtime Updates (Settings Modal)

**When user changes settings:**
```typescript
// SettingsModal.tsx
const handleSave = async () => {
    const requiresReload = AppConfig.update(newConfig);
    
    // Sync to native
    await VideoPlayerPool.setMaxPlayers(newConfig.playerPool.maxPlayers);
    await CacheManager.setPrefetchConfig(
        newConfig.playerPool.avplayerPrefetchBufferSeconds,
        newConfig.playerPool.avplayerPrefetchTimeoutSeconds
    );
    
    if (requiresReload) {
        Alert.alert('Restart Required', 'Some changes require app restart');
    }
};
```

---

## Testing Checklist

### Unit Tests Needed:
- [ ] AppConfig.update() applies changes
- [ ] AppConfig.validateConfig() rejects invalid values
- [ ] Native sync methods are called on startup
- [ ] Settings modal triggers native sync

### Integration Tests Needed:
- [ ] Change maxPlayers → Verify pool respects new limit
- [ ] Change bufferSeconds → Verify prefetch stops at new target
- [ ] Change timeoutSeconds → Verify timeout uses new value
- [ ] Change strategy → Verify correct prefetch path taken

### Manual Tests Needed:
- [ ] Open Settings → Change maxPlayers to 2 → Save → Verify pool logs show "2/2"
- [ ] Change bufferSeconds to 5 → Verify logs show "loaded 5.0s"
- [ ] Change timeoutSeconds to 5 → Verify timeout at 5s (on slow network)

---

## Missing: Strategy Config Implementation

**Current:** Strategy is hardcoded to 'auto' in native

**Needed:** Pass strategy from RN to native

```objc
// CacheManager.m - Modify prefetchVideo to accept strategy
RCT_EXPORT_METHOD(prefetchVideo:(NSString *)videoId
                  videoUrl:(NSString *)videoUrl
                  segmentCount:(NSInteger)segmentCount
                  strategy:(NSString *)strategy  // ← Add this
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    if ([strategy isEqualToString:@"avplayer"]) {
        // Force AVPlayer only
    } else if ([strategy isEqualToString:@"manifest"]) {
        // Force manifest only
    } else {
        // Auto (current behavior)
    }
}
```

**Priority:** Medium (works fine with 'auto' for now)

---

## Summary

**Implemented:** ✅  
- playerPool.maxPlayers (3)
- playerPool.avplayerPrefetchBufferSeconds (2.0)  
- playerPool.avplayerPrefetchTimeoutSeconds (10.0)

**Future Work:** ⚠️
- prefetch.strategy (auto/avplayer/manifest selection)
- Config validation
- Settings persistence
- Unit/integration tests

All documented in `FUTURE_WORK.md` → "AppConfig Testing & Verification"

