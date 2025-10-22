import Foundation

/// Main security manager for proxy request validation
class ProxySecurityManager {
    private let config: SecurityConfig
    private let tokenGenerator: TokenGenerator
    private let urlValidator: URLValidator
    private let rateLimiter: RateLimiterManager
    private let eventLogger: SecurityEventLogger
    private let queue = DispatchQueue(label: "security.manager", attributes: .concurrent)
    
    init(config: SecurityConfig) {
        self.config = config
        self.tokenGenerator = TokenGenerator(config: config)
        self.urlValidator = URLValidator(config: config)
        self.rateLimiter = RateLimiterManager(config: config)
        self.eventLogger = SecurityEventLogger(config: config)
    }
    
    /// Get current authentication token
    func getAuthToken() -> String {
        return tokenGenerator.getCurrentToken()
    }
    
    /// Validate authentication token
    func validateToken(_ token: String) -> Bool {
        let isValid = tokenGenerator.validateToken(token)
        
        if !isValid {
            eventLogger.logEvent(.authenticationFailure(token: token))
        }
        
        return isValid
    }
    
    /// Validate complete request
    func validateRequest(url: URL, headers: [String: String]) -> ValidationResult {
        // Check if security is enabled
        guard config.enabled else {
            return .allowed
        }
        
        // Validate authentication token
        guard let authToken = headers["X-Cache-Auth"] else {
            eventLogger.logEvent(.authenticationFailure(token: nil))
            return .blocked(reason: .invalidToken)
        }
        
        guard validateToken(authToken) else {
            return .blocked(reason: .invalidToken)
        }
        
        // Validate URL
        let urlValidationResult = urlValidator.validateURL(url)
        if case .blocked(let reason) = urlValidationResult {
            // Log authorization failure
            if reason == .domainNotWhitelisted {
                eventLogger.logEvent(.authorizationFailure(domain: url.host ?? "unknown", extension: nil))
            } else if reason == .extensionNotAllowed {
                eventLogger.logEvent(.authorizationFailure(domain: url.host ?? "unknown", extension: url.pathExtension))
            } else if reason == .maliciousPattern {
                eventLogger.logEvent(.maliciousPatternDetected(url: url.absoluteString, pattern: "unknown"))
            }
            return urlValidationResult
        }
        
        // Check rate limiting
        guard let host = url.host else {
            return .blocked(reason: .domainNotWhitelisted)
        }
        
        guard rateLimiter.isRequestAllowed(for: host) else {
            let currentRate = getCurrentRequestRate(for: host)
            eventLogger.logEvent(.rateLimitExceeded(domain: host, currentRate: currentRate))
            return .blocked(reason: .rateLimitExceeded)
        }
        
        // Record request for monitoring
        rateLimiter.recordRequest(for: host)
        
        return .allowed
    }
    
    /// Check if request is allowed (convenience method)
    func isRequestAllowed(url: URL, headers: [String: String]) -> Bool {
        switch validateRequest(url: url, headers: headers) {
        case .allowed:
            return true
        case .blocked:
            return false
        }
    }
    
    /// Get current request rate for domain
    private func getCurrentRequestRate(for domain: String) -> Double {
        let stats = rateLimiter.getRateLimitStatus(for: domain)
        if let refillRate = stats["refillRate"] as? Double {
            return refillRate
        }
        return 0.0
    }
    
    /// Update configuration
    func updateConfig(_ newConfig: SecurityConfig) {
        queue.async(flags: .barrier) {
            // Log configuration update
            self.eventLogger.logEvent(.configurationUpdate(oldConfig: self.config, newConfig: newConfig))
            
            // Update components
            self.tokenGenerator.updateConfig(newConfig)
            self.rateLimiter.updateConfig(newConfig)
            
            // Note: In a real implementation, we'd need to make config mutable
            // For now, we'll create a new manager instance
        }
    }
    
    /// Get security statistics
    func getSecurityStats() -> [String: Any] {
        return queue.sync {
            return [
                "config": [
                    "enabled": config.enabled,
                    "allowedDomains": config.allowedDomains.count,
                    "allowedExtensions": config.allowedExtensions.count,
                    "maxRequestsPerMinute": config.maxRequestsPerMinute,
                    "tokenRotationInterval": config.tokenRotationInterval,
                    "enforceHTTPS": config.enforceHTTPS,
                    "maxURLLength": config.maxURLLength,
                    "deploymentPhase": config.deploymentPhase.rawValue
                ],
                "tokenGenerator": [
                    "currentToken": getAuthToken().prefix(8) + "...",
                    "tokenExpiry": tokenGenerator.getTokenExpiry().timeIntervalSince1970,
                    "isExpired": tokenGenerator.isTokenExpired()
                ],
                "urlValidator": urlValidator.getValidationStats(),
                "rateLimiter": rateLimiter.getAllStats(),
                "eventLogger": eventLogger.getEventStats()
            ]
        }
    }
    
    /// Get rate limit status for domain
    func getRateLimitStatus(for domain: String) -> [String: Any] {
        return rateLimiter.getRateLimitStatus(for: domain)
    }
    
    /// Get all rate limit statistics
    func getAllRateLimitStats() -> [String: [String: Any]] {
        return rateLimiter.getAllStats()
    }
    
    /// Get security events by type
    func getSecurityEventsByType() -> [String: Int] {
        return eventLogger.getEventsByType()
    }
    
    /// Get security events by severity
    func getSecurityEventsBySeverity() -> [String: Int] {
        return eventLogger.getEventsBySeverity()
    }
    
    /// Clear all security data
    func clearSecurityData() {
        queue.async(flags: .barrier) {
            self.eventLogger.clearEvents()
            self.rateLimiter.cleanupOldLimiters()
        }
    }
    
    /// Export security data for analysis
    func exportSecurityData() -> [String: Any] {
        return queue.sync {
            return [
                "timestamp": Date().timeIntervalSince1970,
                "securityStats": getSecurityStats(),
                "events": eventLogger.exportEvents()
            ]
        }
    }
    
    /// Force token rotation (for testing)
    func forceTokenRotation() {
        tokenGenerator.rotateToken()
        eventLogger.logEvent(.tokenRotationSuccess)
    }
    
    /// Check if security is enabled
    func isSecurityEnabled() -> Bool {
        return config.enabled
    }
    
    /// Get deployment phase
    func getDeploymentPhase() -> DeploymentPhase {
        return config.deploymentPhase
    }
    
    /// Check if blocking is enforced based on deployment phase
    func shouldBlockRequests() -> Bool {
        switch config.deploymentPhase {
        case .monitoring:
            return false // Log only, don't block
        case .soft:
            return true // Block obvious violations
        case .full:
            return true // Block all violations
        }
    }
}
