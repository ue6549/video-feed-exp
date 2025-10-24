# Playback Implementation & Future Work

## Technical Implementation Details

### PlaybackManager Architecture

The PlaybackManager is the central orchestrator for all playback decisions. It maintains the state of all videos and enforces the playback rules.

#### Core Architecture
```typescript
// File: rn_app/platback_manager/PlaybackManager.ts

interface VideoState {
  id: string;
  type: 'VOD' | 'LIVE';
  category: WidgetType;
  visibilityState: MediaCardVisibility;
  isPlaying: boolean;
  isPrefetched: boolean;
  manualPlayOverride?: boolean;
  previewStartTime?: number;
  shouldSeekToBeginning?: boolean;
}

// Global state management
let currentlyPlayingWidgetType: WidgetType | null = null;
const playQueue: VideoState[] = [];
const videoMap = new Map<string, VideoState>();
```

#### Key Functions

##### 1. Visibility State Handler
```typescript
export function handleVisibilityChange(
  videoId: string,
  widgetType: WidgetType,
  newState: MediaCardVisibility
): void {
  const videoState = getOrCreateVideoState(videoId, widgetType);
  videoState.visibilityState = newState;
  
  switch (newState) {
    case MediaCardVisibility.isActive:
      handleActive(videoId, videoState);
      break;
    case MediaCardVisibility.willResignActive:
      handleWillResignActive(videoId, videoState);
      break;
    case MediaCardVisibility.notActive:
      handleNotActive(videoId, videoState);
      break;
    // ... other cases
  }
}
```

##### 2. Priority-Based Playback Decision
```typescript
function canStartPlaying(videoId: string, videoState: VideoState): boolean {
  if (!currentlyPlayingWidgetType) return true;
  
  // If same widget type, allow playing (multiple videos within same widget can play)
  if (videoState.category === currentlyPlayingWidgetType) {
    return true;
  }
  
  // Different widget type - check if we have any videos currently playing
  const currentlyPlayingVideos = Array.from(videoMap.values()).filter(v => v.isPlaying);
  if (currentlyPlayingVideos.length === 0) {
    return true;
  }
  
  const requestPriority = WIDGET_PRIORITY[videoState.category];
  const currentPriority = WIDGET_PRIORITY[currentlyPlayingWidgetType];
  
  if (requestPriority > currentPriority) {
    // Higher priority widget can take over - pause ALL currently playing videos
    for (const [id, state] of videoMap) {
      if (state.isPlaying) {
        pauseVideo(id, state);
      }
    }
    return true;
  }
  
  // Lower/same priority must wait
  return false;
}
```

##### 3. Preview Duration Enforcement
```typescript
export function handleVideoProgress(videoId: string, currentTime: number, duration: number): void {
  const videoState = videoMap.get(videoId);
  if (!videoState || !videoState.isPlaying) return;
  
  // Check if manual play override is set
  if (videoState.manualPlayOverride) return;
  
  const previewDuration = AppConfig.config.playback.widgetPreviewDurations[videoState.category] 
    || AppConfig.config.playback.previewDuration;
  
  if (previewDuration > 0 && currentTime >= previewDuration) {
    // Preview duration reached
    videoState.shouldSeekToBeginning = true;
    pauseVideo(videoId, videoState);
    playNextInQueue();
  }
}
```

### VideoCard Integration

The VideoCard component integrates with the PlaybackManager through event listeners and visibility tracking.

#### Key Integration Points

##### 1. Play Event Listener
```typescript
// File: rn_app/components/VideoCard.tsx

const playListener = (videoId: string) => {
  if (videoId === item.id) {
    logger.info('video', `[${item.id}] ⏯️ PLAY event received`);
    playStartTs.current = now();
    metrics.mark('video_play', item.id, playIdRef.current);
    setIsPlayerPlaying(true);
    setShowPlayButton(false);
    
    // Note: Seeking to beginning is now handled when video becomes inactive
  }
};
```

##### 2. Visibility Change Handler
```typescript
const onVisibilityChange = useCallback((event: VisibilityStateChangeEvent) => {
  const newState = event.nativeEvent.visibilityState;
  const visibilityPercentage = event.nativeEvent.visibilityPercentage;
  
  // Update debug text
  setDebugText(`${newState} - ${visibilityPercentage.toFixed(1)}%`);
  
  // Handle player attachment/detachment
  if (shouldHavePlayer && !isPlayerAttached) {
    setIsPlayerAttached(true);
    setIsVideoReadyForDisplay(false);
  } else if (shouldNotHavePlayer && isPlayerAttached) {
    setIsPlayerAttached(false);
    setIsVideoReadyForDisplay(false);
    thumbnailOpacity.setValue(1);
    loadStartTimeRef.current = null;
    
    // Seek to beginning when video becomes inactive (goes out of viewport)
    seekVideoToBeginning();
  }
  
  // Emit state change to PlaybackManager
  handleVisibilityChange(item.id, item.videoCategory ?? 'default', newState);
}, [item.id, item.videoCategory, isPlayerAttached, shouldHavePlayer, shouldNotHavePlayer]);
```

