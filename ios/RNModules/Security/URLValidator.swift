import Foundation

/// URL validation and sanitization
class URLValidator {
    private let config: SecurityConfig
    
    // Malicious patterns to detect
    private let maliciousPatterns = [
        #"\.\./"#,           // Directory traversal
        #"\.\.\\"#,          // Windows directory traversal
        #"<script"#,          // XSS attempts
        #"javascript:"#,     // JavaScript injection
        #"data:"#,           // Data URI injection
        #"vbscript:"#,       // VBScript injection
        #"onload="#,         // Event handler injection
        #"onerror="#,        // Event handler injection
        #"union\s+select"#,  // SQL injection
        #"drop\s+table"#,    // SQL injection
        #"insert\s+into"#,   // SQL injection
        #"delete\s+from"#,   // SQL injection
        #"exec\s*\("#,       // Command injection
        #"system\s*\("#,     // Command injection
        #"eval\s*\("#,       // Code injection
        #"base64"#,          // Base64 encoding (potential obfuscation)
        #"\\x[0-9a-fA-F]"#,  // Hex encoding
        #"%[0-9a-fA-F]{2}"#, // URL encoding
        #"\\u[0-9a-fA-F]{4}"# // Unicode encoding
    ]
    
    // Compiled regex patterns for performance
    private let compiledPatterns: [NSRegularExpression]
    
    init(config: SecurityConfig) {
        self.config = config
        
        // Compile regex patterns for better performance
        var patterns: [NSRegularExpression] = []
        for pattern in maliciousPatterns {
            do {
                let regex = try NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
                patterns.append(regex)
            } catch {
                print("Warning: Failed to compile regex pattern: \(pattern)")
            }
        }
        self.compiledPatterns = patterns
    }
    
    /// Validate URL against security rules
    func validateURL(_ url: URL) -> ValidationResult {
        // Check if security is enabled
        guard config.enabled else {
            return .allowed
        }
        
        // Check URL length
        if url.absoluteString.count > config.maxURLLength {
            return .blocked(reason: .urlTooLong)
        }
        
        // Check HTTPS enforcement
        if config.enforceHTTPS && url.scheme?.lowercased() != "https" {
            return .blocked(reason: .httpNotAllowed)
        }
        
        // Check domain whitelist
        if let host = url.host {
            if !isDomainAllowed(host) {
                return .blocked(reason: .domainNotWhitelisted)
            }
        } else {
            return .blocked(reason: .domainNotWhitelisted)
        }
        
        // Check file extension
        if !isExtensionAllowed(url.pathExtension) {
            return .blocked(reason: .extensionNotAllowed)
        }
        
        // Check for malicious patterns
        if let maliciousPattern = detectMaliciousPattern(url.absoluteString) {
            return .blocked(reason: .maliciousPattern)
        }
        
        return .allowed
    }
    
    /// Check if domain is in whitelist
    private func isDomainAllowed(_ domain: String) -> Bool {
        // Handle wildcard domains (e.g., *.example.com)
        for allowedDomain in config.allowedDomains {
            if allowedDomain.hasPrefix("*.") {
                let baseDomain = String(allowedDomain.dropFirst(2))
                if domain.hasSuffix(baseDomain) {
                    return true
                }
            } else if domain == allowedDomain {
                return true
            }
        }
        return false
    }
    
    /// Check if file extension is allowed
    private func isExtensionAllowed(_ extension: String) -> Bool {
        let lowercasedExtension = extension.lowercased()
        return config.allowedExtensions.contains { allowedExt in
            allowedExt.lowercased() == lowercasedExtension
        }
    }
    
    /// Detect malicious patterns in URL
    private func detectMaliciousPattern(_ url: String) -> String? {
        for regex in compiledPatterns {
            let range = NSRange(location: 0, length: url.utf16.count)
            if regex.firstMatch(in: url, options: [], range: range) != nil {
                return regex.pattern
            }
        }
        return nil
    }
    
    /// Sanitize URL by removing potentially dangerous components
    func sanitizeURL(_ url: URL) -> URL? {
        guard var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return nil
        }
        
        // Remove query parameters that might contain malicious content
        if let query = components.query {
            let sanitizedQuery = sanitizeQueryString(query)
            components.query = sanitizedQuery.isEmpty ? nil : sanitizedQuery
        }
        
        // Remove fragment (anchor) to prevent XSS
        components.fragment = nil
        
        // Ensure scheme is lowercase
        components.scheme = components.scheme?.lowercased()
        
        // Ensure host is lowercase
        components.host = components.host?.lowercased()
        
        return components.url
    }
    
    /// Sanitize query string by removing dangerous parameters
    private func sanitizeQueryString(_ query: String) -> String {
        let parameters = query.components(separatedBy: "&")
        var sanitizedParameters: [String] = []
        
        for parameter in parameters {
            let components = parameter.components(separatedBy: "=")
            if components.count == 2 {
                let key = components[0]
                let value = components[1]
                
                // Skip parameters that might contain malicious content
                if isParameterSafe(key: key, value: value) {
                    sanitizedParameters.append(parameter)
                }
            }
        }
        
        return sanitizedParameters.joined(separator: "&")
    }
    
    /// Check if query parameter is safe
    private func isParameterSafe(key: String, value: String) -> Bool {
        // Skip parameters with suspicious names
        let suspiciousKeys = ["script", "javascript", "vbscript", "onload", "onerror", "onclick"]
        if suspiciousKeys.contains(key.lowercased()) {
            return false
        }
        
        // Skip parameters with suspicious values
        if detectMaliciousPattern(value) != nil {
            return false
        }
        
        return true
    }
    
    /// Get validation statistics
    func getValidationStats() -> [String: Any] {
        return [
            "allowedDomains": config.allowedDomains.count,
            "allowedExtensions": config.allowedExtensions.count,
            "maliciousPatterns": maliciousPatterns.count,
            "compiledPatterns": compiledPatterns.count,
            "maxURLLength": config.maxURLLength,
            "enforceHTTPS": config.enforceHTTPS
        ]
    }
}
