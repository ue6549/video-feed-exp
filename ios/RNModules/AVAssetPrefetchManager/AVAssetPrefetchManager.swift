import AVFoundation
import Foundation

@objc(AVAssetPrefetchManager)
class AVAssetPrefetchManager: NSObject, AVAssetDownloadDelegate {
  
  private var downloadSession: AVAssetDownloadURLSession!
  private var activeTasks: [String: AVAssetDownloadTask] = [:]
  private var prefetchDuration: TimeInterval = 2.0 // Configurable
  
  @objc static let shared = AVAssetPrefetchManager()
  
  override init() {
    super.init()
    setupDownloadSession()
  }
  
  private func setupDownloadSession() {
    let config = URLSessionConfiguration.background(
      withIdentifier: "com.videofeedapp.prefetch"
    )
    config.isDiscretionary = false
    config.sessionSendsLaunchEvents = true
    
    downloadSession = AVAssetDownloadURLSession(
      configuration: config,
      assetDownloadDelegate: self,
      delegateQueue: OperationQueue.main
    )
  }
  
  @objc func prefetchVideoWithVideoId(
    _ videoId: String,
    proxyURL: String,
    durationSeconds: NSNumber
  ) {
    // Cancel if already prefetching
    if activeTasks[videoId] != nil {
      NSLog("[AVAssetPrefetch] Already prefetching: \(videoId)")
      return
    }
    
    prefetchDuration = durationSeconds.doubleValue
    
    guard let url = URL(string: proxyURL) else {
      NSLog("[AVAssetPrefetch] Invalid URL: \(proxyURL)")
      return
    }
    
    let asset = AVURLAsset(url: url)
    
    // Create download task (no title/artwork needed for prefetch)
    let task = downloadSession.makeAssetDownloadTask(
      asset: asset,
      assetTitle: videoId,
      assetArtworkData: nil,
      options: nil
    )
    
    task?.taskDescription = videoId
    activeTasks[videoId] = task
    task?.resume()
    
    NSLog("[AVAssetPrefetch] Started: \(videoId) (duration: \(prefetchDuration)s)")
  }
  
  @objc func cancelPrefetchWithVideoId(_ videoId: String) {
    guard let task = activeTasks[videoId] else {
      NSLog("[AVAssetPrefetch] No active task to cancel: \(videoId)")
      return
    }
    
    task.cancel()
    cleanup(videoId: videoId)
    NSLog("[AVAssetPrefetch] Cancelled: \(videoId)")
  }
  
  @objc func cancelAll() {
    NSLog("[AVAssetPrefetch] Cancelling all tasks (\(activeTasks.count))")
    
    for (videoId, task) in activeTasks {
      task.cancel()
      cleanup(videoId: videoId)
    }
  }
  
  // MARK: - AVAssetDownloadDelegate
  
  func urlSession(
    _ session: URLSession,
    assetDownloadTask: AVAssetDownloadTask,
    didLoad timeRange: CMTimeRange,
    totalTimeRangesLoaded loadedTimeRanges: [NSValue],
    timeRangeExpectedToLoad: CMTimeRange
  ) {
    guard let videoId = assetDownloadTask.taskDescription else { return }
    
    // Calculate total downloaded duration
    var totalDownloaded: TimeInterval = 0
    for value in loadedTimeRanges {
      let range = value.timeRangeValue
      totalDownloaded += CMTimeGetSeconds(range.duration)
    }
    
    // COMMENTED OUT FOR TESTING - Let downloads complete fully
    // Cancel if threshold reached
    // if totalDownloaded >= prefetchDuration {
    //   NSLog("[AVAssetPrefetch] Threshold reached (\(String(format: "%.2f", totalDownloaded))s): \(videoId)")
    //   assetDownloadTask.cancel()
    //   cleanup(videoId: videoId)
    // }
  }
  
  func urlSession(
    _ session: URLSession,
    assetDownloadTask: AVAssetDownloadTask,
    didFinishDownloadingTo location: URL
  ) {
    // Shouldn't reach here (we cancel early), but cleanup if it does
    guard let videoId = assetDownloadTask.taskDescription else { return }
    NSLog("[AVAssetPrefetch] Completed (unexpected): \(videoId)")
    cleanup(videoId: videoId, deleteMovpkg: location)
  }
  
  func urlSession(
    _ session: URLSession,
    task: URLSessionTask,
    didCompleteWithError error: Error?
  ) {
    guard let downloadTask = task as? AVAssetDownloadTask,
          let videoId = downloadTask.taskDescription else { return }
    
    if let error = error as NSError?, error.code != NSURLErrorCancelled {
      NSLog("[AVAssetPrefetch] Error: \(videoId) - \(error.localizedDescription)")
    }
    
    cleanup(videoId: videoId)
  }
  
  // MARK: - Cleanup
  
  private func cleanup(videoId: String, deleteMovpkg: URL? = nil) {
    activeTasks.removeValue(forKey: videoId)
    
    // Delete .movpkg file if provided
    if let location = deleteMovpkg {
      do {
        try FileManager.default.removeItem(at: location)
        NSLog("[AVAssetPrefetch] Deleted movpkg: \(location.path)")
      } catch {
        NSLog("[AVAssetPrefetch] Failed to delete movpkg: \(error.localizedDescription)")
      }
    }
  }
}

