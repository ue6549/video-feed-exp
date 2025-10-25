# Prefetch System Overview

## Executive Summary

The VideoFeedApp prefetch system implements an intelligent, priority-based video prefetching mechanism that ensures smooth playback by preloading video content before it enters the viewport. The system uses a hierarchical, widget-aware prefetch strategy that considers content type, scroll position, and user behavior to optimize resource allocation and network usage.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        React Native Layer                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐ │
│  │   FeedScreen    │───▶│FeedPrefetch     │───▶│ PrefetchManager │ │
│  │                 │    │   Controller    │    │                 │ │
│  │ - RecyclerListView │    │ - Priority     │    │ - Priority Queue │ │
│  │ - Scroll Events  │    │   Calculation   │    │ - Request       │ │
│  │ - Visible Items  │    │ - Widget Logic  │    │   Management    │ │
│  └─────────────────┘    └─────────┬───────┘    └─────────┬───────┘ │
│                                   │                      │         │
│                                   ▼                      ▼         │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │              Base PrefetchController                             │ │
│  │                                                                 │ │
│  │  ┌─────────────────┐  ┌─────────────────┐                      │ │
│  │  │  Priority       │  │  Nested         │                      │ │
│  │  │  Propagation    │  │  Controller     │                      │ │
│  │  │  (Parent → Child)│  │  Support       │                      │ │
│  │  └─────────────────┘  └─────────────────┘                      │ │
│  │                                                                 │ │
│  │  Future: CarouselPrefetchController (horizontal prefetch)      │ │
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
│  │  │AVAsset          │  │KTVHTTPCache     │  │CacheManager     │ │ │
│  │  │Prefetching      │  │                 │  │                 │ │ │
│  │  │                 │  │ - Proxy Server  │  │ - Segment Cache │ │ │
│  │  │ - AVURLAsset    │  │ - Segment Cache │  │ - Cache Status  │ │ │
│  │  │ - loadValues    │  │ - Background    │  │ - Prefetch      │ │ │
│  │  │   Async         │  │   Downloads     │  │   Coordination  │ │ │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Interaction Flow

### 1. Scroll Detection Flow
```
User Scroll → FeedScreen → FeedPrefetchController → Priority Calculation → PrefetchManager
     ↓              ↓               ↓                       ↓                    ↓
Visible        Widget Type      Distance        Priority Value        Asset Prefetch
Indices        Detection        Calculation     (100 - distance*10)   (KTVHTTPCache)
```

### 2. Prefetch Priority Flow
```
Widget Detection → Widget Type → Priority Calculation → Queue Management → Prefetch Execution
       ↓               ↓                ↓                     ↓                  ↓
  Short/Carousel   Widget-Specific    Distance-Based    Priority Sort    AVAsset Load
                   Strategy           (100-distance*10)  Descending       KTVHTTPCache
```

### 3. Asset Loading Flow
```
Prefetch Request → PrefetchManager → KTVHTTPCache → AVAsset → Cache Storage → Playback Ready
       ↓                ↓                ↓              ↓             ↓              ↓
    Queue           Priority Queue    Proxy URL    Asset Load    Segment    Video Ready
    Management      Management        Generation   Async         Storage    for Playback
```

## Prefetch Strategy Overview

### Widget-Based Prefetching

Different widget types have different prefetch strategies:

#### Shorts Widget
- Single video per widget
- Prefetch priority based on scroll distance
- High priority for imminent visibility

#### Carousel Widget
- Multiple videos per widget
- **First 2 videos**: High priority (initially visible)
- **Remaining videos**: Low priority (for horizontal scroll)
- Special handling for horizontal navigation

#### Merch Widget
- No video content
- Skipped in prefetch process

### Priority-Based Loading

Priority calculation formula:
```
Priority = Parent Priority + (100 - distance * 10)
```

Where:
- **Parent Priority**: 0 for feed-level controller, propagates to nested controllers
- **Distance**: Widgets ahead of current viewport (1 = next, 2 = after next, etc.)
- **Result**: Higher priority for closer widgets

Example priorities:
- Widget 1 step ahead: 90
- Widget 2 steps ahead: 80
- Widget 3 steps ahead: 70
- Carousel remaining videos: 10 (low priority)

### AVPlayer Asset Prefetching

The system uses iOS AVPlayer's native prefetching capabilities:

