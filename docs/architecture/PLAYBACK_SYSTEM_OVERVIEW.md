# Playback System Overview

## Executive Summary

The VideoFeedApp playback system implements a sophisticated visibility-based video playback control mechanism that ensures optimal user experience through intelligent widget prioritization, preview duration enforcement, and seamless video transitions. The system operates on the principle that only the most attention-worthy content should be playing at any given time, with automatic transitions based on user scroll behavior and content visibility.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Native Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   FeedScreen    │───▶│    VideoCard    │───▶│ VideoPlayerView │ │
│  │                 │    │                 │    │   (Native)      │ │
│  │ - RecyclerListView │    │ - Visibility     │    │                 │ │
│  │ - Scroll Events  │    │   Tracking      │    │ - AVPlayer       │ │
│  │ - Pagination     │    │ - Playback State │    │ - Pool Management │ │
│  └─────────────────┘    └─────────┬───────┘    └─────────────────┘ │
│                                   │                                 │
│                                   ▼                                 │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    PlaybackManager                              │ │
│  │                                                                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │ │
│  │  │  Widget     │  │  Preview    │  │  Queue      │             │ │
│  │  │ Priority    │  │ Duration    │  │ Management  │             │ │
│  │  │ System      │  │ Enforcement │  │ System      │             │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │ │
│  │                                                                 │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │ │
│  │  │  Visibility │  │  Progress   │  │  Manual     │             │ │
│  │  │  States     │  │  Tracking   │  │  Override   │             │ │
│  │  │  Management │  │  System     │  │  Handling   │             │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘             │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
├─────────────────────────────────────────────────────────────────────┤
│                        Native Bridge Layer                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                    Native Modules                               │ │
│  │                                                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │ │
│  │  │VideoPlayerView  │  │VisibilityTracking│  │VideoPlayerPool  │ │ │
│  │  │                 │  │                 │  │                 │ │ │
│  │  │ - AVPlayer      │  │ - Native Scroll │  │ - Player Pool   │ │ │
│  │  │ - Event Emission│  │   Detection     │  │ - Layer Pool    │ │ │
│  │  │ - Seek Commands │  │ - Threshold     │  │ - Thread Safety │ │ │
│  │  │                 │  │   Management    │  │                 │ │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

### 1. Visibility Detection Flow
```
User Scroll → VisibilityTrackingView → VideoCard → PlaybackManager
     ↓              ↓                    ↓              ↓
Native Scroll   Threshold Check    State Update    Playback Decision
Detection       (5%, 25%, 50%, 90%)   (isActive,     (Play/Pause/Queue)
                                   willResignActive)
```

### 2. Playback Decision Flow
```
Visibility Change → PlaybackManager → Priority Check → Action
       ↓                 ↓                ↓              ↓
   isActive          canStartPlaying   Widget Type    Play/Queue
   willResignActive  Priority Check    Comparison    Pause/Next
   notActive         Queue Management  Decision      Cleanup
```

### 3. Preview Duration Enforcement
```
Video Playing → Progress Tracking → Duration Check → Action
      ↓               ↓                  ↓             ↓
  AVPlayer        onProgress         Preview Time    Pause Video
  Events          Callback           Reached         Play Next
```

## Key Concepts

### Visibility States
The system uses five distinct visibility states to manage video lifecycle:

- **`prefetch`** (5%+ visible): Video is prefetched but not yet mounted
- **`prepareToBeActive`** (25%+ visible): Video component mounted, paused
- **`isActive`** (50%+ visible): Video is eligible to play
- **`willResignActive`** (90%+ visible): Video is going out of view
- **`notActive`** (< 50% visible): Video is out of view, cleanup

### Widget Priority System
Content is prioritized based on attention-worthiness:

1. **Shorts** (Priority: 3) - Highest priority, full-screen engagement
2. **Carousels** (Priority: 2) - Medium priority, partial attention
3. **Merch** (Priority: 1) - Lowest priority, static content
4. **Default** (Priority: 0) - Fallback priority

### Preview Duration
Different content types have different preview durations:

- **Shorts**: 15 seconds (full engagement expected)
- **Carousels**: 5 seconds (quick preview)
- **Merch**: 0 seconds (no preview, static content)
- **Default**: 10 seconds (fallback duration)

### Single Widget Rule
Only one widget type can play at a time:
- Higher priority widgets can interrupt lower priority ones
- Lower priority widgets wait in a queue
- Multiple videos within the same widget can play concurrently

## High-Level Data Flow

### 1. User Scroll Detection
```
Native Scroll Event → VisibilityTrackingView → React Native Bridge → VideoCard
```

### 2. Playback State Management
```
Visibility State → PlaybackManager → Priority Check → Playback Decision → Native Command
```

### 3. Video Progress Tracking
```
AVPlayer Progress → Native Bridge → VideoCard → PlaybackManager → Preview Duration Check
```

## Integration Points

### Native Module Communication
- **UIManager Commands**: Direct native method calls for seeking
- **Event Bridge**: Bidirectional communication for playback events
- **Progress Tracking**: Real-time video progress updates

### State Synchronization
- **Visibility States**: Synchronized between native and React Native
- **Playback States**: Centralized in PlaybackManager
- **Queue Management**: Priority-ordered video queue

### Performance Optimization
- **Player Pooling**: Reuse of AVPlayer instances
- **Efficient Seeking**: Native-level video seeking operations
- **Event Throttling**: Optimized visibility event frequency

## System Benefits

1. **Optimal Attention Management**: Only the most important content plays
2. **Smooth Transitions**: Seamless video transitions based on visibility
3. **Resource Efficiency**: Intelligent resource allocation and cleanup
4. **User Experience**: Predictable and intuitive playback behavior
5. **Scalability**: Extensible architecture for new widget types
6. **Performance**: Native-level optimizations for smooth playback

## Next Steps

For detailed implementation information, see:
- [Playback Requirements & Design](PLAYBACK_REQUIREMENTS_DESIGN.md)
- [Playback Implementation & Future Work](PLAYBACK_IMPLEMENTATION_FUTURE.md)