##### 3. Video Seeking Implementation
```typescript
// Function to seek video using UIManager commands
const seekVideoToBeginning = useCallback(() => {
  if (videoPlayerRef.current) {
    const nodeHandle = findNodeHandle(videoPlayerRef.current);
    if (nodeHandle) {
      logger.info('video', `[${item.id}] 🔍 Dispatching seek command to native video player`);
      // Call the native module method directly
      const VideoPlayerViewModule = require('react-native').NativeModules.VideoPlayerView;
      if (VideoPlayerViewModule && VideoPlayerViewModule.seekTo) {
        VideoPlayerViewModule.seekTo(nodeHandle, 0);
      } else {
        // Fallback to UIManager command
        UIManager.dispatchViewManagerCommand(nodeHandle, 'seekTo', [0]);
      }
    }
  }
}, [item.id]);
```

### Native Module Communication

#### UIManager Commands Implementation

##### 1. Native Module Registration
```objective-c
// File: ios/RNModules/VideoPlayerView/VideoPlayerViewManager.m

// Export the seekTo command for UIManager
RCT_EXPORT_METHOD(seekTo:(nonnull NSNumber *)reactTag
                  time:(nonnull NSNumber *)time) {
  [self.bridge.uiManager addUIBlock:^(__unused RCTUIManager *uiManager, NSDictionary<NSNumber *, UIView *> *viewRegistry) {
    VideoPlayerView *view = (VideoPlayerView *)viewRegistry[reactTag];
    if ([view isKindOfClass:[VideoPlayerView class]]) {
      [view seekTo:time];
    }
  }];
}
```

##### 2. Swift Implementation
```swift
// File: ios/RNModules/VideoPlayerView/VideoPlayerView.swift

// MARK: - UIManager Commands
@objc func seekTo(_ time: NSNumber) {
  let seekTime = CMTime(seconds: time.doubleValue, preferredTimescale: 600)
  NSLog("[VideoPlayerView] 🔍 UIManager command: Seeking to %.2f seconds for video: %@", time.doubleValue, videoId as String? ?? "unknown")
  
  // Use completion handler to ensure seek completes before continuing
  player?.seek(to: seekTime, completionHandler: { [weak self] finished in
    if finished {
      NSLog("[VideoPlayerView] ✅ UIManager seek completed for video: %@", self?.videoId as String? ?? "unknown")
      // Ensure video is playing after seek completes
      if let player = self?.player, player.rate == 0 {
        NSLog("[VideoPlayerView] ▶️ Auto-playing after UIManager seek for video: %@", self?.videoId as String? ?? "unknown")
        player.play()
      }
    } else {
      NSLog("[VideoPlayerView] ❌ UIManager seek interrupted for video: %@", self?.videoId as String? ?? "unknown")
    }
  })
}
```

### Event-Driven Architecture

#### Playback Events System
```typescript
// File: rn_app/platback_manager/PlaybackManager.ts

import { EventEmitter } from 'events';

const playbackEvents = new EventEmitter();

// Emit play event
function playVideo(videoId: string, videoState: VideoState): void {
  logger.info('playback', `▶️ PLAY: ${videoId}`);
  videoState.isPlaying = true;
  currentlyPlayingWidgetType = videoState.category;
  playbackEvents.emit('play', videoId);
  logger.info('playback', `📢 Play event emitted for: ${videoId}`);
}

// Emit pause event
function pauseVideo(videoId: string, videoState: VideoState): void {
  logger.info('playback', `⏸️ PAUSE: ${videoId}`);
  videoState.isPlaying = false;
  playbackEvents.emit('pause', videoId);
  logger.info('playback', `📢 Pause event emitted for: ${videoId}`);
}
```

## Key Algorithms

### 1. canStartPlaying() Logic

