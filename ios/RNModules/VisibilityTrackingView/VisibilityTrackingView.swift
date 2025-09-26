//
//  VisibilityTrackingView.swift
//  VideoFeedApp
//
//  Created by Rajat Gupta on 26/09/25.
//

import UIKit

class VisibilityTrackingView: RCTView {
  
  // MARK: - JS Props
  @objc var throttleInterval: NSNumber?
  @objc var uniqueId: NSString?
  @objc var visibilityThresholds: NSDictionary?
  
  // MARK: - Events
  @objc var onVisibilityStateChange: RCTDirectEventBlock?
  
  // MARK: - Internal State
  private var displayLink: CADisplayLink?
  private var isTracking = false
  private var lastEmittedState: [String: Bool] = [:]
  private var lastEmittedTime: TimeInterval = 0
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
    
    displayLink = CADisplayLink(target: self, selector: #selector(updateVisibility))
    displayLink?.add(to: .main, forMode: .common)
    isTracking = true
  }
  
  private func stopVisibilityTracking() {
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
    visibilityLabel.text = String(format: "%.0f%% Visible", visibilityPercentage)
    processVisibilityEvent(percentage: visibilityPercentage)
  }
  
  // MARK: - Event Processing with Throttling
  private func processVisibilityEvent(percentage: CGFloat) {
    guard let thresholds = visibilityThresholds as? [String: NSNumber],
          let onVisibilityStateChange = onVisibilityStateChange,
          let id = uniqueId else {
      return
    }
    
    let currentTimestamp = Date().timeIntervalSince1970
    let interval = throttleInterval?.doubleValue ?? 0
    let elapsedTime = currentTimestamp - lastEmittedTime
    
    // Check if throttling is active
    if interval > 0 && elapsedTime < interval / 1000.0 {
      return
    }
    
    var newState: [String: Bool] = [:]
    for (key, threshold) in thresholds {
      newState[key] = percentage >= threshold.doubleValue
    }
    
    // Emit only if a state has changed
    if newState.allSatisfy({ lastEmittedState[$0.key] == $0.value }) {
      return
    }
    
    var body: [String: Any] = [
        "id": id,
        "currentVisibilityPercentage": percentage,
    ]
    body.merge(newState) { (_, new) in new } // Merge the dynamic states

    onVisibilityStateChange(body)
    lastEmittedState = newState
    lastEmittedTime = currentTimestamp
  }
}
