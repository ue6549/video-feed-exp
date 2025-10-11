//
//  VideoPlayerPoolBridge.m
//  VideoFeedApp
//
//  Bridge for VideoPlayerPool native module
//

#import <React/RCTBridgeModule.h>
#import "VideoFeedApp-Swift.h"
#import "VideoPlayerPoolBridge.h"

@implementation VideoPlayerPoolBridge

RCT_EXPORT_MODULE(VideoPlayerPool)

RCT_EXTERN_METHOD(getPoolStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(clearPool:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

