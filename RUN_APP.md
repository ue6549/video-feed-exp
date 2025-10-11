# How to Run VideoFeedApp

## Quick Start

### 1. Kill Existing Metro Bundler (if running)
```bash
lsof -ti:8081 | xargs kill -9
```

### 2. Start Metro Bundler
```bash
cd /Users/red/Development/VideoFeedApp
npx react-native start --reset-cache
```

### 3. Run on iOS Simulator
**Option A: Command Line**
```bash
# In a new terminal
cd /Users/red/Development/VideoFeedApp
npx react-native run-ios --simulator="iPhone 16"
```

**Option B: Xcode**
1. Open `ios/VideoFeedApp.xcworkspace` in Xcode
2. Select iPhone 16 simulator (or any iOS 15.6+ device)
3. Press ⌘R (Product > Run)

---

## What to Expect

### On Launch
- App opens to video feed screen
- First few videos load with thumbnails
- Videos autoplay when scrolled to 50% visibility
- Smooth thumbnail-to-video transitions

### UI Elements
- **Video Feed** - Scrollable list of videos
- **FAB Button** (bottom right) - Access settings and metrics
- **Footer** - "Open Metrics Report" button

---

## Quick Tests

### Test 1: Basic Playback (30 seconds)
1. Launch app
2. First video should autoplay
3. Scroll down - next video plays, previous pauses
4. Scroll back up - videos play again

**Expected:** Smooth playback, one video at a time

### Test 2: Metrics (1 minute)
1. Tap FAB button → Enable "Geek Mode"
2. Notice small overlay on each video showing visibility state
3. Tap "Open Metrics Report" in footer
4. See table of all playback sessions with KPIs

**Expected:** HUD displays, metrics modal shows data

### Test 3: Settings (1 minute)
1. Tap FAB button → "Settings"
2. Toggle "Low-End Device Mode"
3. Enable "Autoplay on Low-End" OFF
4. Close settings
5. Notice play buttons appear on videos

**Expected:** Manual play required, clicking plays video

---

## Troubleshooting

### Metro Bundler Port Conflict
```bash
# Error: EADDRINUSE :::8081
lsof -ti:8081 | xargs kill -9
# Then retry starting Metro
```

### App Crashes on Launch
**Check Metro bundler console for errors:**
- Look for syntax errors (red text)
- Look for module not found errors
- Check bundle is building successfully

**Check Xcode console:**
- Native module errors
- KTVHTTPCache proxy startup
- Any red error messages

### Videos Don't Play
1. Check video URLs are valid (see console)
2. Verify network connectivity
3. Check KTVHTTPCache proxy started (look for log in console)
4. Try different video from feed

### RecyclerListView Not Showing
1. Check console for "RecyclerListView needs to have a bounded size" warning
2. Verify FeedScreen styles have `flex: 1` and `width: '100%'`
3. Check dataProvider has data

### Build Errors
```bash
# Clean everything
cd /Users/red/Development/VideoFeedApp
rm -rf node_modules
npm install
cd ios
pod deintegrate
pod install
cd ..
rm -rf ~/Library/Developer/Xcode/DerivedData/VideoFeedApp-*
```

---

## What's Working

✅ iOS builds successfully  
✅ TypeScript compiles without errors  
✅ Metro bundler runs  
✅ Custom VideoPlayerView with AVPlayer  
✅ KTVHTTPCache video caching  
✅ Visibility-based playback  
✅ Metrics collection and display  
✅ Settings modal with runtime config  
✅ Play button for manual playback  

---

## Documentation

- **TESTING_GUIDE.md** - Full manual testing procedures
- **ARCHITECTURE.md** - System design and architecture  
- **COMPONENT_DOCUMENTATION.md** - Component API documentation
- **REQUIREMENTS.md** - Project requirements
- **.cursorrules** - Development guidelines
- **BUILD_SUCCESS_SUMMARY.md** - iOS build details
- **CHANGES_SUMMARY.md** - Recent changes log

---

## Performance

Metro bundler may take 30-60 seconds to build the initial bundle. Subsequent reloads are faster (< 10 seconds).

First video load may take 2-3 seconds over network. Cached videos load instantly.

---

**Ready to run!** 🚀

Follow TESTING_GUIDE.md for comprehensive testing.

