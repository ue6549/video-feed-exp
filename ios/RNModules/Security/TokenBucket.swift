import Foundation

/// Token bucket rate limiter implementation
class TokenBucket {
    private let capacity: Int
    private let refillRate: Double
    private var tokens: Int
    private var lastRefill: Date
    private let queue = DispatchQueue(label: "token.bucket", attributes: .concurrent)
    
    init(capacity: Int, refillRate: Double) {
        self.capacity = capacity
        self.refillRate = refillRate
        self.tokens = capacity
        self.lastRefill = Date()
    }
    
    /// Try to consume tokens from the bucket
    /// - Parameter tokens: Number of tokens to consume (default: 1)
    /// - Returns: true if tokens were consumed, false if bucket is empty
    func tryConsume(tokens: Int = 1) -> Bool {
        return queue.sync(flags: .barrier) {
            refill()
            
            if self.tokens >= tokens {
                self.tokens -= tokens
                return true
            }
            return false
        }
    }
    
    /// Get current token count (for monitoring)
    func getTokenCount() -> Int {
        return queue.sync {
            refill()
            return tokens
        }
    }
    
    /// Get bucket capacity
    func getCapacity() -> Int {
        return capacity
    }
    
    /// Get refill rate
    func getRefillRate() -> Double {
        return refillRate
    }
    
    /// Check if bucket has enough tokens without consuming them
    func hasTokens(_ requiredTokens: Int = 1) -> Bool {
        return queue.sync {
            refill()
            return tokens >= requiredTokens
        }
    }
    
    /// Get time until next token is available
    func getTimeUntilNextToken() -> TimeInterval {
        return queue.sync {
            refill()
            if tokens > 0 {
                return 0
            }
            return 1.0 / refillRate
        }
    }
    
    /// Reset bucket to full capacity
    func reset() {
        queue.sync(flags: .barrier) {
            tokens = capacity
            lastRefill = Date()
        }
    }
    
    /// Refill tokens based on time elapsed
    private func refill() {
        let now = Date()
        let timePassed = now.timeIntervalSince(lastRefill)
        
        if timePassed > 0 {
            let tokensToAdd = Int(timePassed * refillRate)
            if tokensToAdd > 0 {
                tokens = min(capacity, tokens + tokensToAdd)
                lastRefill = now
            }
        }
    }
    
    /// Get bucket statistics
    func getStats() -> [String: Any] {
        return queue.sync {
            refill()
            return [
                "capacity": capacity,
                "refillRate": refillRate,
                "currentTokens": tokens,
                "lastRefill": lastRefill.timeIntervalSince1970,
                "utilization": Double(capacity - tokens) / Double(capacity)
            ]
        }
    }
}

/// Rate limiter manager for multiple domains
class RateLimiterManager {
    private var limiters: [String: TokenBucket] = [:]
    private let queue = DispatchQueue(label: "rate.limiter.manager", attributes: .concurrent)
    private let config: SecurityConfig
    
    init(config: SecurityConfig) {
        self.config = config
    }
    
    /// Get or create rate limiter for domain
    private func getLimiter(for domain: String) -> TokenBucket {
        return queue.sync(flags: .barrier) {
            if let existingLimiter = limiters[domain] {
                return existingLimiter
            }
            
            let newLimiter = TokenBucket(
                capacity: config.rateLimitConfig.capacity,
                refillRate: config.rateLimitConfig.refillRate
            )
            limiters[domain] = newLimiter
            return newLimiter
        }
    }
    
    /// Check if request is allowed for domain
    func isRequestAllowed(for domain: String) -> Bool {
        let limiter = getLimiter(for: domain)
        return limiter.tryConsume()
    }
    
    /// Record request for domain (for monitoring)
    func recordRequest(for domain: String) {
        _ = getLimiter(for: domain)
    }
    
    /// Get rate limit status for domain
    func getRateLimitStatus(for domain: String) -> [String: Any] {
        let limiter = getLimiter(for: domain)
        return limiter.getStats()
    }
    
    /// Get all rate limiter statistics
    func getAllStats() -> [String: [String: Any]] {
        return queue.sync {
            var stats: [String: [String: Any]] = [:]
            for (domain, limiter) in limiters {
                stats[domain] = limiter.getStats()
            }
            return stats
        }
    }
    
    /// Clean up old limiters (for memory management)
    func cleanupOldLimiters(maxAge: TimeInterval = 3600) {
        queue.sync(flags: .barrier) {
            let now = Date()
            let domainsToRemove = limiters.compactMap { (domain, limiter) -> String? in
                let stats = limiter.getStats()
                if let lastRefill = stats["lastRefill"] as? TimeInterval {
                    let age = now.timeIntervalSince1970 - lastRefill
                    return age > maxAge ? domain : nil
                }
                return nil
            }
            
            for domain in domainsToRemove {
                limiters.removeValue(forKey: domain)
            }
        }
    }
    
    /// Update configuration for all limiters
    func updateConfig(_ newConfig: SecurityConfig) {
        queue.sync(flags: .barrier) {
            // Update existing limiters
            for (_, limiter) in limiters {
                // Note: In a real implementation, we'd need to make TokenBucket configurable
                // For now, we'll create new limiters as needed
            }
            
            // Update config
            // Note: We'd need to make config mutable or recreate the manager
        }
    }
}
