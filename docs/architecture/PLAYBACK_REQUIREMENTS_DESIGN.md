# Playback Requirements & Design

## Detailed Requirements Breakdown

### 1. Visibility-Based Playback Control

#### Primary Requirements
- Videos must automatically start playing when they become sufficiently visible
- Videos must pause when they become less visible or go out of view
- Playback decisions must be based on real-time visibility percentages
- System must handle rapid scroll scenarios without performance degradation

#### Visibility Thresholds
```typescript
const DEFAULT_VISIBILITY_THRESHOLDS = {
  movingIn: {
    prefetch: 5,           // Start prefetching at 5% visibility
    prepareToBeActive: 25, // Mount video component at 25% visibility
    isActive: 50,          // Eligible to play at 50% visibility
  },
  movingOut: {
    willResignActive: 90,  // Pause when 90% visible (going out)
    notActive: 50,         // Cleanup when < 50% visible
  }
};
```

#### Design Rationale
- **5% prefetch**: Early prefetching ensures smooth playback start
- **25% prepareToBeActive**: Mount video component before it's fully visible
- **50% isActive**: Balanced threshold for play eligibility
- **90% willResignActive**: Allows smooth transition to next video

### 2. Widget Priority System

#### Priority Hierarchy
```typescript
const WIDGET_PRIORITY = {
  short: 3,      // Highest priority - full attention expected
  carousel: 2,   // Medium priority - partial attention
  merch: 1,      // Low priority - static content
  default: 0     // Fallback priority
};
```

#### Single Widget Rule
- Only one widget type can play at a time
- Higher priority widgets can interrupt lower priority ones
- Lower priority widgets wait in a priority-ordered queue
- Multiple videos within the same widget type can play concurrently

#### Design Rationale
- **Shorts Priority**: Full-screen engagement, highest attention value
- **Carousel Priority**: Partial attention, can be interrupted
- **Merch Priority**: Static content, lowest priority
- **Single Widget Rule**: Prevents attention fragmentation

### 3. Preview Duration Enforcement

#### Widget-Specific Durations
```typescript
const widgetPreviewDurations = {
  short: 15,     // 15 seconds for shorts (full engagement)
  carousel: 5,   // 5 seconds for carousels (quick preview)
  merch: 0,      // No preview for merch (static content)
  default: 10    // 10 seconds default fallback
};
```

#### Progress-Based Enforcement
- Uses video progress callbacks instead of timers
- More accurate than timer-based approach
- Handles pause/resume scenarios correctly
- Automatic cleanup when video ends

#### Design Rationale
- **Progress-Based**: More accurate than timers, handles edge cases
- **Widget-Specific**: Different content types need different preview lengths
- **Automatic Cleanup**: No manual timer management required

### 4. Manual Play Override

#### Override Behavior
- User manual play ignores preview duration
- Video plays to completion when manually started
- Override flag resets when video ends
- Manual play takes precedence over automatic playback

#### Design Rationale
- **User Intent**: Manual play indicates user wants to watch full video
- **Override System**: Simple flag-based approach
- **Automatic Reset**: Clean state management

## Design Decisions and Rationale

### 1. Progress-Based vs Timer-Based Preview

#### Decision: Progress-Based Approach
```typescript
// Progress-based approach (implemented)
onProgress={event => {
  handleVideoProgress(item.id, event.nativeEvent.currentTime, event.nativeEvent.playableDuration);
}}

// vs Timer-based approach (rejected)
setTimeout(() => {
  pauseVideo(videoId);
}, previewDuration * 1000);
```

#### Rationale
- **Accuracy**: Progress-based is more accurate than timers
- **Edge Cases**: Handles pause/resume scenarios correctly
- **Performance**: No timer cleanup required
- **Reliability**: Less prone to timing issues

### 2. Widget-Level vs Video-Level Priority

#### Decision: Widget-Level Priority
```typescript
// Widget-level priority (implemented)
currentlyPlayingWidgetType: WidgetType | null;

// vs Video-level priority (rejected)
currentlyPlayingVideoId: string | null;
```

#### Rationale
- **Attention Management**: Widgets represent attention categories
- **Simpler Logic**: Easier to manage and understand
- **Scalability**: Easy to add new widget types
- **User Experience**: Matches user mental model

### 3. Seek on Inactive vs Seek on Play

