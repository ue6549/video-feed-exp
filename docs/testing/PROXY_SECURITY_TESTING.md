# Proxy Security Testing Guide

## Test Environment Setup

### Xcode Configuration

#### 1. Test Target Setup
```swift
// Create test target: VideoFeedAppSecurityTests
// Add to existing Xcode project
// Link with main app target
```

#### 2. Test Dependencies
```swift
// Add to test target
import XCTest
import VideoFeedApp
@testable import VideoFeedApp
```

#### 3. Test Configuration
```swift
// Test-specific configuration
let testConfig = SecurityConfig(
    enabled: true,
    allowedDomains: ["test-cdn.com", "example.com"],
    allowedExtensions: [".m3u8", ".ts", ".m4s"],
    maxRequestsPerMinute: 60,
    tokenRotationInterval: 60,
    enforceHTTPS: true,
    maxURLLength: 1024,
    logSecurityEvents: true,
    rateLimitConfig: RateLimitConfig(capacity: 10, refillRate: 1),
    deploymentPhase: .monitoring
)
```

### Test Data Preparation

#### 1. Valid Test URLs
```swift
let validURLs = [
    "https://test-cdn.com/video1.m3u8",
    "https://test-cdn.com/segment1.ts",
    "https://example.com/playlist.m3u8"
]
```

#### 2. Invalid Test URLs
```swift
let invalidURLs = [
    "http://test-cdn.com/video.m3u8",           // HTTP not HTTPS
    "https://malicious.com/video.m3u8",         // Non-whitelisted domain
    "https://test-cdn.com/video.exe",           // Invalid extension
    "https://test-cdn.com/../../../etc/passwd", // Directory traversal
    "https://test-cdn.com/video.m3u8?<script>", // XSS attempt
    String(repeating: "a", count: 3000)         // URL too long
]
```

#### 3. Mock Security Scenarios
```swift
// Mock token generator for predictable testing
class MockTokenGenerator: TokenGenerator {
    var currentToken = "test-token-123"
    var shouldRotate = false
    
    func generateToken() -> String {
        if shouldRotate {
            currentToken = "test-token-\(Date().timeIntervalSince1970)"
        }
        return currentToken
    }
}

// Mock rate limiter for controlled testing
class MockTokenBucket: TokenBucket {
    var shouldAllow = true
    var consumeCallCount = 0
    
    override func tryConsume(tokens: Int = 1) -> Bool {
        consumeCallCount += 1
        return shouldAllow
    }
}
```

## Authentication Tests

### TC-SEC-001: Valid Token Test

**Description**: Verify that requests with valid authentication tokens are allowed.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Generate valid authentication token
3. Create request with valid token in headers
4. Call validateRequest with valid URL and headers
5. Verify result is ValidationResult.allowed

**Expected Result**: Request should be allowed.

**Test Implementation**:
```swift
func testValidTokenAllowsRequest() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    XCTAssertEqual(result, .allowed)
}
```

### TC-SEC-002: Invalid Token Test

**Description**: Verify that requests with invalid authentication tokens are blocked.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Create request with invalid token in headers
3. Call validateRequest with valid URL and invalid headers
4. Verify result is ValidationResult.blocked with reason invalidToken

**Expected Result**: Request should be blocked with invalidToken violation.

