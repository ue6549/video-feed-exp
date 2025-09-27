// RCTConvert+RNTransitionConfig.m
#import "RCTConvert_ViewabilityTransitioningConfig.h"

@implementation RCTConvert (RNTransitionConfig)

+ (ViewabilityTransitioningConfig *)ViewabilityTransitioningConfig:(id)json {
  json = [self NSDictionary:json]; // Ensure the JSON is a dictionary
  if (!json) {
    return nil;
  }
  
  NSArray<NSNumber *> *movingIn = [self NSArray:json[@"movingIn"]];
  NSArray<NSNumber *> *movingOut = [self NSArray:json[@"movingOut"]];
  
  if (movingIn || movingOut) {
    return [[ViewabilityTransitioningConfig alloc] initWithMovingIn:movingIn movingOut:movingOut];
  }
  
  return nil;
}

@end
