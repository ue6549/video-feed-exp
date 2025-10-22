import Foundation

/// Security event logger for audit and monitoring
class SecurityEventLogger {
    private let config: SecurityConfig
    private let queue = DispatchQueue(label: "security.logger", attributes: .concurrent)
    private var eventCounts: [String: Int] = [:]
    private var lastCleanup: Date = Date()
    
    init(config: SecurityConfig) {
        self.config = config
    }
    
    /// Log security event
    func logEvent(_ event: SecurityEvent) {
        guard config.logSecurityEvents else { return }
        
        queue.async(flags: .barrier) {
            self.logEventInternal(event)
        }
    }
    
    /// Log security event (internal, thread-safe)
    private func logEventInternal(_ event: SecurityEvent) {
        let timestamp = Date()
        let eventType = event.eventType
        let severity = event.severity
        
        // Update event counts
        eventCounts[eventType, default: 0] += 1
        
        // Create log message
        let logMessage = createLogMessage(event: event, timestamp: timestamp, severity: severity)
        
        // Log to console (in production, this would go to a proper logging system)
        print(logMessage)
        
        // Clean up old data periodically
        if timestamp.timeIntervalSince(lastCleanup) > 300 { // 5 minutes
            cleanupOldData()
            lastCleanup = timestamp
        }
    }
    
    /// Create formatted log message
    private func createLogMessage(event: SecurityEvent, timestamp: Date, severity: String) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss.SSS"
        let timestampString = formatter.string(from: timestamp)
        
        let baseMessage = "[\(timestampString)] [SECURITY] [\(severity)] \(event.eventType)"
        
        switch event {
        case .authenticationFailure(let token):
            let tokenInfo = token != nil ? " (token: \(token!.prefix(8))...)" : " (no token)"
            return "\(baseMessage): Authentication failed\(tokenInfo)"
            
        case .authorizationFailure(let domain, let ext):
            let extInfo = ext != nil ? " (extension: \(ext!))" : ""
            return "\(baseMessage): Authorization failed for domain: \(domain)\(extInfo)"
            
        case .rateLimitExceeded(let domain, let currentRate):
            return "\(baseMessage): Rate limit exceeded for domain: \(domain) (rate: \(String(format: "%.2f", currentRate))/sec)"
            
        case .maliciousPatternDetected(let url, let pattern):
            let safeURL = sanitizeURLForLogging(url)
            return "\(baseMessage): Malicious pattern detected in URL: \(safeURL) (pattern: \(pattern))"
            
        case .configurationUpdate(let oldConfig, let newConfig):
            return "\(baseMessage): Configuration updated (enabled: \(oldConfig.enabled) -> \(newConfig.enabled))"
            
        case .tokenRotationSuccess:
            return "\(baseMessage): Token rotation completed successfully"
            
        case .tokenRotationFailure(let error):
            return "\(baseMessage): Token rotation failed: \(error.localizedDescription)"
        }
    }
    
    /// Sanitize URL for logging (remove sensitive data)
    private func sanitizeURLForLogging(_ url: String) -> String {
        // Remove query parameters that might contain sensitive data
        if let urlObj = URL(string: url) {
            var components = URLComponents(url: urlObj, resolvingAgainstBaseURL: false)
            components?.query = nil
            components?.fragment = nil
            return components?.url?.absoluteString ?? url
        }
        return url
    }
    
    /// Clean up old data to prevent memory leaks
    private func cleanupOldData() {
        // Reset event counts periodically
        if eventCounts.count > 1000 {
            eventCounts.removeAll()
        }
    }
    
    /// Get event statistics
    func getEventStats() -> [String: Any] {
        return queue.sync {
            return [
                "totalEvents": eventCounts.values.reduce(0, +),
                "eventTypes": eventCounts.count,
                "eventCounts": eventCounts,
                "lastCleanup": lastCleanup.timeIntervalSince1970
            ]
        }
    }
    
    /// Get events by type
    func getEventsByType() -> [String: Int] {
        return queue.sync {
            return eventCounts
        }
    }
    
    /// Get events by severity
    func getEventsBySeverity() -> [String: Int] {
        return queue.sync {
            var severityCounts: [String: Int] = [:]
            
            for (eventType, count) in eventCounts {
                let severity = getSeverityForEventType(eventType)
                severityCounts[severity, default: 0] += count
            }
            
            return severityCounts
        }
    }
    
    /// Get severity for event type
    private func getSeverityForEventType(_ eventType: String) -> String {
        switch eventType {
        case "AUTH_FAILURE", "AUTHZ_FAILURE", "MALICIOUS_PATTERN":
            return "HIGH"
        case "RATE_LIMIT":
            return "MEDIUM"
        case "CONFIG_UPDATE", "TOKEN_ROTATION_SUCCESS", "TOKEN_ROTATION_FAILURE":
            return "LOW"
        default:
            return "UNKNOWN"
        }
    }
    
    /// Clear all event data
    func clearEvents() {
        queue.sync(flags: .barrier) {
            eventCounts.removeAll()
            lastCleanup = Date()
        }
    }
    
    /// Export events for analysis
    func exportEvents() -> [String: Any] {
        return queue.sync {
            return [
                "timestamp": Date().timeIntervalSince1970,
                "config": [
                    "enabled": config.enabled,
                    "logSecurityEvents": config.logSecurityEvents,
                    "deploymentPhase": config.deploymentPhase.rawValue
                ],
                "statistics": [
                    "totalEvents": eventCounts.values.reduce(0, +),
                    "eventTypes": eventCounts.count,
                    "eventCounts": eventCounts,
                    "severityCounts": getEventsBySeverity()
                ]
            ]
        }
    }
}