#### AVURLAsset Prefetching
```swift
let asset = AVURLAsset(url: videoURL)
asset.loadValuesAsynchronously(forKeys: ["playable"]) {
    // Asset is ready for playback
}
```

#### Benefits
- Native iOS optimization
- Automatic cache integration
- Network-aware prefetching
- Background download support

## Component Interaction Flow

### 1. Scroll Event Processing
```
FeedScreen → handleVisibleIndicesChanged() → FeedPrefetchController
                                                      ↓
                                           Calculate prefetch range
                                                      ↓
                                           Iterate through widgets
                                                      ↓
                                           Calculate priorities
                                                      ↓
                                           Trigger prefetch
```

### 2. Widget-Specific Prefetch
```
Widget Type Detection → Widget Strategy Selection → Priority Calculation
         ↓                        ↓                         ↓
    Short Video              Carousel Widget            Merch Widget
         ↓                        ↓                         ↓
    Prefetch Single          Prefetch First 2           Skip Prefetch
    Video (High Priority)    Videos (High Priority)     (No Video)
                                  ↓
                         Prefetch Remaining
                         Videos (Low Priority)
```

### 3. Priority Queue Management
```
PrefetchManager → Priority Queue → Concurrent Downloads → Cache Integration
       ↓               ↓                    ↓                     ↓
    Request         Sort by             Max Concurrent        KTVHTTPCache
    Enqueue         Priority            Downloads (3)         Proxy URL
                    Descending                                  Generation

## High-Level Data Flow

### 1. Feed Scroll to Prefetch
```
Scroll Event → Visible Indices → FeedPrefetchController → Widget Detection
     ↓               ↓                    ↓                      ↓
RecyclerListView  [0, 1, 2, ...]    Calculate range        Widget Type
Visible Items                      (current + N ahead)    Strategy
```

### 2. Priority to Asset Loading
```
Priority Calculation → PrefetchManager → Priority Queue → Asset Loading
         ↓                    ↓                ↓               ↓
    Distance-Based      Request Queue    Sort by         AVAsset
    (100 - dist*10)     Management       Priority        Prefetch
```

### 3. Cache Integration
```
Asset Loading → KTVHTTPCache → Proxy URL → Segment Download → Cache Storage
      ↓               ↓              ↓             ↓               ↓
   AVURLAsset    Proxy Server    Local URL    HLS Segments    Disk Cache
   Prefetch      Generation      Generation   Download        Storage
```

## Integration with Visibility System

### Prefetch-States Coordination
```
Visibility State          Prefetch Action
────────────────────────────────────────────────────────
prefetch (5%+)           → Prefetch already completed
prepareToBeActive (25%+) → Asset ready, start loading
isActive (50%+)          → Video ready for playback
willResignActive (90%+)  → Stop prefetch for this video
notActive (<50%)         → Cleanup prefetch resources
```

### Timing Coordination
- **Prefetch**: Happens 1-5 widgets ahead of viewport
- **PrepareToBeActive**: Video component mounted, using prefetched asset
- **isActive**: Video starts playing, smooth startup with cache

## System Benefits

1. **Smooth Playback Start**: Videos begin playing immediately without buffering
2. **Intelligent Resource Allocation**: Priority-based prefetching optimizes network usage
3. **Widget-Aware Strategy**: Different content types get optimized prefetch treatment
4. **Scalable Architecture**: Nested controller system allows for complex scenarios
5. **Native Integration**: Uses iOS native prefetching for optimal performance
6. **Cache Efficiency**: KTVHTTPCache integration ensures reusable prefetched content

## Nested Prefetch Controllers

### Current Architecture
```
FeedPrefetchController (Vertical scroll)
│
├─ Base PrefetchController (Priority propagation)
│
└─ Future: CarouselPrefetchController (Horizontal scroll)
   │
   └─ Base PrefetchController (Inherits feed-level priority)
```

### Priority Propagation
- Parent controller priority propagates to child controllers
- Carousel controller inherits feed-level priority
- Nested videos maintain priority hierarchy
- Independent prefetch coordination per carousel instance

## Next Steps

For detailed implementation information, see:
- [Prefetch Requirements & Design](PREFETCH_REQUIREMENTS_DESIGN.md)
- [Prefetch Implementation & Future Work](PREFETCH_IMPLEMENTATION_FUTURE.md)
