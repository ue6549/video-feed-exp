#import "AVAssetPrefetchManagerBridge.h"
#import <VideoFeedApp-Swift.h>

@implementation AVAssetPrefetchManagerBridge

RCT_EXPORT_MODULE(AVAssetPrefetchManager)

RCT_EXPORT_METHOD(prefetchVideo:(nonnull NSString *)videoId
                  proxyURL:(nonnull NSString *)proxyURL
                  durationSeconds:(nonnull NSNumber *)durationSeconds) {
  [AVAssetPrefetchManager.shared prefetchVideoWithVideoId:videoId 
                                                  proxyURL:proxyURL 
                                          durationSeconds:durationSeconds];
}

RCT_EXPORT_METHOD(cancelPrefetch:(nonnull NSString *)videoId) {
  [AVAssetPrefetchManager.shared cancelPrefetchWithVideoId:videoId];
}

RCT_EXPORT_METHOD(cancelAll) {
  [AVAssetPrefetchManager.shared cancelAll];
}

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

@end

