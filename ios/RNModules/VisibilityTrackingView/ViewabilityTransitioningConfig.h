//
//  ViewabilityTransitioningConfig.h
//  VideoFeedApp
//
//  Created by Rajat Gupta on 27/09/25.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface ViewabilityTransitioningConfig : NSObject

// Use NSArray with NSNumber for arrays of floats
@property (nonatomic, copy, readonly) NSArray<NSNumber *> *movingIn;
@property (nonatomic, copy, readonly) NSArray<NSNumber *> *movingOut;

// A designated initializer to ensure the properties are set correctly
- (instancetype)initWithMovingIn:(NSArray<NSNumber *> *)movingIn
                      movingOut:(NSArray<NSNumber *> *)movingOut;

// React Native expects a dictionary for custom object types.
// This method converts the object to a dictionary for RN serialization.
- (NSDictionary *)toDictionary;

@end

NS_ASSUME_NONNULL_END
