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
  case none
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
      visibilityPercentage = (((intersection.height*intersection.width) / (viewFrameInWindow.height*viewFrameInWindow.width)) * 100.0).rounded(.down)
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
    
    var changeDirection = VisibilityChangeDirection.none
    let percentageChange = percentage - (lastVisibilityPercentage ?? 0)
    if percentageChange > 0 {
      changeDirection = .movingIn
    }
    if percentageChange < 0 {
      changeDirection = .movingOut
    }
    
    if changeDirection != .none {
      print("RGLOG:: VisibilityTrackingView: - \"\(id)\", - direction change (\(changeDirection)) - last (\((lastVisibilityPercentage ?? 0))%), current (\((percentage))%), lastEvent - (\(String(describing: lastEmittedVisibilityEvent?.toDictionary())))")
    }
    
    lastVisibilityPercentage = percentage
    lastVisibilityChangeDirection = changeDirection
    
        if changeDirection == .none {
          return
        }
    let currentTimestamp = Date().timeIntervalSince1970
    let interval = throttleInterval?.doubleValue ?? 0
    let elapsedTime = currentTimestamp - lastEmittedTime
    
    // Check if throttling is active
    if interval > 0 && elapsedTime < interval / 1000.0 {
      return
    }
    
    var shouldSendEvent = false
    
    /**
     * If current direction is moving in, this might be first appearance of the card, hence no last event, send event now if there is some threshold crossed
     If there is not new threshold crossed in this condition the observer should be able to utilise a default value
     * or there might be a last event and last event's direction could also be moving in but then only if a new threshold has been crossed is when the event should be sent
     * if the last event's direction was moving out, don't rely on threshold difference between then and now, if there is a new threshold crossed, send event.
     */
    if changeDirection == .movingIn {
      let currentCrossedThreshold = thresholds.movingIn.last(where: { percentage > $0.doubleValue })
      if let currentThreshold = currentCrossedThreshold {
        if let lastEmittedEvent = lastEmittedVisibilityEvent {
          let lastEventDirection = lastEmittedEvent.direction
          if lastEventDirection == .movingOut {
            // send event
            shouldSendEvent = true
          } else if lastEventDirection == .movingIn,
                    let previousThreshold = thresholds.movingIn.last(where: { (lastEmittedEvent.visibilityPercentage) > $0.doubleValue }),
                    previousThreshold.doubleValue != currentThreshold.doubleValue {
            // send event
            shouldSendEvent = true
          }
        } else {
          // send event
          shouldSendEvent = true
        }
      }
    } else if changeDirection == .movingOut, let lastEmittedEvent = lastEmittedVisibilityEvent {
      /**
       * If direction is moving out, that means the card was visible earlier, which implies there must be a last emitted event
       * Previous threshold may not exist cases when none of the moving out was crossed in last iteration or when the direction was not moving out last time.
       * So if the direction is moving out now but wasn't so in the last event and now a threshold has been crossed, send event.
       * If direction was moving out in last event as well, then there must have been a difference in the threshold crossed this time and the last one, only then send.
       Last threshold may not exist also.
       * There must be some threshold that gets crossed in the moving out direction otherwise whatever visible state was earlier should continue.
       If everything is alright, last state in this case should be active.
       * Only if the card is much larger than the total screen size, some of these assumptions might fail, but what kind of UX will that even be?
       */
      let curentCrossedThreshold = thresholds.movingOut.last(where: { $0.doubleValue > percentage })
      let lastEventDirection = lastEmittedEvent.direction
      let previousThreshold = thresholds.movingOut.last(where: { $0.doubleValue > lastEmittedEvent.visibilityPercentage })
      
      // There is new threshold crossed
      if let currentThreshold = curentCrossedThreshold {
        // And the direction has changed to moving out now
        // Actually a better check would be if the last direction was moving in, may change this
        
        if .movingIn == lastEventDirection {
          shouldSendEvent = true
        } else if let previousThreshold = previousThreshold {
          // Or the direction was moving out but new threshold crossed is not same as previously crossed threshold
          if previousThreshold.doubleValue != currentThreshold.doubleValue {
            shouldSendEvent = true
          }
        }
      }
    }
    if shouldSendEvent {
      let newVisibilityEvent = VisibilityEvent(
        uniqueId: id as String,
        direction: changeDirection,
        visibilityPercentage: percentage
      )
      onVisibilityStateChange(newVisibilityEvent.toDictionary())
      
      lastEmittedTime = currentTimestamp
      lastEmittedVisibilityEvent = newVisibilityEvent
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
