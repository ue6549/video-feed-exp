# Prefetch Status - Current Implementation

## Overview
This document summarizes the current state of video prefetching and caching in VideoFeedApp, including what's working, what's expected, and what's planned for the future.

## Current Implementation Status

### ✅ What's Working

**Online Playback:**
- Videos play smoothly when online
- AVPlayer handles adaptive bitrate selection
- KTVHTTPCache proxy provides transparent caching
- Player pool management (3-player hard limit)

**Prefetch System:**
- **AVPlayer Prefetch**: Downloads 2+ seconds of video segments
- **Manifest-Only Fallback**: Caches master playlist when pool exhausted
- **Pool Management**: Hard limit of 3 players, graceful fallback
- **Configuration**: Runtime configurable buffer/timeout settings

**Offline Playback:**
- **Previously played videos**: Play fully offline ✅
- **Prefetched-only videos**: Master playlist cached, segments require online for first play ⚠️
- **Cache persistence**: Survives app restarts
- **Cache inspection**: Tools available to verify cache contents

### ⚠️ Expected Behavior (Not Bugs)

**Manifest-Only Prefetch:**
- Only caches master playlist (.m3u8)
- Segments require AVPlayer to resolve variants at play time
- This is the intended design - not a limitation!
- AVPlayer prefetch downloads segments, manifest-only caches manifest

**Offline Playback Tiers:**
1. **Full Offline**: Videos that were actually played (segments + manifest cached)
2. **Partial Offline**: Videos that were only prefetched (manifest cached, segments require online)
3. **No Cache**: Videos never seen before

**Pool Exhaustion:**
- When 3+ videos need players simultaneously
- Falls back to manifest-only prefetch
- This is graceful degradation, not a failure

## Architecture Overview

### Prefetch Flow
```
Video enters 10% visibility
  ↓
Try to acquire AVPlayer from pool
  ↓
If available: AVPlayer Prefetch (downloads segments)
If exhausted: Manifest-Only Prefetch (caches manifest)
  ↓
Player released after buffering/timeout
```

### Cache Lifecycle
```
1. Prefetch: Cache manifest + segments (AVPlayer) OR manifest only (fallback)
2. Play: Use cached content if available, download on-demand if not
3. Offline: Play cached segments, show loader for uncached segments
```

### Player Pool Management
```
Pool Size: 3 players (hard limit)
Strategy: Try AVPlayer first, fallback to manifest-only
Release: After 2s buffered OR 5s timeout
Recovery: Pool recovers when players released
```

## Configuration Options

### Current Settings (AppConfig.ts)
```typescript
playerPool: {
  maxPlayers: 3,                        // Hard limit
  avplayerPrefetchBufferSeconds: 2,     // Target buffer duration
  avplayerPrefetchTimeoutSeconds: 5,     // Safety timeout
},
prefetch: {
  enabled: true,                         // Master switch
  strategy: 'auto',                      // Try AVPlayer first, fallback to manifest
  segmentCount: 2,                       // For manifest-only fallback
  maxConcurrent: 3,                      // Queue concurrency
}
```

### Runtime Updates
- Settings modal allows runtime configuration changes
- Changes sync to native modules immediately
- Some changes require app reload (documented)

## Performance Metrics

### Expected Performance
- **AVPlayer Prefetch**: 2-5 MB per video (2 seconds × bitrate)
- **Manifest-Only**: 1-2 KB per video (just manifest)
- **Memory Usage**: 200-350 MB with 3 concurrent players
- **Cache Hit Rate**: 80-90% for previously played videos

### Monitoring
- Xcode console logs show prefetch activity
- Cache inspection script available
- Metrics HUD shows real-time status
- Pool state tracked in logs

## Testing Procedures

### Verify AVPlayer Prefetch
```bash
# Filter Xcode logs by:
[CacheManager]
[VideoPlayerPool]

# Look for:
[CacheManager] 🎬 Using AVPlayer prefetch for vid-X
[CacheManager] ✅ Buffer target reached for vid-X
```

### Verify Pool Management
```bash
# Look for pool exhaustion:
[VideoPlayerPool] ⚠️ Pool exhausted (active: 3/3)
[CacheManager] 📋 No player available, manifest-only for vid-X
```

### Verify Cache Contents
```bash
# Run inspection script
./inspect_ktv_cache.sh

# Look for .m4s segment files (AVPlayer prefetch)
# Look for .m3u8 manifest files (manifest-only prefetch)
```

## Known Limitations

### Current Limitations (Expected)
1. **Manifest-Only Prefetch**: Only caches manifest, not segments
2. **Pool Exhaustion**: Falls back to manifest-only when 3+ videos need players
3. **Offline Playback**: Only fully played videos play offline
4. **Master Playlists**: Manifest-only mode can't parse variants (AVPlayer handles this)

### Future Improvements
1. **Network-Aware Prefetch**: Match quality to network conditions
2. **Priority Eviction**: Evict lower-priority players when pool exhausted
3. **Automatic Retry**: Retry failed loads on network return
4. **AVAssetDownloadTask**: Alternative to KTV for true offline downloads

## Troubleshooting

### Common Issues

**Q: Why don't prefetched videos play offline?**
A: Only videos that were actually played (not just prefetched) will play offline. This is expected behavior.

**Q: Why do I see "Pool exhausted" logs?**
A: This is normal when 3+ videos need players simultaneously. The system gracefully falls back to manifest-only prefetch.

**Q: Why do I see only .m3u8 files in cache?**
A: This indicates manifest-only prefetch was used (pool exhausted). AVPlayer prefetch would show .m4s segment files.

**Q: Why do videos rebuffer during playback?**
A: AVPlayer may switch bitrates during playback. This is normal adaptive behavior, not a cache issue.

### Debug Commands
```bash
# Monitor prefetch activity
grep "\[CacheManager\]" xcode.log

# Check pool state
grep "\[VideoPlayerPool\]" xcode.log

# Count cache hits
grep "Cache HIT" xcode.log | wc -l
```

## Success Criteria

### ✅ Implemented
- AVPlayer prefetch works when players available
- Manifest fallback works when pool exhausted
- Players properly released after buffering
- Pool never exceeds 3 players
- Configuration is runtime-updatable
- Cache inspection tools available

### 🔄 In Progress
- UI freeze investigation (debug mode issue)
- Network recovery improvements
- AppConfig testing framework

### 📋 Future Work
- Network-aware bitrate selection
- Priority-based player eviction
- AVAssetDownloadTask exploration
- Comprehensive testing suite

## Summary

The current prefetch implementation provides a solid foundation with:
- **Two-tier prefetch system** (AVPlayer + manifest fallback)
- **Graceful degradation** when resources are limited
- **Configurable parameters** for different use cases
- **Clear separation** between prefetch and playback caching

The system is designed to be robust and handle edge cases gracefully, with clear logging and monitoring capabilities for debugging and optimization.

---

**Last Updated**: October 11, 2025  
**Status**: Production Ready (with known limitations)  
**Next Review**: After network freeze investigation complete
