//
//  CacheManager.m
//  VideoFeedApp
//
//  Video caching with KTVHTTPCache integration
//

#import "CacheManager.h"
#import <KTVHTTPCache/KTVHTTPCache.h>
#import <AVFoundation/AVFoundation.h>
#import "VideoFeedApp-Swift.h"  // Swift bridging header for VideoPlayerPool and Security modules

// Security forward declarations temporarily removed

// Context for KVO observation
static void *AVPlayerPrefetchContext = &AVPlayerPrefetchContext;

@interface CacheManager ()
// Manifest-only prefetch (current/fallback)
@property (nonatomic, strong) NSMutableDictionary<NSString *, KTVHCDataLoader *> *prefetchLoaders;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSDictionary *> *prefetchStats;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *prefetchCompletionCounts;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *prefetchTotalCounts;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSNumber *> *prefetchByteCounts;
@property (nonatomic, strong) NSMutableDictionary<NSString *, RCTPromiseResolveBlock> *prefetchResolvers;

// AVPlayer prefetch (new)
@property (nonatomic, strong) NSMutableDictionary<NSString *, AVPlayer *> *avplayerPrefetches;
@property (nonatomic, strong) NSMutableDictionary<NSString *, NSTimer *> *prefetchTimeouts;

// Configurable settings
@property (nonatomic, assign) double avplayerPrefetchBufferSeconds;
@property (nonatomic, assign) double avplayerPrefetchTimeoutSeconds;

// Security property temporarily removed
@end

@implementation CacheManager

- (instancetype)init {
    if (self = [super init]) {
        // Manifest-only prefetch
        self.prefetchLoaders = [NSMutableDictionary dictionary];
        self.prefetchStats = [NSMutableDictionary dictionary];
        self.prefetchCompletionCounts = [NSMutableDictionary dictionary];
        self.prefetchTotalCounts = [NSMutableDictionary dictionary];
        self.prefetchByteCounts = [NSMutableDictionary dictionary];
        self.prefetchResolvers = [NSMutableDictionary dictionary];
        
        // AVPlayer prefetch
        self.avplayerPrefetches = [NSMutableDictionary dictionary];
        self.prefetchTimeouts = [NSMutableDictionary dictionary];
        
        // Default config values (will be updated from RN)
        self.avplayerPrefetchBufferSeconds = 2.0;
        self.avplayerPrefetchTimeoutSeconds = 10.0;
    }
    return self;
}

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

