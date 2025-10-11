//
//  VideoPlayerPool.swift
//  VideoFeedApp
//
//  AVPlayer and AVPlayerLayer pooling for performance optimization
//

import UIKit
import AVFoundation

@objc(VideoPlayerPool)
class VideoPlayerPool: NSObject {
  
  // MARK: - Singleton
  static let shared = VideoPlayerPool()
  
  // MARK: - Pool Configuration
  private let maxPlayers = 5
  private let maxLayers = 8
  
  // MARK: - Pools
  private var availablePlayers: [AVPlayer] = []
  private var availableLayers: [AVPlayerLayer] = []
  private var activePlayers: Set<AVPlayer> = []
  private var activeLayers: Set<AVPlayerLayer> = []
  
  // MARK: - Thread Safety
  private let queue = DispatchQueue(label: "com.videofeed.playerpool", attributes: .concurrent)
  
  // MARK: - Initialization
  private override init() {
    super.init()
    prewarmPools()
  }
  
  // MARK: - Pool Management
  private func prewarmPools() {
    // Pre-create some players and layers for better performance
    for _ in 0..<maxPlayers {
      let player = createNewPlayer()
      availablePlayers.append(player)
    }
    
    for _ in 0..<maxLayers {
      let layer = createNewLayer()
      availableLayers.append(layer)
    }
  }
  
  private func createNewPlayer() -> AVPlayer {
    let player = AVPlayer()
    player.automaticallyWaitsToMinimizeStalling = true
    return player
  }
  
  private func createNewLayer() -> AVPlayerLayer {
    let layer = AVPlayerLayer()
    layer.videoGravity = .resizeAspect
    return layer
  }
  
  // MARK: - Public API
  @objc static func acquirePlayer() -> AVPlayer {
    return shared.acquirePlayerInternal()
  }
  
  @objc static func releasePlayer(_ player: AVPlayer) {
    shared.releasePlayerInternal(player)
  }
  
  @objc static func acquireLayer() -> AVPlayerLayer {
    return shared.acquireLayerInternal()
  }
  
  @objc static func releaseLayer(_ layer: AVPlayerLayer) {
    shared.releaseLayerInternal(layer)
  }
  
  @objc static func getPoolStats() -> [String: Any] {
    return shared.getPoolStatsInternal()
  }
  
  @objc static func clearPool() {
    shared.clearPoolInternal()
  }
  
  // MARK: - Internal Methods
  private func acquirePlayerInternal() -> AVPlayer {
    return queue.sync(flags: .barrier) {
      let player: AVPlayer
      
      if let availablePlayer = availablePlayers.popLast() {
        player = availablePlayer
      } else {
        player = createNewPlayer()
      }
      
      // Reset player state
      player.pause()
      player.replaceCurrentItem(with: nil)
      
      activePlayers.insert(player)
      return player
    }
  }
  
  private func releasePlayerInternal(_ player: AVPlayer) {
    queue.async(flags: .barrier) {
      // Clean up player
      player.pause()
      player.replaceCurrentItem(with: nil)
      
      // Remove from active set
      self.activePlayers.remove(player)
      
      // Return to available pool if not at capacity
      if self.availablePlayers.count < self.maxPlayers {
        self.availablePlayers.append(player)
      }
    }
  }
  
  private func acquireLayerInternal() -> AVPlayerLayer {
    return queue.sync(flags: .barrier) {
      let layer: AVPlayerLayer
      
      if let availableLayer = availableLayers.popLast() {
        layer = availableLayer
      } else {
        layer = createNewLayer()
      }
      
      // Reset layer state
      layer.player = nil
      
      activeLayers.insert(layer)
      return layer
    }
  }
  
  private func releaseLayerInternal(_ layer: AVPlayerLayer) {
    queue.async(flags: .barrier) {
      // Clean up layer
      layer.player = nil
      layer.removeFromSuperlayer()
      
      // Remove from active set
      self.activeLayers.remove(layer)
      
      // Return to available pool if not at capacity
      if self.availableLayers.count < self.maxLayers {
        self.availableLayers.append(layer)
      }
    }
  }
  
  private func getPoolStatsInternal() -> [String: Any] {
    return queue.sync {
      return [
        "availablePlayers": availablePlayers.count,
        "activePlayers": activePlayers.count,
        "availableLayers": availableLayers.count,
        "activeLayers": activeLayers.count,
        "maxPlayers": maxPlayers,
        "maxLayers": maxLayers
      ]
    }
  }
  
  private func clearPoolInternal() {
    queue.async(flags: .barrier) {
      // Clean up all active players and layers
      for player in self.activePlayers {
        player.pause()
        player.replaceCurrentItem(with: nil)
      }
      
      for layer in self.activeLayers {
        layer.player = nil
        layer.removeFromSuperlayer()
      }
      
      // Clear pools
      self.availablePlayers.removeAll()
      self.availableLayers.removeAll()
      self.activePlayers.removeAll()
      self.activeLayers.removeAll()
      
      // Re-prewarm pools
      self.prewarmPools()
    }
  }
}

