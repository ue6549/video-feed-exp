# VideoFeedApp Testing Guide

This document provides Standard Operating Procedures (SOPs) for manually testing the VideoFeedApp to ensure functionality and catch regressions.

## Pre-Test Setup Checklist

### Environment
- [ ] Xcode 16+ installed
- [ ] Node.js 16+ installed
- [ ] CocoaPods installed (`gem install cocoapods`)
- [ ] iOS Simulator running (iPhone 16 or similar)
- [ ] Clean build state (no stale derived data)

### Build Steps
```bash
# 1. Install dependencies
cd /Users/red/Development/VideoFeedApp
npm install
cd ios && pod install && cd ..

# 2. Start Metro bundler
npx react-native start --reset-cache

# 3. In a new terminal, build and run
npx react-native run-ios --simulator="iPhone 16"
```

### Expected Initial State
- App launches to video feed screen
- Videos load with thumbnails
- No red error screens
- Metro bundler connected (check logs)

## Critical Test Cases

### Test 1: Basic Video Playback
**Objective:** Verify videos autoplay when visible

**Steps:**
1. Launch app
2. Observe first video in feed
3. Wait 1-2 seconds

**Expected:**
- Thumbnail displays immediately
- Video loads and starts playing automatically when 50% visible
- Smooth transition from thumbnail to video
- No flickering or janks

**Pass Criteria:**
- Video plays within 3 seconds of becoming visible
- Audio plays (if not muted)
- No error messages

---

### Test 2: Scroll Through Feed
**Objective:** Verify visibility-based playback control

**Steps:**
1. Slowly scroll down through the feed
2. Observe video playback as items enter/exit viewport
3. Scroll back up

**Expected:**
- Videos start playing at 50% visibility threshold
- Currently playing video pauses when scrolling away (< 90% visible)
- Video component unmounts when < 20% visible
- Only one video plays at a time (except carousels)
- Smooth scrolling with no dropped frames

**Pass Criteria:**
- Correct video plays based on visibility
- No multiple videos playing simultaneously
- Resources released when scrolling away (check memory in Xcode)

---

### Test 3: Low-End Device Mode
**Objective:** Verify manual play button on low-end devices

**Steps:**
1. Open Settings (FAB menu → Settings)
2. Enable "Low-End Device Mode"
3. Disable "Autoplay on Low-End"
4. Close settings
5. Scroll through feed

**Expected:**
- Videos show play button overlay
- Clicking play button starts video
- Only clicked video plays
- Other videos remain paused with play button

**Pass Criteria:**
- Play button visible on all videos
- Manual interaction required to start playback
- Button disappears after playing

---

### Test 4: Metrics HUD (GeekMode)
**Objective:** Verify real-time metrics display

**Steps:**
1. Open Settings
2. Enable "Geek Mode"
3. Close settings
4. Scroll through feed and play videos

**Expected:**
- Small overlay appears on each video showing:
  - Visibility state
  - Visibility percentage
- HUD updates in real-time as visibility changes

**Pass Criteria:**
- HUD displays correct visibility percentage
- State transitions are visible (prepareToBeActive → isActive → willResignActive → notActive)
- No performance impact

---

### Test 5: Metrics Report Modal
**Objective:** Verify comprehensive metrics collection and display

**Steps:**
1. Play 3-5 different videos
2. Let some videos buffer/stall
3. Open FAB menu
4. Tap "View Metrics" (if available) or open metrics modal

**Expected:**
- Modal shows table of all playback sessions
- Each row shows:
  - Play ID
  - Video ID  
  - Ready time (load duration)
  - Startup time (time to first frame after play)
  - Stall count
  - Total stall time
- Sortable by different metrics
- Export/share functionality works

**Pass Criteria:**
- All played videos appear in the list
- Metrics are accurate (compare with actual experience)
- No missing data
- Sort/filter works correctly

---

### Test 6: Settings Modal
**Objective:** Verify runtime configuration changes

**Steps:**
1. Open FAB menu → Settings
2. Modify each configuration option:
   - Visibility thresholds
   - Performance settings
   - Cache settings
   - Offline mode
3. Apply changes

**Expected:**
- Settings modal opens smoothly
- All config options editable
- Changes apply immediately or on reload
- Invalid values show validation errors

**Pass Criteria:**
- Config changes persist
- App behavior changes according to new settings
- No crashes when applying extreme values

---

### Test 7: Video Caching (KTVHTTPCache)
**Objective:** Verify video segments are cached

**Steps:**
1. Play a video completely
2. Enable airplane mode or disable network
3. Scroll back to the same video
4. Try to play it again

**Expected:**
- First playback downloads and caches segments
- Second playback loads from cache (instant startup)
- Cache size increases (check CacheManager.getCacheSize())
- Cached videos playable offline

**Pass Criteria:**
- Cached video plays without network
- Faster startup on cached content
- Cache persists across app restarts

---

### Test 8: Offline Mode
**Objective:** Verify offline video filtering