```typescript
function canStartPlaying(videoId: string, videoState: VideoState): boolean {
  // 1. If no widget is currently playing, allow any video to start
  if (!currentlyPlayingWidgetType) return true;
  
  // 2. If same widget type, allow playing (multiple videos within same widget can play)
  if (videoState.category === currentlyPlayingWidgetType) {
    return true;
  }
  
  // 3. Check if any videos are currently playing
  const currentlyPlayingVideos = Array.from(videoMap.values()).filter(v => v.isPlaying);
  if (currentlyPlayingVideos.length === 0) {
    return true;
  }
  
  // 4. Compare priorities
  const requestPriority = WIDGET_PRIORITY[videoState.category];
  const currentPriority = WIDGET_PRIORITY[currentlyPlayingWidgetType];
  
  if (requestPriority > currentPriority) {
    // Higher priority widget can take over
    for (const [id, state] of videoMap) {
      if (state.isPlaying) {
        pauseVideo(id, state);
      }
    }
    return true;
  }
  
  // 5. Lower/same priority must wait
  return false;
}
```

### 2. playNextInQueue() Algorithm

```typescript
function playNextInQueue(): void {
  if (playQueue.length === 0) return;
  
  // Find the highest priority eligible video
  for (let i = 0; i < playQueue.length; i++) {
    const videoState = playQueue[i];
    const currentVideo = videoMap.get(videoState.id);
    
    if (!currentVideo) {
      playQueue.splice(i, 1);
      i--; // Adjust index after removal
      continue;
    }
    
    // Check if video is still eligible to play (exclude willResignActive as it's going out of view)
    if (currentVideo.visibilityState === MediaCardVisibility.prepareToBeActive ||
        currentVideo.visibilityState === MediaCardVisibility.isActive) {
      
      // Remove from queue and start playing
      playQueue.splice(i, 1);
      playVideo(currentVideo.id, currentVideo);
      logger.info('playback', `▶️ Playing next in queue: ${currentVideo.id} (${currentVideo.category})`);
      return;
    }
  }
  
  logger.info('playback', `📋 No eligible videos in queue to play next`);
}
```

### 3. handleVideoProgress() Preview Enforcement

```typescript
function handleVideoProgress(videoId: string, currentTime: number, duration: number): void {
  const videoState = videoMap.get(videoId);
  if (!videoState || !videoState.isPlaying) return;
  
  // Check if manual play override is set
  if (videoState.manualPlayOverride) return;
  
  // Get preview duration for this widget type
  const previewDuration = AppConfig.config.playback.widgetPreviewDurations[videoState.category] 
    || AppConfig.config.playback.previewDuration;
  
  // Check if preview duration has been reached
  if (previewDuration > 0 && currentTime >= previewDuration) {
    // Preview duration reached
    logger.info('playback', `⏱️ Preview duration (${previewDuration}s) reached for ${videoId}`);
    
    // Reset video position to 0 so it plays from beginning when user taps
    logger.info('playback', `🔍 Resetting video position to 0 for ${videoId}`);
    videoState.shouldSeekToBeginning = true;
    
    // Pause video and play next in queue
    pauseVideo(videoId, videoState);
    playNextInQueue();
  }
}
```

## Native Module Implementation

### VideoPlayerView seekTo Command

```swift
// File: ios/RNModules/VideoPlayerView/VideoPlayerView.swift

@objc func seekTo(_ time: NSNumber) {
  let seekTime = CMTime(seconds: time.doubleValue, preferredTimescale: 600)
  NSLog("[VideoPlayerView] 🔍 UIManager command: Seeking to %.2f seconds for video: %@", time.doubleValue, videoId as String? ?? "unknown")
  
  // Use completion handler to ensure seek completes before continuing
  player?.seek(to: seekTime, completionHandler: { [weak self] finished in
    if finished {
      NSLog("[VideoPlayerView] ✅ UIManager seek completed for video: %@", self?.videoId as String? ?? "unknown")
      // Ensure video is playing after seek completes
      if let player = self?.player, player.rate == 0 {
        NSLog("[VideoPlayerView] ▶️ Auto-playing after UIManager seek for video: %@", self?.videoId as String? ?? "unknown")
        player.play()
      }
    } else {
      NSLog("[VideoPlayerView] ❌ UIManager seek interrupted for video: %@", self?.videoId as String? ?? "unknown")
    }
  })
}
```

### VideoPlayerPool Threading Model

```swift
// File: ios/RNModules/VideoPlayerPool/VideoPlayerPool.swift

private let queue = DispatchQueue(label: "com.videofeedapp.playerpool", attributes: .concurrent)

// Use barrier flags for write operations to ensure thread safety
func acquirePlayerInternal() -> AVPlayer? {
  return queue.sync(flags: .barrier) {
    // Thread-safe player acquisition
    if let player = availablePlayers.popFirst() {
      inUsePlayers.insert(player)
      return player
    }
    return nil
  }
}

func releasePlayerInternal(_ player: AVPlayer) {
  queue.async(flags: .barrier) {
    // Thread-safe player release
    self.inUsePlayers.remove(player)
    self.availablePlayers.insert(player)
  }
}
```

### VisibilityTrackingView Thresholds

