#import "AVAssetPrefetchManagerBridge.h"

@implementation AVAssetPrefetchManagerBridge : NSObject

+ (BOOL)requiresMainQueueSetup {
  return YES;
}

@end

