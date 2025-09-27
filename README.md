# video-feed-exp
experimental repo for video feed experience nad performance POCs
# ToDo
1. [x] Thumbnail image caching. Use fast-image for POC.
2. [ ] Introduct carousel kind of widgets that have more than one video visible ar any time.
3. [ ] Viewability config is at video card right now. Should be configurable at widget level so that carousel can set a higher threshold compared to a short video card. By doing this, I think the carousel use case will also work fine.
4. [ ] Now do we need a global or inter-widget video controller? We have different categories of video widgets, some may have higher priority than others. If we want to cap the max number of players at the page level, we will have to solve for priority and even individual videos inside a widget will have to through same video play manager / controller.
5. [ ] If by design it can be guaranteed that only 2-3 can videos can come on the screen, priority based play manager will not be required.
6. [ ] Video caching on iOS.
7. [ ] Video prefetching on iOS.
8. Transitions.
9. Android changes.