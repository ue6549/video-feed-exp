import Foundation

/// Configuration for ProxySecurityManager
struct SecurityConfig {
    let enabled: Bool
    let allowedDomains: [String]
    let allowedExtensions: [String]
    let maxRequestsPerMinute: Int
    let tokenRotationInterval: TimeInterval
    let enforceHTTPS: Bool
    let maxURLLength: Int
    let logSecurityEvents: Bool
    let rateLimitConfig: RateLimitConfig
    let deploymentPhase: DeploymentPhase
    
    init(enabled: Bool = true,
         allowedDomains: [String] = [],
         allowedExtensions: [String] = [],
         maxRequestsPerMinute: Int = 600,
         tokenRotationInterval: TimeInterval = 300,
         enforceHTTPS: Bool = true,
         maxURLLength: Int = 2048,
         logSecurityEvents: Bool = true,
         rateLimitConfig: RateLimitConfig = RateLimitConfig(),
         deploymentPhase: DeploymentPhase = .monitoring) {
        self.enabled = enabled
        self.allowedDomains = allowedDomains
        self.allowedExtensions = allowedExtensions
        self.maxRequestsPerMinute = maxRequestsPerMinute
        self.tokenRotationInterval = tokenRotationInterval
        self.enforceHTTPS = enforceHTTPS
        self.maxURLLength = maxURLLength
        self.logSecurityEvents = logSecurityEvents
        self.rateLimitConfig = rateLimitConfig
        self.deploymentPhase = deploymentPhase
    }
    
    /// Create a copy with updated values
    func copy(enabled: Bool? = nil,
              allowedDomains: [String]? = nil,
              allowedExtensions: [String]? = nil,
              maxRequestsPerMinute: Int? = nil,
              tokenRotationInterval: TimeInterval? = nil,
              enforceHTTPS: Bool? = nil,
              maxURLLength: Int? = nil,
              logSecurityEvents: Bool? = nil,
              rateLimitConfig: RateLimitConfig? = nil,
              deploymentPhase: DeploymentPhase? = nil) -> SecurityConfig {
        return SecurityConfig(
            enabled: enabled ?? self.enabled,
            allowedDomains: allowedDomains ?? self.allowedDomains,
            allowedExtensions: allowedExtensions ?? self.allowedExtensions,
            maxRequestsPerMinute: maxRequestsPerMinute ?? self.maxRequestsPerMinute,
            tokenRotationInterval: tokenRotationInterval ?? self.tokenRotationInterval,
            enforceHTTPS: enforceHTTPS ?? self.enforceHTTPS,
            maxURLLength: maxURLLength ?? self.maxURLLength,
            logSecurityEvents: logSecurityEvents ?? self.logSecurityEvents,
            rateLimitConfig: rateLimitConfig ?? self.rateLimitConfig,
            deploymentPhase: deploymentPhase ?? self.deploymentPhase
        )
    }
}

/// Rate limiting configuration
struct RateLimitConfig {
    let capacity: Int
    let refillRate: Double
    
    init(capacity: Int = 100, refillRate: Double = 10.0) {
        self.capacity = capacity
        self.refillRate = refillRate
    }
}

/// Deployment phases for security
enum DeploymentPhase: String, CaseIterable {
    case monitoring = "monitoring"
    case soft = "soft"
    case full = "full"
}

/// Security validation result
enum ValidationResult {
    case allowed
    case blocked(reason: SecurityViolation)
}

/// Security violation types
enum SecurityViolation: String, CaseIterable {
    case invalidToken = "invalid_token"
    case domainNotWhitelisted = "domain_not_whitelisted"
    case extensionNotAllowed = "extension_not_allowed"
    case rateLimitExceeded = "rate_limit_exceeded"
    case maliciousPattern = "malicious_pattern"
    case httpNotAllowed = "http_not_allowed"
    case urlTooLong = "url_too_long"
    
    var description: String {
        switch self {
        case .invalidToken:
            return "Invalid or missing authentication token"
        case .domainNotWhitelisted:
            return "Domain not in whitelist"
        case .extensionNotAllowed:
            return "File extension not allowed"
        case .rateLimitExceeded:
            return "Rate limit exceeded"
        case .maliciousPattern:
            return "Malicious pattern detected in URL"
        case .httpNotAllowed:
            return "HTTP not allowed, HTTPS required"
        case .urlTooLong:
            return "URL exceeds maximum length"
        }
    }
}

/// Security event types for logging
enum SecurityEvent {
    case authenticationFailure(token: String?)
    case authorizationFailure(domain: String, extension: String?)
    case rateLimitExceeded(domain: String, currentRate: Double)
    case maliciousPatternDetected(url: String, pattern: String)
    case configurationUpdate(oldConfig: SecurityConfig, newConfig: SecurityConfig)
    case tokenRotationSuccess
    case tokenRotationFailure(error: Error)
    
    var eventType: String {
        switch self {
        case .authenticationFailure:
            return "AUTH_FAILURE"
        case .authorizationFailure:
            return "AUTHZ_FAILURE"
        case .rateLimitExceeded:
            return "RATE_LIMIT"
        case .maliciousPatternDetected:
            return "MALICIOUS_PATTERN"
        case .configurationUpdate:
            return "CONFIG_UPDATE"
        case .tokenRotationSuccess:
            return "TOKEN_ROTATION_SUCCESS"
        case .tokenRotationFailure:
            return "TOKEN_ROTATION_FAILURE"
        }
    }
    
    var severity: String {
        switch self {
        case .authenticationFailure, .authorizationFailure, .maliciousPatternDetected:
            return "HIGH"
        case .rateLimitExceeded:
            return "MEDIUM"
        case .configurationUpdate, .tokenRotationSuccess, .tokenRotationFailure:
            return "LOW"
        }
    }
}