**Steps:**
1. Play and cache 2-3 videos
2. Open Settings → Enable "Offline Mode"
3. Close settings

**Expected:**
- Feed shows only cached videos
- Non-cached videos hidden
- Offline indicator visible
- Cached videos play normally

**Pass Criteria:**
- Only fully cached videos appear
- Playback works without network
- Exit offline mode shows all videos again

---

### Test 9: Memory Management
**Objective:** Verify no memory leaks during extended use

**Steps:**
1. Open Xcode → Debug Navigator → Memory
2. Scroll through feed for 2-3 minutes
3. Play multiple videos
4. Monitor memory graph

**Expected:**
- Memory usage stabilizes after initial loading
- Saw-tooth pattern (increases then GC, but stable baseline)
- No continuous upward trend
- AVPlayer pool reuses instances

**Pass Criteria:**
- Memory doesn't exceed 200MB (typical for video app)
- No memory warnings
- App doesn't crash from OOM

---

### Test 10: Navigation
**Objective:** Verify stack navigation works

**Steps:**
1. From feed screen, navigate to Settings
2. Navigate back
3. Check feed state preserved

**Expected:**
- Smooth transitions
- Feed scroll position preserved
- Videos in correct playback state after returning
- No re-renders of entire list

**Pass Criteria:**
- Navigation animations smooth
- State preserved correctly
- No unnecessary re-renders

---

## Known Issues / Limitations

### Current Limitations
- Advanced playback optimizations disabled (multi-phase quality adaptation)
- Prefetching not fully implemented (VOD only)
- Offline manifest generation placeholder only
- Tab navigation not implemented (out of scope)

### Known Bugs
- None currently - report any issues found

## Reporting Issues

When reporting bugs, please include:

### 1. Reproduction Steps
- Exact steps to reproduce
- Device/simulator used
- iOS version

### 2. Expected vs Actual Behavior
- What should have happened
- What actually happened
- Screenshots if applicable

### 3. Metrics Data
If the issue relates to playback:
1. Enable GeekMode
2. Reproduce the issue
3. Open Metrics Modal
4. Export/screenshot the relevant metrics
5. Include Play ID and Video ID

### 4. Console Logs
- Copy relevant logs from Metro bundler
- Copy relevant logs from Xcode console
- Include any error messages

### 5. Environment
```
- React Native version: 0.72.3
- iOS version: [e.g., 18.5]
- Device: [e.g., iPhone 16 Simulator]
- Xcode version: [e.g., 16F6]
```

## Automated Testing (Future)

### Unit Tests (Not Yet Implemented)
```bash
npm test
```

### E2E Tests (Not Yet Implemented)
```bash
# Detox setup and run commands TBD
```

## Performance Benchmarks

### Target Metrics
- **Time to First Frame:** < 1000ms for cached, < 3000ms for network
- **Startup Time:** < 500ms (ready to play after play command)
- **Scroll FPS:** Consistent 60 FPS
- **Memory Usage:** < 200MB during normal use
- **Cache Hit Rate:** > 80% for repeat views

### How to Measure
1. Enable GeekMode for real-time visibility
2. Use Metrics Modal for aggregate statistics
3. Check Xcode Instruments for detailed profiling

## Regression Testing Checklist

Run before each release:

- [ ] All 10 critical test cases pass
- [ ] No console errors or warnings
- [ ] Memory usage within limits
- [ ] Build succeeds on clean checkout
- [ ] Metro bundler starts without errors
- [ ] All navigation flows work
- [ ] Settings persist correctly
- [ ] Metrics HUD displays correctly
- [ ] Metrics Modal shows accurate data
- [ ] No crashes during 5-minute stress test (rapid scrolling)

## Test Data

### Mock Video URLs
The app uses mock data from `rn_app/resources/video-feed.ts`:
- HLS streams (.m3u8 playlists)
- MP4 direct files
- Mix of VOD and LIVE content
- Various aspect ratios

### To Add Test Videos
Edit `rn_app/resources/video-feed.ts` and add entries with:
- Unique `id`
- Valid `videoSource.url`
- Thumbnail URL
- `videoType: 'VOD' | 'LIVE'`

## Troubleshooting

### App Won't Build
```bash
# Clean everything
cd ios
pod deintegrate
pod install
cd ..
rm -rf node_modules
npm install
# Clean Xcode DerivedData
rm -rf ~/Library/Developer/Xcode/DerivedData/VideoFeedApp-*
```

### Metro Bundler Port Conflict
```bash
# Kill process on port 8081
lsof -ti:8081 | xargs kill -9
```

### Videos Won't Play
1. Check console for errors
2. Verify video URLs are valid
3. Check network connectivity
4. Verify KTVHTTPCache proxy started (check AppDelegate logs)

### Metrics Not Showing
1. Verify GeekMode is enabled (for HUD)
2. Check that videos have been played (metrics only recorded after playback)
3. Try playing more videos to generate data

---

**Last Updated:** October 11, 2025  
**Version:** 1.0  
**Maintained By:** Development Team

