#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AVAssetPrefetchManager, NSObject)

RCT_EXTERN_METHOD(prefetchVideo:(NSString *)videoId
                  proxyURL:(NSString *)proxyURL
                  durationSeconds:(nonnull NSNumber *)durationSeconds)

RCT_EXTERN_METHOD(cancelPrefetch:(NSString *)videoId)

RCT_EXTERN_METHOD(cancelAll)

@end