```swift
// File: ios/RNModules/VisibilityTrackingView/VisibilityTrackingView.swift

// Native visibility detection with configurable thresholds
func updateVisibilityState(_ percentage: Float) {
  let newState: MediaCardVisibility
  
  if percentage >= 50 {
    newState = .isActive
  } else if percentage >= 25 {
    newState = .prepareToBeActive
  } else if percentage >= 5 {
    newState = .prefetch
  } else {
    newState = .notActive
  }
  
  if newState != currentState {
    currentState = newState
    onVisibilityStateChange?([
      "visibilityState": newState.rawValue,
      "visibilityPercentage": percentage
    ])
  }
}
```

## Performance Considerations

### 1. Progress Observation vs Timers

**Progress-Based Approach (Implemented)**:
- Uses AVPlayer's progress callbacks
- More accurate timing
- Handles pause/resume correctly
- No timer cleanup required

**Timer-Based Approach (Rejected)**:
- Uses setTimeout/setInterval
- Less accurate timing
- Complex pause/resume handling
- Requires timer cleanup

### 2. Native Command Dispatch Overhead

**UIManager Commands**:
- Direct native method calls
- Minimal bridge overhead
- Efficient for frequent operations

**Event-Based Communication**:
- Bidirectional event system
- Higher overhead for frequent updates
- Better for state synchronization

### 3. Queue Management Efficiency

**Priority-Based Sorting**:
- O(n log n) complexity
- Only performed when needed
- Efficient for small queues

**Hash-Based Lookup**:
- O(1) complexity for lookups
- Efficient for frequent operations
- Minimal memory overhead

## Scope for Improvements

### 1. Sequencing and Control Transfer After Preview Duration

**Current State**: Videos pause after preview duration but don't automatically transfer control to next video.

**Improvement Scope**:
- Implement automatic control transfer after preview duration
- Handle edge cases with multiple videos in queue
- Ensure smooth transitions between videos
- Handle horizontal scroll scenarios in carousels

**Challenges**:
- Complex state management for multiple videos
- Edge cases with visibility changes during transitions
- Performance considerations for frequent state changes

### 2. Visibility Threshold Optimization for Smooth Transitions

**Current State**: Fixed visibility thresholds (5%, 25%, 50%, 90%).

**Improvement Scope**:
- Dynamic threshold adjustment based on scroll speed
- Asymmetric thresholds to prevent oscillation
- Smooth transition curves between states
- Adaptive thresholds based on device performance

**Challenges**:
- Complex threshold calculation algorithms
- Performance impact of dynamic calculations
- Testing across different devices and scenarios

### 3. Horizontal Scroll Handling in Carousels

**Current State**: Carousels use the same visibility system as vertical feed.

**Improvement Scope**:
- Separate visibility detection for horizontal scroll
- Independent prefetch coordination for carousel videos
- Nested prefetch controllers for carousel content
- Coordination between vertical and horizontal prefetch

**Challenges**:
- Complex nested controller architecture
- Performance impact of multiple prefetch systems
- State synchronization between controllers

### 4. Multiple Video Coordination Within Same Widget

**Current State**: Multiple videos within same widget can play concurrently.

**Improvement Scope**:
- Intelligent coordination between videos in same widget
- Smart switching between videos based on visibility
- Resource optimization for concurrent playback
- User experience optimization for multi-video widgets

**Challenges**:
- Complex coordination logic
- Resource management for concurrent playback
- User experience considerations

### 5. Adaptive Preview Durations Based on User Behavior

**Current State**: Fixed preview durations per widget type.

**Improvement Scope**:
- Machine learning-based preview duration optimization
- User behavior analysis for personalized durations
- A/B testing framework for duration optimization
- Dynamic duration adjustment based on engagement

**Challenges**:
- Data collection and analysis requirements
- Privacy considerations for user behavior tracking
- Performance impact of ML algorithms

### 6. Background Playback Support

**Current State**: No background playback support.

**Improvement Scope**:
- Background audio playback for videos
- Picture-in-picture mode support
- Background task management
- User preference for background playback

**Challenges**:
- iOS background task limitations
- Battery usage optimization
- User experience considerations

### 7. Picture-in-Picture Mode

**Current State**: No picture-in-picture support.

**Improvement Scope**:
- Native picture-in-picture implementation
- Custom PiP controls and UI
- State management for PiP mode
- Integration with existing playback system

**Challenges**:
- iOS PiP API complexity
- State synchronization between PiP and main app
- User experience optimization

## Next Steps

For detailed implementation information, see:
- [Playback System Overview](PLAYBACK_SYSTEM_OVERVIEW.md)
- [Playback Requirements & Design](PLAYBACK_REQUIREMENTS_DESIGN.md)
