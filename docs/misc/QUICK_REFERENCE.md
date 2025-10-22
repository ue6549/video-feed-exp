# VideoFeedApp Quick Reference

## Current Branch
```bash
git branch --show-current
# cursor-ios-caching
```

## Quick Commands

### Build & Run
```bash
# TypeScript check
npx tsc --noEmit

# iOS build (from project root)
cd ios && xcodebuild -workspace VideoFeedApp.xcworkspace -scheme VideoFeedApp -configuration Debug -sdk iphonesimulator build && cd ..

# Run app
npx react-native run-ios --simulator="iPhone 16"
```

### Testing
```bash
# Check manual tests
open TESTING_GUIDE.md

# View logs (in Metro console)
# Look for: [VIDEO], [PLAYBACK], [VISIBILITY], [PREFETCH]
```

### Git Workflow
```bash
# Check status
git status

# View changes
git diff

# View commit log
git log --oneline -10

# Compare with main
git diff main..cursor-ios-caching --stat
```

## Key Files to Know

### Native (iOS)
- `ios/RNModules/VideoPlayerView/VideoPlayerView.swift` - Video player implementation
- `ios/RNModules/VideoPlayerPool/VideoPlayerPool.swift` - Player pooling
- `ios/RNModules/CacheManager/CacheManager.m` - KTVHTTPCache wrapper
- `ios/VideoFeedApp/AppDelegate.mm` - App initialization

### React Native
- `rn_app/components/VideoCard.tsx` - Video feed item component
- `rn_app/platback_manager/PlaybackManager.ts` - Playback orchestration
- `rn_app/config/AppConfig.ts` - Runtime configuration
- `rn_app/utilities/Logger.ts` - Logging utility

### Documentation
- `ARCHITECTURE.md` - System design
- `COMPONENT_DOCUMENTATION.md` - API reference
- `TESTING_GUIDE.md` - Test procedures
- `BRANCH_SUMMARY_cursor-ios-caching.md` - This branch's changes

## Common Issues & Fixes

### Build Fails
```bash
# Clean build
cd ios && xcodebuild clean && cd ..
rm -rf ios/build ios/Pods
pod install --repo-update
```

### Metro Bundler Issues
```bash
# Reset cache
npx react-native start --reset-cache
```

### Player Not Showing
- Check Xcode console for native logs
- Verify KTVHTTPCache proxy is running
- Check `isPlayerAttached` state in VideoCard

### Autoplay Not Working
- Verify `useLayoutEffect` is executing
- Check `loadStartTimeRef` is being set
- Look for `🔌 Attaching player` log

## Debug Overlays

### Cache Debug Overlay
- Location: Bottom-right corner
- Shows: Proxy status, cache size, current video status
- Toggle: Set `geekMode` in AppConfig

### Debug HUD
- Shows: Real-time metrics for active video
- Location: Top of VideoCard (when visible)
- Toggle: Set `geekMode` in AppConfig

## Configuration

### App Config Location
`rn_app/config/AppConfig.ts`

### Runtime Editing
1. Tap FAB (floating action button)
2. Select "Settings"
3. Edit config values
4. Tap "Save" (some changes require app restart)

### Key Config Values
- `playback.autoplay` - Enable/disable autoplay
- `playback.isLowEndDevice` - Force low-end mode
- `visibility.nativeThrottleMs` - Visibility event throttle
- `video.muteAudio` - Mute all videos
- `cache.enabled` - Enable/disable caching

## Logging Categories

- `video` - Video events (load, play, pause, error)
- `playback` - Playback manager decisions
- `visibility` - Visibility state changes
- `prefetch` - Prefetch operations
- `metrics` - Metrics tracking
- `cache` - Cache operations

## Next Steps / Known Issues

See `FUTURE_WORK.md` for complete backlog.

Quick list:
- [ ] Implement FeedScreen-level prefetching
- [ ] Fix first video autoplay consistency
- [ ] Optimize player pool for large-scale reuse
- [ ] Add Android support
- [ ] Performance testing and optimization

---

**Last Updated:** 2025-01-11  
**Branch:** cursor-ios-caching  
**Commit:** 09c0ade

