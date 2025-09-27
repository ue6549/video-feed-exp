//
//  ViewabilityTransitioningConfig.m
//  VideoFeedApp
//
//  Created by Rajat Gupta on 27/09/25.
//

#import "ViewabilityTransitioningConfig.h"

NS_ASSUME_NONNULL_BEGIN

@implementation ViewabilityTransitioningConfig

- (instancetype)initWithMovingIn:(NSArray<NSNumber *> *)movingIn
                       movingOut:(NSArray<NSNumber *> *)movingOut {
    self = [super init];
    if (self) {
        // Sort movingIn array in ascending order
        _movingIn = [movingIn sortedArrayUsingComparator:^NSComparisonResult(NSNumber *a, NSNumber *b) {
            return [a compare:b];
        }];

        // Sort movingOut array in descending order
        _movingOut = [movingOut sortedArrayUsingComparator:^NSComparisonResult(NSNumber *a, NSNumber *b) {
            return [b compare:a];
        }];
    }
    return self;
}

// Ensure the class can be initialized from a dictionary from the RN bridge
- (instancetype)initWithDictionary:(NSDictionary *)dictionary {
    NSArray *movingInFloats = dictionary[@"movingIn"];
    NSArray *movingOutFloats = dictionary[@"movingOut"];
    return [self initWithMovingIn:movingInFloats movingOut:movingOutFloats];
}

- (NSDictionary *)toDictionary {
    return @{
        @"movingIn": self.movingIn,
        @"movingOut": self.movingOut
    };
}

@end

NS_ASSUME_NONNULL_END
