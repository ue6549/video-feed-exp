# video-feed-exp
experimental repo for video feed experience nad performance POCs

- Short video, Carousel, Merch (image) widgets added. 
- Visibility configuration is at individual video card level but there is a central playback manager that orchestrates the video play.
- Basic object allocation profiling is done for iOS. AVPlayer instances are being managed properly.
- There is no player pooling right now. It may be required since it is a video heavy feed and constant alloc/dealloc could add to CPU processing and memory spikes.
- The play experience seems to be more or less at par with Instagram in terms of the play triggers. This is tested on wifi so the triggers may need some tuning.

# ToDo
1. [x] Thumbnail image caching. Use fast-image for POC.
2. [x] Introduct carousel kind of widgets that have more than one video visible ar any time.
3. [x] Viewability config is at video card right now. Should be configurable at widget level so that carousel can set a higher threshold compared to a short video card. By doing this, I think the carousel use case will also work fine.
4. [x] Now do we need a global or inter-widget video controller? We have different categories of video widgets, some may have higher priority than others. If we want to cap the max number of players at the page level, we will have to solve for priority and even individual videos inside a widget will have to through same video play manager / controller.
5. [x] If by design it can be guaranteed that only 2-3 can videos can come on the screen, priority based play manager will not be required.
6. [ ] Video caching on iOS.
7. [ ] Video prefetching on iOS.
8. [ ] Transitions.
9. [ ] Android changes.
10. [ ] Profiling. Do we need video player pooling?
11. [ ] Audio session management. Only 1 at a time, interaction with system
inputs and other audio playing apps / processes.