**Test Implementation**:
```swift
func testInvalidTokenBlocksRequest() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let headers = ["X-Cache-Auth": "invalid-token"]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    if case .blocked(let reason) = result {
        XCTAssertEqual(reason, .invalidToken)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

### TC-SEC-003: Missing Token Test

**Description**: Verify that requests without authentication tokens are blocked.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Create request without authentication headers
3. Call validateRequest with valid URL and empty headers
4. Verify result is ValidationResult.blocked with reason invalidToken

**Expected Result**: Request should be blocked with invalidToken violation.

**Test Implementation**:
```swift
func testMissingTokenBlocksRequest() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let headers: [String: String] = [:]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    if case .blocked(let reason) = result {
        XCTAssertEqual(reason, .invalidToken)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

### TC-SEC-004: Token Rotation Test

**Description**: Verify that token rotation works correctly and old tokens are invalidated.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Generate initial token
3. Wait for token rotation interval
4. Generate new token
5. Verify old token is invalid and new token is valid

**Expected Result**: Old token should be invalid, new token should be valid.

**Test Implementation**:
```swift
func testTokenRotationInvalidatesOldTokens() {
    // Given
    let config = testConfig.copy(tokenRotationInterval: 1) // 1 second
    let manager = ProxySecurityManager(config: config)
    let oldToken = manager.getAuthToken()
    
    // When
    sleep(2) // Wait for rotation
    let newToken = manager.getAuthToken()
    
    // Then
    XCTAssertNotEqual(oldToken, newToken)
    XCTAssertFalse(manager.validateToken(oldToken))
    XCTAssertTrue(manager.validateToken(newToken))
}
```

## URL Validation Tests

### TC-SEC-101: Whitelisted Domain Test

**Description**: Verify that requests to whitelisted domains are allowed.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Create request with valid token to whitelisted domain
3. Call validateRequest
4. Verify result is ValidationResult.allowed

**Expected Result**: Request should be allowed.

**Test Implementation**:
```swift
func testWhitelistedDomainAllowed() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    XCTAssertEqual(result, .allowed)
}
```

### TC-SEC-102: Non-Whitelisted Domain Test

**Description**: Verify that requests to non-whitelisted domains are blocked.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Create request with valid token to non-whitelisted domain
3. Call validateRequest
4. Verify result is ValidationResult.blocked with reason domainNotWhitelisted

**Expected Result**: Request should be blocked with domainNotWhitelisted violation.

**Test Implementation**:
```swift
func testNonWhitelistedDomainBlocked() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://malicious.com/video.m3u8")!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    if case .blocked(let reason) = result {
        XCTAssertEqual(reason, .domainNotWhitelisted)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

### TC-SEC-103: HTTP URL Rejection Test

**Description**: Verify that HTTP URLs are rejected when HTTPS enforcement is enabled.

**Test Steps**:
1. Initialize ProxySecurityManager with HTTPS enforcement enabled
2. Create request with valid token to HTTP URL
3. Call validateRequest
4. Verify result is ValidationResult.blocked with reason httpNotAllowed

**Expected Result**: Request should be blocked with httpNotAllowed violation.

**Test Implementation**:
```swift
func testHTTPURLRejected() {
    // Given
    let config = testConfig.copy(enforceHTTPS: true)
    let manager = ProxySecurityManager(config: config)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "http://test-cdn.com/video.m3u8")!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    if case .blocked(let reason) = result {
        XCTAssertEqual(reason, .httpNotAllowed)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

### TC-SEC-104: Malicious Pattern Test

**Description**: Verify that URLs with malicious patterns are blocked.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Create request with valid token to URL containing malicious patterns
3. Call validateRequest
4. Verify result is ValidationResult.blocked with reason maliciousPattern

**Expected Result**: Request should be blocked with maliciousPattern violation.

**Test Implementation**:
```swift
func testMaliciousPatternBlocked() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let maliciousURLs = [
        "https://test-cdn.com/../../../etc/passwd",
        "https://test-cdn.com/video.m3u8?<script>alert('xss')</script>",
        "https://test-cdn.com/video.m3u8'; DROP TABLE users; --"
    ]
    
    for urlString in maliciousURLs {
        // When
        let url = URL(string: urlString)!
        let result = manager.validateRequest(url: url, headers: headers)
        
        // Then
        if case .blocked(let reason) = result {
            XCTAssertEqual(reason, .maliciousPattern)
        } else {
            XCTFail("Expected blocked result for URL: \(urlString)")
        }
    }
}
```

### TC-SEC-105: Directory Traversal Test

**Description**: Verify that directory traversal attempts are blocked.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Create request with valid token to URL with directory traversal patterns
3. Call validateRequest
4. Verify result is ValidationResult.blocked with reason maliciousPattern

**Expected Result**: Request should be blocked with maliciousPattern violation.

**Test Implementation**:
```swift
func testDirectoryTraversalBlocked() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let traversalURLs = [
        "https://test-cdn.com/../../../etc/passwd",
        "https://test-cdn.com/..\\..\\..\\windows\\system32\\config\\sam",
        "https://test-cdn.com/%2e%2e/%2e%2e/%2e%2e/etc/passwd"
    ]
    
    for urlString in traversalURLs {
        // When
        let url = URL(string: urlString)!
        let result = manager.validateRequest(url: url, headers: headers)
        
        // Then
        if case .blocked(let reason) = result {
            XCTAssertEqual(reason, .maliciousPattern)
        } else {
            XCTFail("Expected blocked result for URL: \(urlString)")
        }
    }
}
```

### TC-SEC-106: URL Length Limit Test

**Description**: Verify that URLs exceeding length limits are blocked.

**Test Steps**:
1. Initialize ProxySecurityManager with URL length limit
2. Create request with valid token to URL exceeding length limit
3. Call validateRequest
4. Verify result is ValidationResult.blocked with reason urlTooLong

**Expected Result**: Request should be blocked with urlTooLong violation.

**Test Implementation**:
```swift
func testURLLengthLimitEnforced() {
    // Given
    let config = testConfig.copy(maxURLLength: 100)
    let manager = ProxySecurityManager(config: config)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let longURL = "https://test-cdn.com/" + String(repeating: "a", count: 200) + ".m3u8"
    let url = URL(string: longURL)!
    
    // When
    let result = manager.validateRequest(url: url, headers: headers)
    
    // Then
    if case .blocked(let reason) = result {
        XCTAssertEqual(reason, .urlTooLong)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

## Rate Limiting Tests

### TC-SEC-201: Burst Request Test

**Description**: Verify that burst requests within capacity are allowed.

**Test Steps**:
1. Initialize ProxySecurityManager with rate limiting enabled
2. Send burst of requests within token bucket capacity
3. Verify all requests are allowed
4. Send additional request exceeding capacity
5. Verify excess request is blocked

**Expected Result**: Burst requests within capacity should be allowed, excess should be blocked.

**Test Implementation**:
```swift
func testBurstRequestsWithinCapacityAllowed() {
    // Given
    let config = testConfig.copy(rateLimitConfig: RateLimitConfig(capacity: 5, refillRate: 1))
    let manager = ProxySecurityManager(config: config)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When - Send burst of 5 requests (within capacity)
    var results: [ValidationResult] = []
    for _ in 0..<5 {
        let result = manager.validateRequest(url: url, headers: headers)
        results.append(result)
    }
    
    // Then - All should be allowed
    for result in results {
        XCTAssertEqual(result, .allowed)
    }
    
    // When - Send one more request (exceeds capacity)
    let excessResult = manager.validateRequest(url: url, headers: headers)
    
    // Then - Should be blocked
    if case .blocked(let reason) = excessResult {
        XCTAssertEqual(reason, .rateLimitExceeded)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

### TC-SEC-202: Sustained Request Test

**Description**: Verify that sustained requests are rate limited correctly.

**Test Steps**:
1. Initialize ProxySecurityManager with rate limiting enabled
2. Send requests at sustained rate
3. Verify requests are allowed at refill rate
4. Send requests faster than refill rate
5. Verify excess requests are blocked

**Expected Result**: Requests at refill rate should be allowed, faster requests should be blocked.

**Test Implementation**:
```swift
func testSustainedRequestsRateLimited() {
    // Given
    let config = testConfig.copy(rateLimitConfig: RateLimitConfig(capacity: 10, refillRate: 2))
    let manager = ProxySecurityManager(config: config)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When - Send requests at refill rate (2 per second)
    var allowedCount = 0
    var blockedCount = 0
    
    for i in 0..<20 {
        let result = manager.validateRequest(url: url, headers: headers)
        if result == .allowed {
            allowedCount += 1
        } else if case .blocked(let reason) = result, reason == .rateLimitExceeded {
            blockedCount += 1
        }
        
        if i % 2 == 1 { // Every 2 requests, wait 1 second
            sleep(1)
        }
    }
    
    // Then - Should have reasonable distribution
    XCTAssertGreaterThan(allowedCount, 0)
    XCTAssertGreaterThan(blockedCount, 0)
}
```

### TC-SEC-203: Rate Limit Recovery Test

**Description**: Verify that rate limits recover after waiting.

**Test Steps**:
1. Initialize ProxySecurityManager with rate limiting enabled
2. Exhaust token bucket capacity
3. Wait for token bucket to refill
4. Send new request
5. Verify request is allowed

**Expected Result**: Request should be allowed after refill period.

**Test Implementation**:
```swift
func testRateLimitRecovery() {
    // Given
    let config = testConfig.copy(rateLimitConfig: RateLimitConfig(capacity: 2, refillRate: 1))
    let manager = ProxySecurityManager(config: config)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When - Exhaust capacity
    for _ in 0..<2 {
        let result = manager.validateRequest(url: url, headers: headers)
        XCTAssertEqual(result, .allowed)
    }
    
    // Verify next request is blocked
    let blockedResult = manager.validateRequest(url: url, headers: headers)
    if case .blocked(let reason) = blockedResult {
        XCTAssertEqual(reason, .rateLimitExceeded)
    } else {
        XCTFail("Expected blocked result")
    }
    
    // Wait for refill
    sleep(2)
    
    // Then - Should be allowed again
    let allowedResult = manager.validateRequest(url: url, headers: headers)
    XCTAssertEqual(allowedResult, .allowed)
}
```

### TC-SEC-204: Per-Domain Limit Test

**Description**: Verify that rate limits are applied per domain.

**Test Steps**:
1. Initialize ProxySecurityManager with rate limiting enabled
2. Exhaust rate limit for one domain
3. Send request to different domain
4. Verify request to different domain is allowed

**Expected Result**: Rate limits should be per-domain, not global.

**Test Implementation**:
```swift
func testPerDomainRateLimiting() {
    // Given
    let config = testConfig.copy(rateLimitConfig: RateLimitConfig(capacity: 2, refillRate: 1))
    let manager = ProxySecurityManager(config: config)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    
    // When - Exhaust limit for domain1
    let domain1URL = URL(string: "https://test-cdn.com/video.m3u8")!
    for _ in 0..<2 {
        let result = manager.validateRequest(url: domain1URL, headers: headers)
        XCTAssertEqual(result, .allowed)
    }
    
    // Verify domain1 is blocked
    let blockedResult = manager.validateRequest(url: domain1URL, headers: headers)
    if case .blocked(let reason) = blockedResult {
        XCTAssertEqual(reason, .rateLimitExceeded)
    } else {
        XCTFail("Expected blocked result")
    }
    
    // Then - Domain2 should still be allowed
    let domain2URL = URL(string: "https://example.com/video.m3u8")!
    let allowedResult = manager.validateRequest(url: domain2URL, headers: headers)
    XCTAssertEqual(allowedResult, .allowed)
}
```

## Performance Tests

### TC-PERF-001: Validation Overhead Test

**Description**: Verify that validation overhead is less than 1ms per request.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Measure time for 1000 validation requests
3. Calculate average validation time
4. Verify average time is less than 1ms

**Expected Result**: Average validation time should be less than 1ms.

**Test Implementation**:
```swift
func testValidationOverheadUnder1ms() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When
    let startTime = CFAbsoluteTimeGetCurrent()
    for _ in 0..<1000 {
        _ = manager.validateRequest(url: url, headers: headers)
    }
    let endTime = CFAbsoluteTimeGetCurrent()
    
    // Then
    let totalTime = endTime - startTime
    let averageTime = totalTime / 1000.0
    XCTAssertLessThan(averageTime, 0.001) // Less than 1ms
}
```

### TC-PERF-002: Memory Usage Test

**Description**: Verify that memory usage is reasonable and doesn't grow unbounded.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Measure initial memory usage
3. Perform 10000 validation requests
4. Measure final memory usage
5. Verify memory growth is reasonable

**Expected Result**: Memory usage should be stable and reasonable.

**Test Implementation**:
```swift
func testMemoryUsageStable() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When
    let initialMemory = getMemoryUsage()
    for _ in 0..<10000 {
        _ = manager.validateRequest(url: url, headers: headers)
    }
    let finalMemory = getMemoryUsage()
    
    // Then
    let memoryGrowth = finalMemory - initialMemory
    XCTAssertLessThan(memoryGrowth, 10 * 1024 * 1024) // Less than 10MB
}

private func getMemoryUsage() -> UInt64 {
    var info = mach_task_basic_info()
    var count = mach_msg_type_number_t(MemoryLayout<mach_task_basic_info>.size)/4
    
    let kerr: kern_return_t = withUnsafeMutablePointer(to: &info) {
        $0.withMemoryRebound(to: integer_t.self, capacity: 1) {
            task_info(mach_task_self_,
                     task_flavor_t(MACH_TASK_BASIC_INFO),
                     $0,
                     &count)
        }
    }
    
    if kerr == KERN_SUCCESS {
        return info.resident_size
    } else {
        return 0
    }
}
```

### TC-PERF-003: Video Playback Impact Test

**Description**: Verify that security validation doesn't impact video playback performance.

**Test Steps**:
1. Initialize ProxySecurityManager with test config
2. Measure video playback startup time without security
3. Measure video playback startup time with security
4. Compare performance impact
5. Verify impact is minimal

**Expected Result**: Security validation should have minimal impact on video playback.

**Test Implementation**:
```swift
func testVideoPlaybackImpactMinimal() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // When - Measure without security
    let startTime1 = CFAbsoluteTimeGetCurrent()
    for _ in 0..<100 {
        // Simulate video playback request
        _ = url.absoluteString
    }
    let endTime1 = CFAbsoluteTimeGetCurrent()
    let timeWithoutSecurity = endTime1 - startTime1
    
    // When - Measure with security
    let startTime2 = CFAbsoluteTimeGetCurrent()
    for _ in 0..<100 {
        _ = manager.validateRequest(url: url, headers: headers)
    }
    let endTime2 = CFAbsoluteTimeGetCurrent()
    let timeWithSecurity = endTime2 - startTime2
    
    // Then
    let overhead = timeWithSecurity - timeWithoutSecurity
    let overheadPercentage = (overhead / timeWithoutSecurity) * 100
    XCTAssertLessThan(overheadPercentage, 10) // Less than 10% overhead
}
```

## Integration Tests

### TC-INT-001: End-to-End Valid Request

**Description**: Verify complete end-to-end flow for valid requests.

**Test Steps**:
1. Initialize complete system with security enabled
2. Create valid video request
3. Process request through security manager
4. Verify request reaches KTVHTTPCache
5. Verify video plays successfully

**Expected Result**: Valid requests should flow through system successfully.

**Test Implementation**:
```swift
func testEndToEndValidRequest() {
    // Given
    let cacheManager = CacheManager.shared
    let securityConfig = testConfig
    cacheManager.setupCache(with: securityConfig)
    
    let videoURL = "https://test-cdn.com/video.m3u8"
    
    // When
    let cachedURL = cacheManager.getCachedURL(videoURL)
    
    // Then
    XCTAssertNotNil(cachedURL)
    XCTAssertTrue(cachedURL!.contains("localhost"))
    
    // Verify video can be played
    let player = AVPlayer(url: URL(string: cachedURL!)!)
    XCTAssertNotNil(player)
}
```

### TC-INT-002: Security Failure Handling

**Description**: Verify that security failures are handled gracefully.

**Test Steps**:
1. Initialize complete system with security enabled
2. Create invalid video request
3. Process request through security manager
4. Verify request is blocked
5. Verify appropriate error handling

**Expected Result**: Invalid requests should be blocked with appropriate error handling.

**Test Implementation**:
```swift
func testSecurityFailureHandling() {
    // Given
    let cacheManager = CacheManager.shared
    let securityConfig = testConfig
    cacheManager.setupCache(with: securityConfig)
    
    let invalidURL = "https://malicious.com/video.m3u8"
    
    // When
    let cachedURL = cacheManager.getCachedURL(invalidURL)
    
    // Then
    XCTAssertNil(cachedURL)
    
    // Verify error is logged
    // (Implementation depends on logging system)
}
```

### TC-INT-003: Config Update Test

**Description**: Verify that configuration updates take effect immediately.

**Test Steps**:
1. Initialize system with initial configuration
2. Update configuration with new settings
3. Verify new settings take effect
4. Test with requests that should be affected by new settings

**Expected Result**: Configuration updates should take effect immediately.

**Test Implementation**:
```swift
func testConfigUpdateTakesEffect() {
    // Given
    let manager = ProxySecurityManager(config: testConfig)
    let token = manager.getAuthToken()
    let headers = ["X-Cache-Auth": token]
    let url = URL(string: "https://test-cdn.com/video.m3u8")!
    
    // Initial request should be allowed
    let initialResult = manager.validateRequest(url: url, headers: headers)
    XCTAssertEqual(initialResult, .allowed)
    
    // When - Update config to block this domain
    let newConfig = testConfig.copy(allowedDomains: ["other-domain.com"])
    manager.updateConfig(newConfig)
    
    // Then - Same request should now be blocked
    let updatedResult = manager.validateRequest(url: url, headers: headers)
    if case .blocked(let reason) = updatedResult {
        XCTAssertEqual(reason, .domainNotWhitelisted)
    } else {
        XCTFail("Expected blocked result")
    }
}
```

## Security Audit Checklist

### Authentication
- [ ] All requests require valid authentication tokens
- [ ] Token rotation works correctly
- [ ] Invalid tokens are rejected
- [ ] Missing tokens are rejected
- [ ] Token generation is cryptographically secure

### Authorization
- [ ] Domain whitelist is enforced
- [ ] Extension whitelist is enforced
- [ ] Non-whitelisted domains are blocked
- [ ] Non-whitelisted extensions are blocked
- [ ] Configuration updates take effect immediately

### Rate Limiting
- [ ] Rate limits are enforced per domain
- [ ] Burst requests within capacity are allowed
- [ ] Sustained requests are rate limited
- [ ] Rate limits recover after waiting
- [ ] Different domains have independent limits

### Input Validation
- [ ] HTTPS enforcement works
- [ ] Malicious patterns are detected
- [ ] Directory traversal is prevented
- [ ] URL length limits are enforced
- [ ] XSS attempts are blocked

### Performance
- [ ] Validation overhead is under 1ms
- [ ] Memory usage is stable
- [ ] Video playback impact is minimal
- [ ] No memory leaks detected
- [ ] CPU usage is reasonable

### Logging and Monitoring
- [ ] Security events are logged
- [ ] Log levels are appropriate
- [ ] Sensitive data is not logged
- [ ] Log rotation works
- [ ] Monitoring alerts are configured

## Automated Test Examples

### Test Suite Setup

```swift
class ProxySecurityTests: XCTestCase {
    var manager: ProxySecurityManager!
    var testConfig: SecurityConfig!
    
    override func setUp() {
        super.setUp()
        testConfig = createTestConfig()
        manager = ProxySecurityManager(config: testConfig)
    }
    
    override func tearDown() {
        manager = nil
        testConfig = nil
        super.tearDown()
    }
    
    private func createTestConfig() -> SecurityConfig {
        return SecurityConfig(
            enabled: true,
            allowedDomains: ["test-cdn.com", "example.com"],
            allowedExtensions: [".m3u8", ".ts", ".m4s"],
            maxRequestsPerMinute: 60,
            tokenRotationInterval: 60,
            enforceHTTPS: true,
            maxURLLength: 1024,
            logSecurityEvents: true,
            rateLimitConfig: RateLimitConfig(capacity: 10, refillRate: 1),
            deploymentPhase: .monitoring
        )
    }
}
```

### Test Data Factory

```swift
class TestDataFactory {
    static func createValidURL() -> URL {
        return URL(string: "https://test-cdn.com/video.m3u8")!
    }
    
    static func createInvalidURL() -> URL {
        return URL(string: "https://malicious.com/video.m3u8")!
    }
    
    static func createValidHeaders(token: String) -> [String: String] {
        return ["X-Cache-Auth": token]
    }
    
    static func createInvalidHeaders() -> [String: String] {
        return ["X-Cache-Auth": "invalid-token"]
    }
}
```

### Performance Test Helper

```swift
class PerformanceTestHelper {
    static func measureTime<T>(_ block: () -> T) -> (result: T, time: TimeInterval) {
        let startTime = CFAbsoluteTimeGetCurrent()
        let result = block()
        let endTime = CFAbsoluteTimeGetCurrent()
        return (result, endTime - startTime)
    }
    
    static func measureMemory<T>(_ block: () -> T) -> (result: T, memory: UInt64) {
        let initialMemory = getMemoryUsage()
        let result = block()
        let finalMemory = getMemoryUsage()
        return (result, finalMemory - initialMemory)
    }
}
```

## Manual Testing Procedures

### Test Environment Setup

1. **Build Test App**: Build app with security enabled
2. **Configure Test Data**: Set up test video URLs
3. **Enable Logging**: Turn on security event logging
4. **Prepare Test Cases**: Create test scenarios

### Manual Test Execution

1. **Valid Request Test**:
   - Open app with valid video URLs
   - Verify videos play normally
   - Check logs for security events

2. **Invalid Request Test**:
   - Attempt to access non-whitelisted domains
   - Verify requests are blocked
   - Check error handling

3. **Rate Limiting Test**:
   - Send rapid requests
   - Verify rate limiting works
   - Check recovery after waiting

4. **Configuration Test**:
   - Update security configuration
   - Verify changes take effect
   - Test with affected requests

### Test Results Documentation

- **Test Case ID**: Reference to automated test
- **Test Steps**: Manual steps performed
- **Expected Result**: What should happen
- **Actual Result**: What actually happened
- **Pass/Fail**: Test result
- **Notes**: Additional observations

## Continuous Integration

### Automated Test Execution

```yaml
# .github/workflows/security-tests.yml
name: Security Tests
on: [push, pull_request]
jobs:
  security-tests:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Security Tests
        run: |
          xcodebuild test \
            -workspace VideoFeedApp.xcworkspace \
            -scheme VideoFeedApp \
            -destination 'platform=iOS Simulator,name=iPhone 14' \
            -only-testing:VideoFeedAppSecurityTests
```

### Test Coverage Requirements

- **Unit Tests**: 95% code coverage
- **Integration Tests**: All critical paths
- **Performance Tests**: All performance requirements
- **Security Tests**: All security requirements

### Quality Gates

- **All Tests Pass**: No failing tests
- **Coverage Threshold**: Minimum 95% coverage
- **Performance Threshold**: All performance tests pass
- **Security Threshold**: All security tests pass

## Conclusion

This comprehensive testing guide provides complete coverage for the ProxySecurityManager implementation, ensuring that all security requirements are validated through both automated and manual testing procedures. The test suite covers authentication, authorization, rate limiting, input validation, performance, and integration scenarios, providing confidence in the security implementation.
