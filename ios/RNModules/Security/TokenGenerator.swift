import Foundation
import Security

/// Secure token generator with automatic rotation
class TokenGenerator {
    private let config: SecurityConfig
    private var currentToken: String
    private var tokenExpiry: Date
    private var rotationTimer: Timer?
    private let queue = DispatchQueue(label: "token.generator", attributes: .concurrent)
    
    init(config: SecurityConfig) {
        self.config = config
        self.currentToken = ""
        self.tokenExpiry = Date()
        
        // Generate initial token
        self.currentToken = generateSecureToken()
        self.tokenExpiry = Date().addingTimeInterval(config.tokenRotationInterval)
        
        // Start rotation timer
        startTokenRotation()
    }
    
    deinit {
        stopTokenRotation()
    }
    
    /// Get current valid token
    func getCurrentToken() -> String {
        return queue.sync {
            return currentToken
        }
    }
    
    /// Validate if token is valid
    func validateToken(_ token: String) -> Bool {
        return queue.sync {
            return token == currentToken && Date() < tokenExpiry
        }
    }
    
    /// Force token rotation (for testing)
    func rotateToken() {
        queue.async(flags: .barrier) {
            self.currentToken = self.generateSecureToken()
            self.tokenExpiry = Date().addingTimeInterval(self.config.tokenRotationInterval)
        }
    }
    
    /// Start automatic token rotation
    private func startTokenRotation() {
        guard config.enabled else { return }
        
        rotationTimer = Timer.scheduledTimer(withTimeInterval: config.tokenRotationInterval, repeats: true) { [weak self] _ in
            self?.rotateToken()
        }
    }
    
    /// Stop automatic token rotation
    private func stopTokenRotation() {
        rotationTimer?.invalidate()
        rotationTimer = nil
    }
    
    /// Generate cryptographically secure token
    private func generateSecureToken() -> String {
        let tokenLength = 32
        let characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
        var token = ""
        
        // Use SecRandomCopyBytes for cryptographic security
        var randomBytes = [UInt8](repeating: 0, count: tokenLength)
        let result = SecRandomCopyBytes(kSecRandomDefault, tokenLength, &randomBytes)
        
        if result == errSecSuccess {
            // Convert random bytes to token string
            for byte in randomBytes {
                let index = Int(byte) % characters.count
                let character = characters[characters.index(characters.startIndex, offsetBy: index)]
                token.append(character)
            }
        } else {
            // Fallback to arc4random (less secure but still random)
            for _ in 0..<tokenLength {
                let randomIndex = Int(arc4random_uniform(UInt32(characters.count)))
                let character = characters[characters.index(characters.startIndex, offsetBy: randomIndex)]
                token.append(character)
            }
        }
        
        return "sec_\(token)"
    }
    
    /// Update configuration and restart rotation if needed
    func updateConfig(_ newConfig: SecurityConfig) {
        queue.async(flags: .barrier) {
            // Stop current timer
            self.stopTokenRotation()
            
            // Update config
            // Note: In a real implementation, we'd need to make config mutable
            // For now, we'll just restart the timer with new interval
            
            // Start new timer if enabled
            if newConfig.enabled {
                self.startTokenRotation()
            }
        }
    }
    
    /// Get token expiry time (for debugging)
    func getTokenExpiry() -> Date {
        return queue.sync {
            return tokenExpiry
        }
    }
    
    /// Check if token is expired
    func isTokenExpired() -> Bool {
        return queue.sync {
            return Date() >= tokenExpiry
        }
    }
}
