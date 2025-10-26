//
//  VideoPlayerView.swift
//  VideoFeedApp
//
//  Custom AVPlayer view with pooling support
//

import UIKit
import AVFoundation

@objc(VideoPlayerView)
class VideoPlayerView: UIView {
  
  // MARK: - JS Props
  @objc var source: NSString? {
    didSet {
      // Only setup if this is a new URL (avoid unnecessary re-setup)
      let newURL = source as String?
      if newURL != lastSourceURL {
        lastSourceURL = newURL
        cleanupCurrentPlayer()
        setupPlayer()
      } else {
        NSLog("[VideoPlayerView] ⏭️ Skipping setup - same URL as before")
      }
    }
  }
  
  private var lastSourceURL: String?
  
  @objc var paused: Bool = true {
    didSet {
      let displayId = videoId as String? ?? "unknown"
      if paused {
        NSLog("[VideoPlayerView] ⏸️ PAUSE called for: %@", displayId)
        player?.pause()
      } else {
        NSLog("[VideoPlayerView] ▶️ PLAY called for: %@", displayId)
        if player == nil {
          NSLog("[VideoPlayerView] ❌ CRITICAL: Player is nil when trying to play!")
        }
        player?.play()
        // Check if player actually started playing
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
          if let player = self?.player {
            let displayId = self?.videoId as String? ?? "unknown"
            NSLog("[VideoPlayerView] 📊 Play rate after 0.1s: %.2f for %@", player.rate, displayId)
          }
        }
      }
    }
  }
  
  @objc var muted: Bool = true {
    didSet {
      // Always ensure player is muted by default, only unmute if explicitly set to false
      player?.isMuted = true  // Default to muted for safety
      if !muted {
        player?.isMuted = false  // Only unmute if explicitly requested
      }
    }
  }
  
  @objc var videoId: NSString?
  
  @objc var seekTo: NSNumber? {
    didSet {
      if let seekTime = seekTo {
        let time = CMTime(seconds: seekTime.doubleValue, preferredTimescale: 600)
        NSLog("[VideoPlayerView] 🔍 Seeking to %.2f seconds for video: %@", seekTime.doubleValue, videoId as String? ?? "unknown")
        
        // Use completion handler to ensure seek completes before continuing
        player?.seek(to: time, completionHandler: { [weak self] finished in
          if finished {
            NSLog("[VideoPlayerView] ✅ Seek completed for video: %@", self?.videoId as String? ?? "unknown")
            // Ensure video is playing after seek completes
            if let player = self?.player, player.rate == 0 {
              NSLog("[VideoPlayerView] ▶️ Auto-playing after seek for video: %@", self?.videoId as String? ?? "unknown")
              player.play()
            }
          } else {
            NSLog("[VideoPlayerView] ❌ Seek interrupted for video: %@", self?.videoId as String? ?? "unknown")
          }
        })
      }
    }
  }
  
  // MARK: - UIManager Commands
  @objc func seekTo(_ time: NSNumber) {
    let seekTime = CMTime(seconds: time.doubleValue, preferredTimescale: 600)
    NSLog("[VideoPlayerView] 🔍 UIManager command: Seeking to %.2f seconds for video: %@", time.doubleValue, videoId as String? ?? "unknown")
    
    // Use completion handler to ensure seek completes before continuing
    player?.seek(to: seekTime, completionHandler: { [weak self] finished in
      if finished {
        NSLog("[VideoPlayerView] ✅ UIManager seek completed for video: %@", self?.videoId as String? ?? "unknown")
        // Ensure video is playing after seek completes
        if let player = self?.player, player.rate == 0 {
          NSLog("[VideoPlayerView] ▶️ Auto-playing after UIManager seek for video: %@", self?.videoId as String? ?? "unknown")
          player.play()
        }
      } else {
        NSLog("[VideoPlayerView] ❌ UIManager seek interrupted for video: %@", self?.videoId as String? ?? "unknown")
      }
    })
  }
  
  // MARK: - Events
  @objc var onLoad: RCTDirectEventBlock?
  @objc var onProgress: RCTDirectEventBlock?
  @objc var onEnd: RCTDirectEventBlock?
  @objc var onError: RCTDirectEventBlock?
  @objc var onBuffer: RCTDirectEventBlock?
  @objc var onReadyForDisplay: RCTDirectEventBlock?
  
  // MARK: - Internal State
  private var player: AVPlayer?
  private var playerLayer: AVPlayerLayer?
  private var playerItem: AVPlayerItem?
  private var timeObserver: Any?
  private var isPlayerReady = false
  private var loadTimeout: Timer?
  
  // MARK: - Initialization
  override init(frame: CGRect) {
    super.init(frame: frame)
    self.backgroundColor = .clear  // Transparent background - thumbnail shows through
    self.isOpaque = false  // Important! Ensures transparency works correctly
    setupView()
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }
  
  private func setupView() {
    // Keep background clear for smooth thumbnail transition
    backgroundColor = UIColor.clear
  }
  
  // MARK: - Player Setup
  private func setupPlayer() {
    let setupStart = CFAbsoluteTimeGetCurrent()
    NSLog("[VideoPlayerView] 🚀 setupPlayer() called - VERIFY THIS LOG APPEARS")
    
    guard let urlString = source as String?,
          let originalURL = URL(string: urlString) else {
      NSLog("[VideoPlayerView] ❌ Invalid source URL")
      onError?(["error": "Invalid source URL"])
      return
    }
    
    // Use videoId prop for cleaner logs (already passed from RN)
    let displayId = videoId as String? ?? "unknown"
    NSLog("[VideoPlayerView] 📹 Setting up player for video: %@", displayId)
    NSLog("[VideoPlayerView] 🔗 Original URL: %@", originalURL.absoluteString)
    
    var finalURL = originalURL
    if KTVHTTPCache.proxyIsRunning() {
      let proxyStart = CFAbsoluteTimeGetCurrent()
      if let proxiedURL = KTVHTTPCache.proxyURL(withOriginalURL: originalURL) {
        let proxyEnd = CFAbsoluteTimeGetCurrent()
        finalURL = proxiedURL
        // NSLog("[VideoPlayerView] ✅ Proxied URL: %@ (took %.0fms)", 
        //       proxiedURL.absoluteString, (proxyEnd - proxyStart) * 1000)
        
        // Check cache status
        if let cachedURL = KTVHTTPCache.cacheCompleteFileURL(with: originalURL) {
          NSLog("[CACHE_DEBUG] 💾 Cache HIT: %@", cachedURL.absoluteString)
        } else {
          NSLog("[CACHE_DEBUG] 📡 Cache MISS: Will stream from network")
        }
      } else {
        NSLog("[VideoPlayerView] ❌ Failed to create proxy URL for video: %@", displayId)
        // CRITICAL: For testing phase, fail if proxy can't rewrite
        onError?(["error": "Failed to get cached URL for: \(urlString)"])
        return
      }
    } else {
      NSLog("[VideoPlayerView] ❌ ERROR: KTV Proxy not running!")
      // CRITICAL: For testing phase, fail if proxy not running
      onError?(["error": "KTV Proxy not running"])
      return
    }
    
    // let setupEnd = CFAbsoluteTimeGetCurrent()
    // NSLog("[VideoPlayerView] ⏱️ setupPlayer() completed in %.0fms", (setupEnd - setupStart) * 1000)
    
    setupPlayerWithURL(finalURL)
  }
  
  private func setupPlayerWithURL(_ url: URL) {
    let displayId = videoId as String? ?? "unknown"
    NSLog("[VideoPlayerView] 🎬 setupPlayerWithURL: %@", displayId)
    NSLog("[VideoPlayerView] 🔗 Final URL: %@", url.absoluteString)
    
    // TESTING: Create new player instead of reusing from pool
    // Acquire player and layer from pool
    // player = VideoPlayerPool.acquirePlayer()
    // playerLayer = VideoPlayerPool.acquireLayer()
    
    // CREATE NEW PLAYER FOR TESTING
    player = AVPlayer()
    playerLayer = AVPlayerLayer()
    
    if player == nil {
      NSLog("[VideoPlayerView] ❌ CRITICAL: Player is nil after creating new!")
    }
    if playerLayer == nil {
      NSLog("[VideoPlayerView] ❌ CRITICAL: Player layer is nil after creating new!")
    }
    
    // Configure player layer
    if let layer = playerLayer {
      layer.videoGravity = .resizeAspect
      layer.frame = bounds
      layer.backgroundColor = UIColor.clear.cgColor  // Transparent - shows thumbnail underneath
      layer.player = player  // ⚠️ CRITICAL: Connect layer to player!
      self.layer.addSublayer(layer)
    }
    
    // Create player item with PROXIED URL
    NSLog("[VideoPlayerView] 📦 Creating AVPlayerItem with URL: %@", url.absoluteString)
    playerItem = AVPlayerItem(url: url)
    
    if let item = playerItem {
      NSLog("[VideoPlayerView] ✅ AVPlayerItem created successfully for %@", displayId)
      NSLog("[VideoPlayerView] 📊 Initial player item status: %d (0=unknown, 1=ready, 2=failed)", item.status.rawValue)
    } else {
      NSLog("[VideoPlayerView] ❌ CRITICAL: Failed to create AVPlayerItem for %@", displayId)
    }
    
    if let p = player {
      p.replaceCurrentItem(with: playerItem)
      NSLog("[VideoPlayerView] 📝 AVPlayerItem attached to player for %@", displayId)
    } else {
      NSLog("[VideoPlayerView] ❌ CRITICAL: Cannot attach player item - player is nil for %@", displayId)
    }
    
    // Ensure player is muted by default (safety measure)
    player?.isMuted = true
    
    // Add observers
    addPlayerObservers()
    
    // Notify load start
    onLoad?(["videoId": videoId as Any])
    
    // Add 15s timeout for loading (playback context - be patient)
    loadTimeout = Timer.scheduledTimer(withTimeInterval: 15.0, repeats: false) { [weak self] _ in
      if self?.playerItem?.status != .readyToPlay {
        NSLog("[VideoPlayerView] ⏱️ Load timeout reached for %@", self?.videoId as String? ?? "unknown")
        self?.handleLoadTimeout()
      }
    }
  }
  
  private func handleLoadTimeout() {
    NSLog("[VideoPlayerView] ⏱️ Load timeout (15s) - cancelling stuck load")
    
    // Cancel timeout
    loadTimeout?.invalidate()
    loadTimeout = nil
    
    // Emit error
    onError?([
      "videoId": videoId as Any,
      "error": "Load timeout after 15s",
      "recoverable": true
    ])
    
    // Clean up player to free resources
    player?.replaceCurrentItem(with: nil)
  }
  
  // MARK: - Observers
  private func addPlayerObservers() {
    let displayId = videoId as String? ?? "unknown"
    
    guard let player = player else {
      NSLog("[VideoPlayerView] ❌ CRITICAL: Cannot add observers - player is nil for %@", displayId)
      return
    }
    
    guard let playerItem = playerItem else {
      NSLog("[VideoPlayerView] ❌ CRITICAL: Cannot add observers - playerItem is nil for %@", displayId)
      return
    }
    
    NSLog("[VideoPlayerView] 📎 Adding observers for %@", displayId)
    
    // Player item status observer
    playerItem.addObserver(self, forKeyPath: "status", options: [.new], context: nil)
    NSLog("[VideoPlayerView] ✅ Added status observer for %@", displayId)
    
    playerItem.addObserver(self, forKeyPath: "playbackBufferEmpty", options: [.new], context: nil)
    playerItem.addObserver(self, forKeyPath: "playbackLikelyToKeepUp", options: [.new], context: nil)
    
    // Time observer for progress
    let interval = CMTime(seconds: 0.25, preferredTimescale: CMTimeScale(NSEC_PER_SEC))
    timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
      self?.onTimeUpdate(time)
    }
    
    // End notification
    NotificationCenter.default.addObserver(
      self,
      selector: #selector(playerDidFinishPlaying),
      name: .AVPlayerItemDidPlayToEndTime,
      object: playerItem
    )
    
    NSLog("[VideoPlayerView] ✅ All observers added for %@", displayId)
  }
  
  private func removePlayerObservers() {
    guard let playerItem = playerItem else { return }
    
    playerItem.removeObserver(self, forKeyPath: "status")
    playerItem.removeObserver(self, forKeyPath: "playbackBufferEmpty")
    playerItem.removeObserver(self, forKeyPath: "playbackLikelyToKeepUp")
    
    if let timeObserver = timeObserver {
      player?.removeTimeObserver(timeObserver)
      self.timeObserver = nil
    }
    
    NotificationCenter.default.removeObserver(self)
  }
  
  // MARK: - KVO
  override func observeValue(forKeyPath keyPath: String?, of object: Any?, change: [NSKeyValueChangeKey : Any]?, context: UnsafeMutableRawPointer?) {
    guard let keyPath = keyPath else { 
      NSLog("[VideoPlayerView] ⚠️ observeValue called with nil keyPath")
      return 
    }
    
    let displayId = videoId as String? ?? "unknown"
    NSLog("[VideoPlayerView] 🔔 KVO triggered for %@ - keyPath: %@", displayId, keyPath)
    
    switch keyPath {
    case "status":
      NSLog("[VideoPlayerView] 🎯 Status change detected for %@ - calling handlePlayerItemStatus", displayId)
      handlePlayerItemStatus()
    case "playbackBufferEmpty":
      NSLog("[VideoPlayerView] 🎯 Buffer empty detected for %@", displayId)
      handleBufferState(isBuffering: true)
    case "playbackLikelyToKeepUp":
      NSLog("[VideoPlayerView] 🎯 Buffer likely to keep up for %@", displayId)
      handleBufferState(isBuffering: false)
    default:
      NSLog("[VideoPlayerView] ⚠️ Unknown keyPath: %@ for %@", keyPath, displayId)
      super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
    }
  }
  
  private func handlePlayerItemStatus() {
    guard let playerItem = playerItem else {
      NSLog("[VideoPlayerView] ⚠️ handlePlayerItemStatus called but playerItem is nil")
      return
    }
    
    let displayId = videoId as String? ?? "unknown"
    NSLog("[VideoPlayerView] 📊 Player item status changed for %@: %d", displayId, playerItem.status.rawValue)
    
    switch playerItem.status {
    case .readyToPlay:
      NSLog("[VideoPlayerView] ✅ PLAYER READY: %@", displayId)
      // Cancel load timeout (player ready successfully)
      loadTimeout?.invalidate()
      loadTimeout = nil
      
      isPlayerReady = true
      onLoad?([
        "videoId": videoId as Any,
        "duration": CMTimeGetSeconds(playerItem.duration),
        "naturalSize": [
          "width": playerItem.asset.tracks(withMediaType: .video).first?.naturalSize.width ?? 0,
          "height": playerItem.asset.tracks(withMediaType: .video).first?.naturalSize.height ?? 0
        ]
      ])
      
      // Emit onReadyForDisplay when player item is ready to display first frame
      onReadyForDisplay?([
        "videoId": videoId as Any
      ])
    case .failed:
      let errorMsg = playerItem.error?.localizedDescription ?? "Unknown"
      let errorCode = (playerItem.error as NSError?)?.code ?? -1
      let errorDomain = (playerItem.error as NSError?)?.domain ?? "Unknown"
      NSLog("[VideoPlayerView] ❌ PLAYER FAILED: %@", displayId)
      NSLog("[VideoPlayerView] ❌ Error Message: %@", errorMsg)
      NSLog("[VideoPlayerView] ❌ Error Code: %d", errorCode)
      NSLog("[VideoPlayerView] ❌ Error Domain: %@", errorDomain)
      if let error = playerItem.error as NSError? {
        NSLog("[VideoPlayerView] ❌ Full Error: %@", error)
      }
      
      // Cancel load timeout
      loadTimeout?.invalidate()
      loadTimeout = nil
      
      onError?([
        "videoId": videoId as Any,
        "error": playerItem.error?.localizedDescription ?? "Unknown error"
      ])
    case .unknown:
      NSLog("[VideoPlayerView] ⏳ PLAYER UNKNOWN STATE: %@", displayId)
      break
    @unknown default:
      NSLog("[VideoPlayerView] ❓ PLAYER UNKNOWN STATE (raw: %d): %@", playerItem.status.rawValue, displayId)
      break
    }
  }
  
  private func handleBufferState(isBuffering: Bool) {
    onBuffer?([
      "videoId": videoId as Any,
      "isBuffering": isBuffering
    ])
  }
  
  private func onTimeUpdate(_ time: CMTime) {
    guard let playerItem = playerItem else { return }
    
    let currentTime = CMTimeGetSeconds(time)
    let duration = CMTimeGetSeconds(playerItem.duration)
    let playableDuration = CMTimeGetSeconds(playerItem.asset.duration)
    
    onProgress?([
      "videoId": videoId as Any,
      "currentTime": currentTime,
      "playableDuration": playableDuration,
      "duration": duration
    ])
  }
  
  @objc private func playerDidFinishPlaying() {
    onEnd?(["videoId": videoId as Any])
  }
  
  // MARK: - Layout
  override func layoutSubviews() {
    super.layoutSubviews()
    playerLayer?.frame = bounds
  }
  
  // MARK: - Cleanup
  private func cleanupCurrentPlayer() {
    // Remove observers
    removePlayerObservers()
    
    // Cancel load timeout
    loadTimeout?.invalidate()
    loadTimeout = nil
    
    // TESTING: Don't return to pool, just release
    // Release to pool
    // if let p = player {
    //   VideoPlayerPool.releasePlayer(p)
    //   self.player = nil
    // }
    // if let l = playerLayer {
    //   VideoPlayerPool.releaseLayer(l)
    //   self.playerLayer = nil
    // }
    
    // Just release for testing
    self.player = nil
    self.playerLayer = nil
    
    playerItem = nil
    isPlayerReady = false
  }
  
  deinit {
    // Cancel load timeout
    loadTimeout?.invalidate()
    loadTimeout = nil
    
    removePlayerObservers()
    
    // TESTING: Don't return to pool
    // Return player and layer to pool
    // if let player = player {
    //   VideoPlayerPool.releasePlayer(player)
    // }
    // if let layer = playerLayer {
    //   VideoPlayerPool.releaseLayer(layer)
    // }
  }
}
