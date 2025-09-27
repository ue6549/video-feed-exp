// RCTConvert+RNTransitionConfig.h
#import <React/RCTConvert.h>
#import "ViewabilityTransitioningConfig.h" // Import your custom object

@interface RCTConvert (ViewabilityTransitioningConfig)

+ (ViewabilityTransitioningConfig *)ViewabilityTransitioningConfig:(id)json;

@end
