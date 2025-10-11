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
      setupPlayer()
    }
  }
  
  @objc var paused: Bool = true {
    didSet {
      if paused {
        player?.pause()
      } else {
        NSLog("[VideoPlayerView] ▶️ Calling player.play() for video: %@", videoId as String? ?? "unknown")
        player?.play()
      }
    }
  }
  
  @objc var muted: Bool = true {
    didSet {
      player?.isMuted = muted
    }
  }
  
  @objc var videoId: NSString?
  
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
      if let proxiedURL = KTVHTTPCache.proxyURL(withOriginalURL: originalURL) {
        finalURL = proxiedURL
        NSLog("[VideoPlayerView] ✅ Proxied URL: %@", proxiedURL.absoluteString)
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
    
    setupPlayerWithURL(finalURL)
  }
  
  private func setupPlayerWithURL(_ url: URL) {
    // Acquire player and layer from pool
    player = VideoPlayerPool.acquirePlayer()
    playerLayer = VideoPlayerPool.acquireLayer()
    
    // Configure player layer
    if let layer = playerLayer {
      layer.videoGravity = .resizeAspect
      layer.frame = bounds
      layer.backgroundColor = UIColor.clear.cgColor  // Transparent - shows thumbnail underneath
      layer.player = player  // ⚠️ CRITICAL: Connect layer to player!
      self.layer.addSublayer(layer)
    }
    
    // Create player item with PROXIED URL
    playerItem = AVPlayerItem(url: url)
    player?.replaceCurrentItem(with: playerItem)
    
    // Add observers
    addPlayerObservers()
    
    // Notify load start
    onLoad?(["videoId": videoId as Any])
  }
  
  // MARK: - Observers
  private func addPlayerObservers() {
    guard let player = player, let playerItem = playerItem else { return }
    
    // Player item status observer
    playerItem.addObserver(self, forKeyPath: "status", options: [.new], context: nil)
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
    guard let keyPath = keyPath else { return }
    
    switch keyPath {
    case "status":
      handlePlayerItemStatus()
    case "playbackBufferEmpty":
      handleBufferState(isBuffering: true)
    case "playbackLikelyToKeepUp":
      handleBufferState(isBuffering: false)
    default:
      super.observeValue(forKeyPath: keyPath, of: object, change: change, context: context)
    }
  }
  
  private func handlePlayerItemStatus() {
    guard let playerItem = playerItem else { return }
    
    switch playerItem.status {
    case .readyToPlay:
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
      onError?([
        "videoId": videoId as Any,
        "error": playerItem.error?.localizedDescription ?? "Unknown error"
      ])
    case .unknown:
      break
    @unknown default:
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
  deinit {
    removePlayerObservers()
    
    // Return player and layer to pool
    if let player = player {
      VideoPlayerPool.releasePlayer(player)
    }
    if let layer = playerLayer {
      VideoPlayerPool.releaseLayer(layer)
    }
  }
}
