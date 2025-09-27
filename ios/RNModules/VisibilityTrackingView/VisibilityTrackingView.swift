//
//  VisibilityTrackingView.swift
//  VideoFeedApp
//
//  Created by Rajat Gupta on 26/09/25.
//

import UIKit

enum VisibilityChangeDirection: String, Codable {
  case movingIn
  case movingOut
}

struct VisibilityEvent: Codable {
  let uniqueId: String
  let direction: VisibilityChangeDirection
  let visibilityPercentage: CGFloat
}

class VisibilityTrackingView: RCTView {
  
  // MARK: - JS Props
  @objc var throttleInterval: NSNumber?
  @objc var uniqueId: NSString?
  @objc var visibilityConfig: ViewabilityTransitioningConfig? {
    didSet {
      // Now you can safely access the sorted arrays in Swift
      if let config = visibilityConfig {
        print("Moving In (Ascending): \(config.movingIn)")
        print("Moving Out (Descending): \(config.movingOut)")
      }
    }
  }
  
  // MARK: - Events
  @objc var onVisibilityStateChange: RCTDirectEventBlock?
  
  // MARK: - Internal State
  private var displayLink: CADisplayLink?
  private var isTracking = false
  //  private var lastEmittedState: [String: Bool] = [:]
  private var lastEmittedTime: TimeInterval = 0
  private var lastVisibilityPercentage: CGFloat? = nil
  private var lastVisibilityChangeDirection: VisibilityChangeDirection? = nil
  private var lastEmittedVisibilityEvent: VisibilityEvent? = nil
  
  private var isThrottled = false
  
  // MARK: - Subviews
  private lazy var visibilityLabel: UILabel = {
    let label = UILabel()
    label.translatesAutoresizingMaskIntoConstraints = false
    label.textAlignment = .center
    label.textColor = .white
    return label
  }()
  
  // MARK: - Initialization
  override init(frame: CGRect) {
    super.init(frame: frame)
    setupView()
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupView()
  }
  
  private func setupView() {
    backgroundColor = .systemBlue
    addSubview(visibilityLabel)
    NSLayoutConstraint.activate([
      visibilityLabel.centerXAnchor.constraint(equalTo: centerXAnchor),
      visibilityLabel.centerYAnchor.constraint(equalTo: centerYAnchor)
    ])
  }
  
  // MARK: - Lifecycle
  override func willMove(toWindow newWindow: UIWindow?) {
    super.willMove(toWindow: newWindow)
    if newWindow != nil {
      startVisibilityTracking()
    } else {
      stopVisibilityTracking()
    }
  }
  
  deinit {
    stopVisibilityTracking()
  }
  
  // MARK: - CADisplayLink Management
  private func startVisibilityTracking() {
    guard !isTracking else { return }
    processVisibilityEvent(percentage: 0.0)
    
    displayLink = CADisplayLink(target: self, selector: #selector(updateVisibility))
    displayLink?.add(to: .main, forMode: .common)
    isTracking = true
  }
  
  private func stopVisibilityTracking() {
    //    if lastEmittedTime > 0 {
    processVisibilityEvent(percentage: 0.0)
    //    }
    displayLink?.invalidate()
    displayLink = nil
    isTracking = false
  }
  
  // MARK: - Visibility Calculation
  @objc private func updateVisibility() {
    guard let window = window else {
      stopVisibilityTracking()
      return
    }
    
    let viewFrameInWindow = self.convert(bounds, to: window)
    let intersection = viewFrameInWindow.intersection(window.bounds)
    
    let visibilityPercentage: CGFloat
    if viewFrameInWindow.height > 0 {
      visibilityPercentage = (intersection.height / viewFrameInWindow.height) * 100.0
    } else {
      visibilityPercentage = 0.0
    }
    
    // Update the label and process the visibility event
    visibilityLabel.text = String(format: "\(String(describing: uniqueId)) - %.0f%% Visible", visibilityPercentage)
    processVisibilityEvent(percentage: visibilityPercentage)
  }
  
  // MARK: - Event Processing with Throttling
  private func processVisibilityEvent(percentage: CGFloat) {
    guard let thresholds = visibilityConfig,
          let onVisibilityStateChange = onVisibilityStateChange,
          let id = uniqueId else {
      return
    }
    
    let changeDirection = percentage - (lastVisibilityPercentage ?? 0) > 0 ? VisibilityChangeDirection.movingIn : VisibilityChangeDirection.movingOut
    
    let currentTimestamp = Date().timeIntervalSince1970
    let interval = throttleInterval?.doubleValue ?? 0
    let elapsedTime = currentTimestamp - lastEmittedTime
    
    // Check if throttling is active
    if interval > 0 && elapsedTime < interval / 1000.0 {
      return
    }
    
    var shouldSendEvent = false
    
    // Check for a change in direction
    if changeDirection != lastVisibilityChangeDirection {
      shouldSendEvent = true
    } else {
      // Determine if a new threshold has been crossed
      if changeDirection == .movingIn {
        let previousThreshold = thresholds.movingIn.first(where: { $0.doubleValue >= lastVisibilityPercentage ?? 0 })
        let currentThreshold = thresholds.movingIn.first(where: { $0.doubleValue >= percentage })
        
        // Compare the values, not the optional instances
        if previousThreshold?.doubleValue != currentThreshold?.doubleValue {
          shouldSendEvent = true
        }
      } else if changeDirection == .movingOut {
        let previousThreshold = thresholds.movingOut.first(where: { $0.doubleValue < lastVisibilityPercentage ?? 0 })
        let currentThreshold = thresholds.movingOut.first(where: { $0.doubleValue < percentage })
        
        // Compare the values, not the optional instances
        if previousThreshold?.doubleValue != currentThreshold?.doubleValue {
          shouldSendEvent = true
        }
      }
    }
    
    if shouldSendEvent {
      lastVisibilityPercentage = percentage
      lastVisibilityChangeDirection = changeDirection
      
      let newVisibilityEvent = VisibilityEvent(
        uniqueId: uniqueId! as String,
        direction: changeDirection,
        visibilityPercentage: percentage
      )
      onVisibilityStateChange(newVisibilityEvent.toDictionary())
      lastEmittedTime = currentTimestamp
    }
  }
}

extension Encodable {
  /// Converts a Codable object to a dictionary.
  ///
  /// - Returns: A dictionary representation of the object, or nil if conversion fails.
  func toDictionary() -> [String: Any]? {
    do {
      // 1. Encode the object to JSON Data
      let data = try JSONEncoder().encode(self)
      
      // 2. Deserialize the JSON Data into a dictionary
      let dictionary = try JSONSerialization.jsonObject(with: data, options: .fragmentsAllowed) as? [String: Any]
      
      return dictionary
    } catch {
      print("Error converting object to dictionary: \(error)")
      return nil
    }
  }
}
