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
  private var maxPlayers = 3  // Configurable, default 3
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
  
  /// Try to acquire a player without exceeding pool limit
  /// Returns nil if all players are busy
  @objc static func tryAcquirePlayer() -> AVPlayer? {
    return shared.tryAcquirePlayerInternal()
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
  
  @objc static func setMaxPlayersWithMaxPlayers(_ maxPlayers: Int,
                                                 resolve: @escaping RCTPromiseResolveBlock,
                                                 reject: @escaping RCTPromiseRejectBlock) {
    shared.queue.async(flags: .barrier) {
      shared.maxPlayers = maxPlayers
      NSLog("[VideoPlayerPool] 🔧 Max players updated: %d", maxPlayers)
      resolve(true)
    }
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
      
      // Add to active set synchronously (this is safe since we're on the queue)
      activePlayers.insert(player)
      
      // Reset player state synchronously to avoid race conditions
      player.pause()
      player.replaceCurrentItem(with: nil)
      
      return player
    }
  }
  
  private func tryAcquirePlayerInternal() -> AVPlayer? {
    return queue.sync(flags: .barrier) {
      // Check if we have available player
      if let availablePlayer = availablePlayers.popLast() {
        // Add to active set synchronously (this is safe since we're on the queue)
        activePlayers.insert(availablePlayer)
        NSLog("[VideoPlayerPool] ✅ Acquired player from pool (active: %d)", activePlayers.count)
        
        // Reset player state synchronously to avoid race conditions
        availablePlayer.pause()
        availablePlayer.replaceCurrentItem(with: nil)
        
        return availablePlayer
      }
      
      // Check if we can create a new player (under max limit)
      let totalPlayers = availablePlayers.count + activePlayers.count
      if totalPlayers < maxPlayers {
        let newPlayer = createNewPlayer()
        activePlayers.insert(newPlayer)
        NSLog("[VideoPlayerPool] ➕ Created new player (active: %d/%d)", activePlayers.count, maxPlayers)
        return newPlayer
      }
      
      // Pool exhausted
      NSLog("[VideoPlayerPool] ⚠️ Pool exhausted (active: %d/%d)", activePlayers.count, maxPlayers)
      return nil
    }
  }
  
  private func releasePlayerInternal(_ player: AVPlayer) {
    queue.async(flags: .barrier) {
      // Remove from active set first
      self.activePlayers.remove(player)
      
      // Clean up player synchronously (safe since we're on the queue)
      player.pause()
      player.replaceCurrentItem(with: nil)
      
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
      
      // Add to active set synchronously (this is safe since we're on the queue)
      activeLayers.insert(layer)
      
      // Reset layer state synchronously to avoid race conditions
      layer.player = nil
      
      return layer
    }
  }
  
  private func releaseLayerInternal(_ layer: AVPlayerLayer) {
    queue.async(flags: .barrier) {
      // Remove from active set first
      self.activeLayers.remove(layer)
      
      // Clean up layer synchronously (safe since we're on the queue)
      layer.player = nil
      layer.removeFromSuperlayer()
      
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

