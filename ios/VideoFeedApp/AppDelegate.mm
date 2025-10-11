#import "AppDelegate.h"
#import <React/RCTBundleURLProvider.h>
#import <KTVHTTPCache/KTVHTTPCache.h>

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  // Enable KTVHTTPCache logging in debug mode
  #ifdef DEBUG
  [KTVHTTPCache logSetConsoleLogEnable:YES];
  #endif
  
  // Start KTVHTTPCache proxy server
  NSError *error = nil;
  BOOL started = [KTVHTTPCache proxyStart:&error];
  if (started) {
    NSLog(@"[AppDelegate] ✅ KTVHTTPCache proxy started successfully");
    NSLog(@"[AppDelegate] Proxy is running: %@", [KTVHTTPCache proxyIsRunning] ? @"YES" : @"NO");
  } else {
    NSLog(@"[AppDelegate] ❌ Failed to start KTVHTTPCache proxy: %@", error.localizedDescription);
  }
  
  self.moduleName = @"VideoFeedApp";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

@end