RCT_EXPORT_METHOD(setupSecurity:(NSDictionary *)securityConfig
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[CacheManager] 🔒 Setting up security configuration (temporarily disabled)");
    
    // TODO: Implement security features
    // For now, just log the configuration and resolve successfully
    BOOL enabled = [securityConfig[@"enabled"] boolValue];
    NSArray *allowedDomains = securityConfig[@"allowedDomains"];
    NSString *deploymentPhase = securityConfig[@"deploymentPhase"];
    
    NSLog(@"[CacheManager] Security enabled: %@", enabled ? @"YES" : @"NO");
    NSLog(@"[CacheManager] Allowed domains: %@", allowedDomains);
    NSLog(@"[CacheManager] Deployment phase: %@", deploymentPhase);
    
    resolve(@(YES));
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
    
    // Security validation (temporarily disabled)
    // TODO: Implement security features
    
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

RCT_EXPORT_METHOD(prefetchVideo:(NSString *)videoId
                  videoUrl:(NSString *)videoUrl
                  segmentCount:(NSInteger)segmentCount
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[CacheManager] 🎯 Prefetch: %@ (%ld segments)", videoId, (long)segmentCount);
    
    // Try to acquire AVPlayer for prefetch
    AVPlayer *player = [VideoPlayerPool tryAcquirePlayer];
    
    if (player) {
        NSLog(@"[CacheManager] 🎬 Using AVPlayer prefetch for %@", videoId);
        [self prefetchWithAVPlayer:player
                           videoId:videoId
                          videoUrl:videoUrl
                      segmentCount:segmentCount
                          resolver:resolve
                          rejecter:reject];
    } else {
        NSLog(@"[CacheManager] 📋 No player available, manifest-only for %@", videoId);
        [self prefetchWithManifest:videoId
                          videoUrl:videoUrl
                      segmentCount:segmentCount
                          resolver:resolve
                          rejecter:reject];
    }
}

- (void)prefetchWithManifest:(NSString *)videoId
                    videoUrl:(NSString *)videoUrl
                segmentCount:(NSInteger)segmentCount
                    resolver:(RCTPromiseResolveBlock)resolve
                    rejecter:(RCTPromiseRejectBlock)reject
{
    NSLog(@"[CacheManager] 📋 Manifest prefetch: %@", videoId);
    
    // 1. Fetch manifest through KTV proxy
    NSURL *manifestURL = [NSURL URLWithString:videoUrl];
    if (!manifestURL) {
        NSLog(@"[CacheManager] ❌ Invalid URL: %@", videoUrl);
        reject(@"invalid_url", @"Invalid video URL", nil);
        return;
    }
    
    NSURL *proxiedManifestURL = [KTVHTTPCache proxyURLWithOriginalURL:manifestURL];
    NSURLSession *session = [NSURLSession sharedSession];
    
    [[session dataTaskWithURL:proxiedManifestURL completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {
        if (error || !data) {
            NSLog(@"[CacheManager] ❌ Manifest fetch failed: %@", error.localizedDescription);
            reject(@"manifest_fetch_failed", error.localizedDescription, error);
            return;
        }
        
        NSString *manifest = [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
        
        // 2. Check if this is a master playlist
        BOOL isMasterPlaylist = [manifest containsString:@"#EXT-X-STREAM-INF"];
        
        if (isMasterPlaylist) {
            NSLog(@"[CacheManager] 📋 Master playlist detected (manifest-only mode)");
            NSLog(@"[CacheManager] ℹ️ Manifest cached, but segments require AVPlayer prefetch");
            
            // Cache the master playlist (already done via proxy fetch above)
            // Don't try to parse segments from master playlist
            // This is acceptable for manifest-only fallback
            
            [self.prefetchStats setObject:@{
                @"segmentCount": @0,
                @"totalBytes": @0,
                @"manifestOnly": @YES,
                @"isMasterPlaylist": @YES
            } forKey:videoId];
            
            resolve(@YES);  // Success - manifest cached, even if no segments
            return;
        }
        
        // 3. Parse segments (simple line parsing)
        NSArray<NSString *> *segmentURLs = [self parseSegmentsFromManifest:manifest baseURL:videoUrl];
        
        if (segmentURLs.count == 0) {
            NSLog(@"[CacheManager] ⚠️ No segments found in manifest");
            reject(@"no_segments", @"No segments found in manifest", nil);
            return;
        }
        
        // 4. Prefetch first N segments through KTV
        NSInteger prefetchCount = MIN(segmentCount, segmentURLs.count);
        
        // Initialize tracking for this video
        [self.prefetchCompletionCounts setObject:@0 forKey:videoId];
        [self.prefetchTotalCounts setObject:@(prefetchCount) forKey:videoId];
        [self.prefetchByteCounts setObject:@0 forKey:videoId];
        [self.prefetchResolvers setObject:resolve forKey:videoId];
        
        NSLog(@"[CacheManager] 📋 Found %ld segments, prefetching first %ld", (long)segmentURLs.count, (long)prefetchCount);
        
        for (NSInteger i = 0; i < prefetchCount; i++) {
            NSURL *segmentURL = [NSURL URLWithString:segmentURLs[i]];
            
            // CRITICAL: Use ORIGINAL URL, not proxied! 
            // KTV will cache it, and AVPlayer will request the same original URL
            KTVHCDataRequest *req = [[KTVHCDataRequest alloc] initWithURL:segmentURL headers:nil];
            KTVHCDataLoader *loader = [KTVHTTPCache cacheLoaderWithRequest:req];
            
            if (loader) {
                // CRITICAL: Keep strong reference to prevent dealloc
                // Without this, loader gets deallocated and cancels the download
                NSString *segmentKey = [NSString stringWithFormat:@"%@_%ld", videoId, (long)i];
                [self.prefetchLoaders setObject:loader forKey:segmentKey];
                
                // Simply prepare - KTV handles the rest!
                [loader prepare];
                
                NSLog(@"[CacheManager] 🎯 Started prefetch for segment %ld/%ld", (long)(i + 1), (long)prefetchCount);
            } else {
                NSLog(@"[CacheManager] ❌ Failed to create loader for segment %ld", (long)i);
            }
        }
        
        // Save initial stats (prefetch happens in background)
        [self.prefetchStats setObject:@{
            @"segmentCount": @(prefetchCount),
            @"totalBytes": @0  // Will be updated as cache grows
        } forKey:videoId];
        
        NSLog(@"[CacheManager] ✅ Prefetch initiated: %@ (%ld segments)", videoId, (long)prefetchCount);
        
        // Resolve immediately - caching happens in background
        resolve(@YES);
    }] resume];
}

#pragma mark - AVPlayer Prefetch

- (void)prefetchWithAVPlayer:(AVPlayer *)player
                     videoId:(NSString *)videoId
                    videoUrl:(NSString *)videoUrl
                segmentCount:(NSInteger)segmentCount
                    resolver:(RCTPromiseResolveBlock)resolve
                    rejecter:(RCTPromiseRejectBlock)reject
{
    NSLog(@"[CacheManager] 🎬 AVPlayer prefetch: %@", videoId);
    
    // Track this prefetch
    [self.avplayerPrefetches setObject:player forKey:videoId];
    
    // Create player item with proxied URL
    NSURL *originalURL = [NSURL URLWithString:videoUrl];
    if (!originalURL) {
        NSLog(@"[CacheManager] ❌ Invalid URL: %@", videoUrl);
        [VideoPlayerPool releasePlayer:player];
        reject(@"invalid_url", @"Invalid video URL", nil);
        return;
    }
    
    NSURL *proxiedURL = [KTVHTTPCache proxyURLWithOriginalURL:originalURL];
    AVPlayerItem *item = [AVPlayerItem playerItemWithURL:proxiedURL];
    
    // ✅ CRITICAL: Limit buffer (configurable)
    item.preferredForwardBufferDuration = self.avplayerPrefetchBufferSeconds;
    
    // Note: AVPlayer will handle master playlists automatically
    // It will pick an appropriate variant based on network conditions
    
    // Observe loaded data
    [item addObserver:self
           forKeyPath:@"loadedTimeRanges"
              options:NSKeyValueObservingOptionNew
              context:AVPlayerPrefetchContext];
    
    [player replaceCurrentItemWithPlayerItem:item];
    
    NSLog(@"[CacheManager] ⏱️ Started buffering for %@ (target: %.1fs, timeout: %.1fs)", 
          videoId, self.avplayerPrefetchBufferSeconds, self.avplayerPrefetchTimeoutSeconds);
    
    // Safety timeout (configurable)
    NSTimer *timeout = [NSTimer scheduledTimerWithTimeInterval:self.avplayerPrefetchTimeoutSeconds
                                                        repeats:NO
                                                          block:^(NSTimer *timer) {
        NSLog(@"[CacheManager] ⏱️ Timeout for %@", videoId);
        [self stopAVPlayerPrefetch:videoId reason:@"timeout"];
    }];
    
    [self.prefetchTimeouts setObject:timeout forKey:videoId];
    
    // Resolve immediately - buffering happens in background
    resolve(@YES);
}

- (void)stopAVPlayerPrefetch:(NSString *)videoId reason:(NSString *)reason
{
    NSLog(@"[CacheManager] 🛑 Stopping AVPlayer prefetch for %@ (reason: %@)", videoId, reason);
    
    AVPlayer *player = [self.avplayerPrefetches objectForKey:videoId];
    if (!player) {
        return; // Already stopped
    }
    
    // Cancel timeout
    NSTimer *timer = [self.prefetchTimeouts objectForKey:videoId];
    if (timer) {
        [timer invalidate];
        [self.prefetchTimeouts removeObjectForKey:videoId];
    }
    
    // Remove observer
    @try {
        if (player.currentItem) {
            [player.currentItem removeObserver:self
                                    forKeyPath:@"loadedTimeRanges"
                                       context:AVPlayerPrefetchContext];
        }
    } @catch (NSException *exception) {
        NSLog(@"[CacheManager] ⚠️ Exception removing observer: %@", exception);
    }
    
    // Clear item (stops downloading)
    [player replaceCurrentItemWithPlayerItem:nil];
    
    // Release player back to pool
    [VideoPlayerPool releasePlayer:player];
    [self.avplayerPrefetches removeObjectForKey:videoId];
    
    NSLog(@"[CacheManager] ✅ Player released for %@", videoId);
}

- (void)observeValueForKeyPath:(NSString *)keyPath
                      ofObject:(id)object
                        change:(NSDictionary *)change
                       context:(void *)context
{
    if (context == AVPlayerPrefetchContext && [keyPath isEqualToString:@"loadedTimeRanges"]) {
        AVPlayerItem *item = (AVPlayerItem *)object;
        
        // Calculate loaded duration
        NSArray *ranges = item.loadedTimeRanges;
        if (ranges.count == 0) return;
        
        CMTimeRange range = [ranges[0] CMTimeRangeValue];
        CMTime loadedDuration = CMTimeRangeGetEnd(range);
        CGFloat seconds = CMTimeGetSeconds(loadedDuration);
        
        // Find videoId for this item
        NSString *videoId = nil;
        for (NSString *vid in self.avplayerPrefetches.allKeys) {
            AVPlayer *player = [self.avplayerPrefetches objectForKey:vid];
            if (player.currentItem == item) {
                videoId = vid;
                break;
            }
        }
        
        if (!videoId) return;
        
        NSLog(@"[CacheManager] 📊 %@ loaded %.1fs", videoId, seconds);
        
        // Stop when buffered target amount (configurable)
        if (seconds >= self.avplayerPrefetchBufferSeconds) {
            NSLog(@"[CacheManager] ✅ Buffer target reached for %@ (%.1fs)", videoId, seconds);
            [self stopAVPlayerPrefetch:videoId reason:@"buffer_full"];
        }
    } else {
        [super observeValueForKeyPath:keyPath ofObject:object change:change context:context];
    }
}

#pragma mark - Helper Methods

- (NSArray<NSString *> *)parseSegmentsFromManifest:(NSString *)manifest baseURL:(NSString *)baseURL {
    NSMutableArray<NSString *> *segments = [NSMutableArray array];
    NSArray<NSString *> *lines = [manifest componentsSeparatedByString:@"\n"];
    
    // Extract base directory from manifest URL
    NSString *baseDir = [baseURL stringByDeletingLastPathComponent];
    
    for (NSString *line in lines) {
        NSString *trimmed = [line stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceAndNewlineCharacterSet]];
        
        // Segment lines don't start with # and should be media segments (.ts, .m4s, .mp4)
        if (trimmed.length > 0 && ![trimmed hasPrefix:@"#"]) {
            // Skip if it's another .m3u8 file (variant playlist)
            if ([trimmed.lowercaseString hasSuffix:@".m3u8"]) {
                continue;
            }
            
            // Resolve relative URL
            NSString *segmentURL;
            if ([trimmed hasPrefix:@"http"]) {
                segmentURL = trimmed;
            } else {
                segmentURL = [NSString stringWithFormat:@"%@/%@", baseDir, trimmed];
            }
            [segments addObject:segmentURL];
        }
    }
    
    return segments;
}

RCT_EXPORT_METHOD(cancelPrefetch:(NSString *)videoId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    KTVHCDataLoader *loader = [self.prefetchLoaders objectForKey:videoId];
    if (loader) {
        [loader close];
        [self.prefetchLoaders removeObjectForKey:videoId];
        NSLog(@"[CacheManager] 🛑 Cancelled prefetch: %@", videoId);
    }
    resolve(@YES);
}

RCT_EXPORT_METHOD(getPrefetchStats:(NSString *)videoId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSDictionary *stats = [self.prefetchStats objectForKey:videoId];
    resolve(stats ?: @{@"segmentCount": @0, @"totalBytes": @0});
}

RCT_EXPORT_METHOD(getAllPrefetchStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(self.prefetchStats ?: @{});
}

RCT_EXPORT_METHOD(setPrefetchConfig:(double)bufferSeconds
                  timeoutSeconds:(double)timeoutSeconds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    self.avplayerPrefetchBufferSeconds = bufferSeconds;
    self.avplayerPrefetchTimeoutSeconds = timeoutSeconds;
    
    NSLog(@"[CacheManager] 🔧 Prefetch config updated: buffer=%.1fs, timeout=%.1fs", 
          bufferSeconds, timeoutSeconds);
    
    resolve(@YES);
}

RCT_EXPORT_METHOD(cancelAllPrefetches:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSLog(@"[CacheManager] 🛑 Cancelling all active prefetches");
    
    // Cancel all AVPlayer prefetches
    NSArray *videoIds = [self.avplayerPrefetches.allKeys copy];
    for (NSString *videoId in videoIds) {
        [self stopAVPlayerPrefetch:videoId reason:@"cancelled_by_user"];
    }
    
    NSLog(@"[CacheManager] ✅ Cancelled %lu active prefetches", (unsigned long)videoIds.count);
    resolve(@YES);
}

#pragma mark - Security Methods

// Security helper methods temporarily removed

RCT_EXPORT_METHOD(getSecurityStats:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // TODO: Implement security features
    resolve(@{@"error": @"Security features temporarily disabled"});
}

RCT_EXPORT_METHOD(updateSecurityConfig:(NSDictionary *)securityConfig
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // TODO: Implement security features
    NSLog(@"[CacheManager] 🔒 Security configuration update (temporarily disabled)");
    resolve(@(YES));
}

RCT_EXPORT_METHOD(clearSecurityData:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // TODO: Implement security features
    NSLog(@"[CacheManager] 🧹 Security data clear (temporarily disabled)");
    resolve(@(YES));
}

@end

