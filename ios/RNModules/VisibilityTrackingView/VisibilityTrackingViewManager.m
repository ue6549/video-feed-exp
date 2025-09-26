//
//  VisibilityTrackingViewManager.m
//  VideoFeedApp
//
//  Created by Rajat Gupta on 26/09/25.
//

#import "VisibilityTrackingViewManager.h"
#import "VideoFeedApp-Swift.h"
#import <React/RCTUIManager.h>

NS_ASSUME_NONNULL_BEGIN

@implementation VisibilityTrackingViewManager

RCT_EXPORT_MODULE(TrackingView)

- (UIView *)view {
  return [VisibilityTrackingView new];
}

RCT_EXPORT_VIEW_PROPERTY(uniqueId, NSString)
RCT_EXPORT_VIEW_PROPERTY(throttleInterval, NSNumber)
RCT_EXPORT_VIEW_PROPERTY(visibilityThresholds, NSDictionary)
RCT_EXPORT_VIEW_PROPERTY(onVisibilityStateChange, RCTDirectEventBlock)

@end

NS_ASSUME_NONNULL_END
