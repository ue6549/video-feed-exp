//
//  VideoPlayerViewManager.m
//  VideoFeedApp
//
//  Manager for VideoPlayerView native module
//

#import "VideoPlayerViewManager.h"
#import "VideoFeedApp-Swift.h"
#import <React/RCTUIManager.h>

NS_ASSUME_NONNULL_BEGIN

@implementation VideoPlayerViewManager

RCT_EXPORT_MODULE(VideoPlayerView)

- (UIView *)view {
  return [VideoPlayerView new];
}

RCT_EXPORT_VIEW_PROPERTY(source, NSString)
RCT_EXPORT_VIEW_PROPERTY(paused, BOOL)
RCT_EXPORT_VIEW_PROPERTY(muted, BOOL)
RCT_EXPORT_VIEW_PROPERTY(videoId, NSString)
RCT_EXPORT_VIEW_PROPERTY(onLoad, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onProgress, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onEnd, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onError, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onBuffer, RCTDirectEventBlock)
RCT_EXPORT_VIEW_PROPERTY(onReadyForDisplay, RCTDirectEventBlock)

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

@end

NS_ASSUME_NONNULL_END

