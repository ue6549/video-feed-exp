//
//  CacheManager.m
//  VideoFeedApp
//
//  Video caching with KTVHTTPCache integration
//

#import "CacheManager.h"
#import <KTVHTTPCache/KTVHTTPCache.h>

@implementation CacheManager

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(setupCache:(NSInteger)maxSizeMB
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // Disable verbose KTV logging to reduce console spam
    [KTVHTTPCache logSetConsoleLogEnable:NO];
    
    long long maxBytes = (long long)maxSizeMB * 1024 * 1024;
    [KTVHTTPCache cacheSetMaxCacheLength:maxBytes];
    
    NSError *error = nil;
    BOOL started = [KTVHTTPCache proxyStart:&error];
    
    if (started) {
        NSLog(@"[CacheManager] ✅ Proxy server started successfully");
        NSLog(@"[CacheManager] Max cache size: %ldMB (%lld bytes)", (long)maxSizeMB, maxBytes);
        resolve(@(YES));
    } else {
        NSLog(@"[CacheManager] ❌ Failed to start proxy server: %@", error.localizedDescription);
        reject(@"START_ERROR", @"Failed to start proxy server", error);
    }
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getCachedURL:(NSString *)originalURL)
{
    NSLog(@"[CacheManager] 🔍 getCachedURL called for: %@", originalURL);
    
    if (![KTVHTTPCache proxyIsRunning]) {
        NSLog(@"[CacheManager] ⚠️ Proxy not running, returning original URL");
        return originalURL;
    }
    
    NSURL *url = [NSURL URLWithString:originalURL];
    if (!url) {
        NSLog(@"[CacheManager] ⚠️ Invalid URL: %@", originalURL);
        return originalURL;
    }
    
    NSURL *proxyURL = [KTVHTTPCache proxyURLWithOriginalURL:url];
    NSString *result = proxyURL ? [proxyURL absoluteString] : originalURL;
    
    NSLog(@"[CacheManager] 🔄 URL REWRITE:");
    NSLog(@"[CacheManager]   Original: %@", originalURL);
    NSLog(@"[CacheManager]   Proxied:  %@", result);
    
    return result;
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(isCached:(NSString *)url)
{
    NSURL *urlObj = [NSURL URLWithString:url];
    if (!urlObj) {
        return @(NO);
    }
    NSURL *completeFileURL = [KTVHTTPCache cacheCompleteFileURLWithURL:urlObj];
    return @(completeFileURL != nil);
}

RCT_EXPORT_METHOD(getCacheStatus:(NSString *)url
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSURL *videoURL = [NSURL URLWithString:url];
    if (!videoURL) {
        reject(@"INVALID_URL", @"Invalid URL provided", nil);
        return;
    }
    
    // Check if URL is completely cached
    NSURL *cachedURL = [KTVHTTPCache cacheCompleteFileURLWithURL:videoURL];
    BOOL isCached = (cachedURL != nil);
    
    // Get cache length - use cacheTotalCacheLength as fallback
    long long cachedLength = 0;
    if (isCached) {
        // Try to get file size from the cached file
        NSError *error = nil;
        NSDictionary *attrs = [[NSFileManager defaultManager] attributesOfItemAtPath:[cachedURL path] error:&error];
        if (attrs && !error) {
            cachedLength = [attrs fileSize];
        }
    }
    
    NSLog(@"[CacheManager] Cache status for %@: %@ (%lld bytes)", 
          url, isCached ? @"HIT ✅" : @"MISS ❌", cachedLength);
    
    resolve(@{
        @"isCached": @(isCached),
        @"cachedBytes": @(cachedLength)
    });
}

RCT_EXPORT_METHOD(getTotalCacheSize:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    long long totalSize = [KTVHTTPCache cacheTotalCacheLength];
    // Log removed - visible in cache overlay
    resolve(@(totalSize));
}

RCT_EXPORT_METHOD(clearCache:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[CacheManager] Clearing all cache...");
    [KTVHTTPCache cacheDeleteAllCaches];
    NSLog(@"[CacheManager] ✅ Cache cleared");
    resolve(@(YES));
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getCacheSize)
{
    return @([KTVHTTPCache cacheTotalCacheLength]);
}

RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(getInitializationStatus)
{
    BOOL isRunning = [KTVHTTPCache proxyIsRunning];
    return @(isRunning);
}

RCT_EXPORT_METHOD(generateOfflineManifest:(NSString *)videoURL
                  cachedSegments:(NSArray *)cachedSegments
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // KTVHTTPCache handles HLS playlists automatically
    resolve(videoURL);
}

RCT_EXPORT_METHOD(updateManifestWithSegment:(NSString *)manifestURL
                  segmentURL:(NSString *)segmentURL
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // KTVHTTPCache handles this automatically
    resolve(manifestURL);
}

@end

