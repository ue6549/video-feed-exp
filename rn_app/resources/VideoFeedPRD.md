# Objective
Build a experimental video feed app that works on iOS, android and web. 

## Requirements
1. List of video sources is present in file `video-feed.json`.
2. App starts with a single screen, called feed page, but is setup with a tab bar or bottom bar like navigation at the root and each tab (for now only one tab) has a stack navigation construct like UINavigation controller for iOS for extensibility.
### Types of content
3. Feed page has a list of different kinds of widgets, for now, `Short`, `Carousel` and `Merch` widgets.
4. `Short` have a single video that plays automatically based on visibility of video, followed by title, a dummy comment.
5. `Carousel` have 6 small video cards.
6. `Merch` widgets have an image and a dummy title and a footer text. Data for these is not present in the file `video-feed.json`. Use a free image provider api and dummy text.
### Page and widget layout
7. Page needs to be ideally responsive but at least adaptive to all screen sizes.
8. Maximum width of the main content feed can be 768 units.
9. Shorts follow the aspect ratio from data or the video and fit into the screen size i.e. content mode for the width is aspect fit.
10. Aspect ratio is mentioned in data as 16:9 is actually height : width instead of width : height, which is the industry standard.
11. Carousels expand to the width of the main feed. They show 2.5 cards in small screen, 3.5 in medium and large.
### Data provider
12. Data from the json file needs to be processed to create mock data fot widgets as described above. So every 4th widget needs to be carousel. That means that next 6 videos need to be used to create data for oen single carousel widget. Merch widgets need to be inserted randomnly.
13. Instead of loading all of the data at once from the prepared mock data, we need to mock the behaviour of a paginated api and server a few widgets on every page. Number of widgets on first page and number of widget in each page after that need to be configurable individually. The UI needs to initiate the next page fetch call at approapriate scroll position.
### Config
14. For everything configurable in this app, create a config object or definition that has all these options.
### Rules to play
15. Only one category or widget at a time and one instance of one category or widget type can play video/s at a time.
16. Every category or widget type has individual limit of maximum number of videos that can play simultaneously.
    1. For Shorts, every widget has only 1 video so limit is automatically set at 1. 
    2. For Carousels, maximum 3 videos play at once if the videos individually satisty the visibility conditions. Visibility conditions are explained later in this doc.
### Performance
17. CDN cost optimisation is an objective.
18. We are not keeping video format and compression optimisations in scope at this point.
19. Video segments and manifest and playlists (using HLS and DASH protocol) once downloaded need to be cached. Caching strategy is explained later.
20. Video load time has to be as minimum as possible. For that, proposal is to start prefetching first segment of a few videos in advance.
21. If a user goes offline after they had fetched some feed data when they were online, whatever segments of any video got downloaded, should play offline.
22. Prefetch manager's behaviour is explained later.
23. Video player components are expansive and even the view layers or video could be expansive hence the video component is only loaded in the card when the video is in the view port, otherwise only a image view with thumbnail is kept mounted.
24. It's a long feed and cell recylcling could be important for performance. Hence a list view that can recycle and reuse components is important.
25. Video players are pooled in memory, and reused for any new widgets asking to mount a video component. If the decoder and surface view are different in some platform use recycling for players and maybe use more surface views. Depends on what is most optimised.
26. Native vs RN - there are many behaviours here like pooling, recycling, sequencing of videos, caching, prefetching, visibility calculation and state. Dynamic configurability of RN is important but not at a significant cost of performance e.g. visibility calculation could be done faster in native view and we can send events to RN on specific threshold changes. Similary for all the components and modules please take this judgement call based on what is better.
### Caching
27. The cache has a max limit which is configurable.
28. LRU cache.
29. We could have individual cachelimits for each category but not part of this scope.
30. All video artifacts and data is cached.
31. Even partially played or downloaded videos are cached as we are caching segments.
32. It might be tricky to play npartially downloaded video offline in some platforms. May require overriding the manifest and / or playlist file.
### Prefetch manager
33. Fetch a configurable number of initial segments of videos.
34. Max concurrent video prefetch cap, configurable.
35. queu prefetch request and cancekl prefetch request capabilities.
36. Takes priority categories as input with prefetch request and prefetches based on that.
37. Suggest more performance optimisations or behaviour improvements for this.
### Low end devices
38. Assume there is a way to determine whether a device is low end or not which is oos of current scope. Let's have a configurable option for whether the device is low end or not. Do not autoplay if the device is detected as low end device. Low end is a performance class in this context.
39. If any one video plays on a low end device, through a user intent, all other videos pause. In a way, only one video component is ever alive on a low end device.
### Visiblity conditions & video card behaviour
40. Proposal is, and you can suggest better ideas here, to define states of video card / component based on its visibility and use those states for different actions.
    1. All the visibility percentages or thresholds other than prefetch range is individual to video card or component and defined at widget type.
    2. Videos that are not on screen but could be visible if the user scrolls by a certain range, start prefetching first segment in that range. This is first state, maybe `willBecomeVisible` or `prefetch` state. We'll keep this range or the number of videos to prefetch configurable.
    3. At some percetange of initial visiblity e.g. 1% i.e. video is now coming to view port, the video player component is mounted in the widget else only a image view with thumbnail is attached by default before that. The video is kept paused initially.
    4. At a little more visibility, e.g. 20%, when the card is moving into the screen, video enters a ready to play state. Which acts like a soft ask to play from the video. If there is no other video already active or playing or depending on whatever the rules to play say about simultaneous video play, this video can become active other wise it'll wait.
    5. As cards move out of the screen, first trigger is soft release of play i.e. if there is some other video which is in ready to play state, the current video is paused and the waiting video starts to play. Else the moving out video continues to play until next stage.
    6. At a lesser visiblity, as the card is moving out of the screen, the video pauses. e.g. 20%.
    7. As the video moves out of screen, the video component is removed from the widget.
    8. If the scroll speed is really high, video card UI updates i.e. attaching removing video player or surface view, prefetch requests etc, are not executed. So there could be a bit of a debounce or coalescing in honouring the visibility events. Suggest something better here if possible. Ideally the visibily native events should also not be triggered in this case.
### Pooling
41. Pool, cache, recycle, reuse components and expansive resources wherever possible.
### Sequencing
42. Videos only play once in the feed. They could also have a preview duration as property going forward. Which means they don't completely play for the entire video duration but for some defined limit per category in seconds. Whenever either the active video has ended or reached the end of its preview duration, other video in the view port of other widget that are in ready to play or active or soft release state start playing and the control keeps on rotating across all videos 
### Feed ranking
OOS.

## Scope
Only iOS platform for now. But get the design ready considering android and other platforms in vision. The native modules and components can be stubbed maybe for platforms other than iOS.

## Technical Requirements
1. Hybrid ReactNative app. Use ReactNativeWeb or something better on web, when we take that scope.
2. ReactNative 0.72.3
3. Typescript
4. Use RecyclerListView for the main feed list view in the page.
5. Use Swift where possible in iOS and kotlin in android.
6. Use Native modules and view mangers where possible. Performance is paramount. Introduce condigurability in behaviour of modules and view managers wherever possible to reduce dependency on native code changes.
