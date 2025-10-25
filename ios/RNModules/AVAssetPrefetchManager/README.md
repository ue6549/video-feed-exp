# AVAssetPrefetchManager

## Adding to Xcode Project

The files in this directory need to be added to the Xcode project manually:

1. Open `VideoFeedApp.xcworkspace` in Xcode
2. Right-click on `RNModules` group in Project Navigator
3. Select "Add Files to VideoFeedApp..."
4. Navigate to `ios/RNModules/AVAssetPrefetchManager/`
5. Select all three files:
   - `AVAssetPrefetchManager.swift`
   - `AVAssetPrefetchManagerBridge.h`
   - `AVAssetPrefetchManagerBridge.m`
6. Ensure "Copy items if needed" is **unchecked**
7. Ensure "Create groups" is selected
8. Ensure "VideoFeedApp" target is checked
9. Click "Add"

## Verification

After adding, verify:
1. Files appear in Project Navigator under RNModules
2. Files are listed in Build Phases → Compile Sources
3. Bridge header is listed in Build Phases → Headers
4. Build succeeds: `cd ios && xcodebuild -workspace VideoFeedApp.xcworkspace -scheme VideoFeedApp -configuration Debug -sdk iphonesimulator build`

## Usage

```typescript
import CacheManager from './services/CacheManager';

// Prefetch video
await CacheManager.prefetchVideo(
  'vid-1-0',
  'http://127.0.0.1:8080/proxy/video.m3u8',
  2 // duration in seconds
);

// Cancel prefetch
CacheManager.cancelPrefetch('vid-1-0');

// Cancel all
CacheManager.cancelAllPrefetch();
```

## Implementation Details

- Uses `AVAssetDownloadURLSession` with background configuration
- Tracks active tasks by videoId
- Monitors progress via `AVAssetDownloadDelegate`
- Cancels at configurable duration threshold (default: 2s)
- Cleans up .movpkg files immediately on cancel
- 30-40% lighter than AVPlayer-based prefetch