#### Decision: Seek on Inactive
```typescript
// Seek when video becomes inactive (implemented)
if (shouldNotHavePlayer && isPlayerAttached) {
  seekVideoToBeginning();
}

// vs Seek when video starts playing (rejected)
const playListener = (videoId: string) => {
  seekVideoToBeginning();
};
```

#### Rationale
- **User Experience**: Videos don't jump to beginning on every play
- **Natural Reset**: Reset happens when video goes out of view
- **Manual Play**: User can pause/resume from current position
- **Performance**: Less seeking operations

## Configuration Options and Tuning

### 1. Visibility Thresholds

#### Configurable Parameters
```typescript
interface VisibilityTransitioningConfig {
  movingIn: {
    prefetch: number;           // Default: 5%
    prepareToBeActive: number;  // Default: 25%
    isActive: number;          // Default: 50%
  };
  movingOut: {
    willResignActive: number;   // Default: 90%
    notActive: number;         // Default: 50%
  };
}
```

#### Tuning Guidelines
- **Lower thresholds**: More aggressive playback, higher resource usage
- **Higher thresholds**: More conservative playback, better performance
- **Asymmetric thresholds**: Prevents oscillation between states

### 2. Preview Durations

#### Widget-Specific Configuration
```typescript
interface WidgetPreviewDurations {
  short: number;     // Default: 15 seconds
  carousel: number;  // Default: 5 seconds
  merch: number;     // Default: 0 seconds
  default: number;   // Default: 10 seconds
}
```

#### Tuning Guidelines
- **Shorts**: Longer duration for full engagement
- **Carousels**: Shorter duration for quick preview
- **Merch**: No preview for static content
- **Default**: Balanced duration for unknown content

### 3. Priority Values

#### Widget Priority Configuration
```typescript
const WIDGET_PRIORITY = {
  short: 3,      // Highest priority
  carousel: 2,   // Medium priority
  merch: 1,      // Low priority
  default: 0     // Fallback priority
};
```

#### Tuning Guidelines
- **Higher values**: More aggressive interruption
- **Lower values**: More conservative playback
- **Gap between values**: Prevents priority conflicts

## State Machine Diagrams

### Video Lifecycle State Machine

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   prefetch  │───▶│prepareToBe  │───▶│  isActive   │
│             │    │   Active    │    │             │
└─────────────┘    └─────────────┘    └──────┬──────┘
       ▲                   ▲                  │
       │                   │                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  notActive  │◀───│willResign   │◀───│  isActive   │
│             │    │   Active    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

### Playback Decision State Machine

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Visibility │───▶│  Priority   │───▶│   Action    │
│   Change    │    │   Check     │    │             │
└─────────────┘    └─────────────┘    └──────┬──────┘
       ▲                   ▲                  │
       │                   │                  ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Queue     │◀───│  Widget     │◀───│   Play/     │
│ Management  │    │  Priority   │    │   Pause     │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Queue Management Design

### Priority Queue Structure
```typescript
interface VideoState {
  id: string;
  category: WidgetType;
  visibilityState: MediaCardVisibility;
  isPlaying: boolean;
  manualPlayOverride?: boolean;
  previewStartTime?: number;
  shouldSeekToBeginning?: boolean;
}

const playQueue: VideoState[] = [];
```

### Queue Operations
1. **Add to Queue**: Videos added with priority-based sorting
2. **Remove from Queue**: Videos removed when they start playing
3. **Priority Check**: Queue sorted by widget priority
4. **Play Next**: Highest priority eligible video plays next

### Queue Management Algorithm
```typescript
function addToPlayQueue(videoId: string, videoState: VideoState): void {
  // Remove if already in queue
  const existingIndex = playQueue.findIndex(v => v.id === videoId);
  if (existingIndex !== -1) {
    playQueue.splice(existingIndex, 1);
  }
  
  // Add to queue and sort by priority
  playQueue.push(videoState);
  playQueue.sort((a, b) => WIDGET_PRIORITY[b.category] - WIDGET_PRIORITY[a.category]);
}
```

## Performance Considerations

### 1. Visibility Event Throttling
- Native-level throttling for scroll events
- Configurable throttle interval (default: 16ms)
- Efficient threshold calculations

### 2. Queue Management Efficiency
- Priority-based sorting only when needed
- Efficient queue operations
- Minimal memory overhead

### 3. Native Module Communication
- UIManager commands for seeking operations
- Event-driven architecture for state updates
- Efficient bridge communication

## Next Steps

For technical implementation details, see:
- [Playback Implementation & Future Work](PLAYBACK_IMPLEMENTATION_FUTURE.md)
