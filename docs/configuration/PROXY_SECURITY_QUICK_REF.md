# Proxy Security Quick Reference

## Common Configurations

### Development Environment

```typescript
proxySecurity: {
  enabled: true,
  allowedDomains: [
    '2gud-live-cdn.akamaized.net',
    'localhost',
    '127.0.0.1'
  ],
  allowedExtensions: ['.m3u8', '.ts', '.m4s', '.mp4'],
  maxRequestsPerMinute: 1000,
  tokenRotationInterval: 300,
  enforceHTTPS: false, // Allow HTTP for local testing
  maxURLLength: 4096,
  logSecurityEvents: true,
  rateLimitConfig: {
    capacity: 100,
    refillRate: 20
  },
  deploymentPhase: 'monitoring'
}
```

### Staging Environment

```typescript
proxySecurity: {
  enabled: true,
  allowedDomains: [
    'staging-cdn.example.com',
    'test-cdn.example.com'
  ],
  allowedExtensions: ['.m3u8', '.ts', '.m4s'],
  maxRequestsPerMinute: 600,
  tokenRotationInterval: 300,
  enforceHTTPS: true,
  maxURLLength: 2048,
  logSecurityEvents: true,
  rateLimitConfig: {
    capacity: 50,
    refillRate: 10
  },
  deploymentPhase: 'soft'
}
```

### Production Environment

```typescript
proxySecurity: {
  enabled: true,
  allowedDomains: [
    '2gud-live-cdn.akamaized.net',
    'cdn.example.com'
  ],
  allowedExtensions: ['.m3u8', '.ts', '.m4s'],
  maxRequestsPerMinute: 600,
  tokenRotationInterval: 300,
  enforceHTTPS: true,
  maxURLLength: 2048,
  logSecurityEvents: true,
  rateLimitConfig: {
    capacity: 100,
    refillRate: 10
  },
  deploymentPhase: 'full'
}
```

## Troubleshooting Flowchart

```
Security Issue Detected
         │
         ▼
    Is Security Enabled?
    ├─ No → Enable Security
    └─ Yes → Check Logs
         │
         ▼
    What Type of Issue?
    ├─ Authentication → Check Token
    ├─ Authorization → Check Domains
    ├─ Rate Limiting → Check Limits
    └─ Performance → Check Overhead
         │
         ▼
    Apply Fix
         │
         ▼
    Test Solution
         │
         ▼
    Monitor Results
```

## Security Event Codes

### Authentication Events

| Code | Description | Action |
|------|-------------|--------|
| AUTH-001 | Invalid token | Check token generation |
| AUTH-002 | Missing token | Verify header injection |
| AUTH-003 | Token expired | Check rotation interval |
| AUTH-004 | Token rotation failed | Check system time |

### Authorization Events

| Code | Description | Action |
|------|-------------|--------|
| AUTHZ-001 | Domain not whitelisted | Add domain to config |
| AUTHZ-002 | Extension not allowed | Add extension to config |
| AUTHZ-003 | HTTP URL rejected | Use HTTPS URL |
| AUTHZ-004 | URL too long | Shorten URL or increase limit |

### Rate Limiting Events

| Code | Description | Action |
|------|-------------|--------|
| RATE-001 | Rate limit exceeded | Increase limits or wait |
| RATE-002 | Burst limit exceeded | Increase capacity |
| RATE-003 | Sustained rate exceeded | Increase refill rate |
| RATE-004 | Rate limiter failure | Check system resources |

### Validation Events

| Code | Description | Action |
|------|-------------|--------|
| VAL-001 | Malicious pattern detected | Review URL patterns |
| VAL-002 | Directory traversal attempt | Block request |
| VAL-003 | XSS attempt detected | Block request |
| VAL-004 | SQL injection attempt | Block request |

## Performance Tuning Tips

### High Traffic Scenarios

```typescript
// Increase rate limits for high traffic
rateLimitConfig: {
  capacity: 200,    // Allow larger bursts
  refillRate: 20    // Higher sustained rate
}

// Reduce token rotation frequency
tokenRotationInterval: 600  // 10 minutes instead of 5
```

### Low Latency Requirements

```typescript
// Optimize for low latency
rateLimitConfig: {
  capacity: 50,     // Smaller bursts
  refillRate: 5     // Lower sustained rate
}

// Increase URL length limit
maxURLLength: 4096  // Allow longer URLs
```

### Memory Constrained Devices

```typescript
// Reduce memory usage
rateLimitConfig: {
  capacity: 20,     // Smaller token buckets
  refillRate: 2     // Lower refill rate
}

// Shorter token rotation
tokenRotationInterval: 180  // 3 minutes
```

## Configuration Validation

### Required Fields

```typescript
interface SecurityConfig {
  enabled: boolean;                    // Required
  allowedDomains: string[];           // Required, non-empty
  allowedExtensions: string[];        // Required, non-empty
  maxRequestsPerMinute: number;       // Required, > 0
  tokenRotationInterval: number;      // Required, > 0
  enforceHTTPS: boolean;              // Required
  maxURLLength: number;               // Required, > 0
  logSecurityEvents: boolean;         // Required
  rateLimitConfig: {                  // Required
    capacity: number;                 // Required, > 0
    refillRate: number;               // Required, > 0
  };
  deploymentPhase: 'monitoring' | 'soft' | 'full'; // Required
}
```

### Validation Rules

```typescript
function validateSecurityConfig(config: SecurityConfig): string[] {
  const errors: string[] = [];
  
  if (!config.allowedDomains || config.allowedDomains.length === 0) {
    errors.push('allowedDomains must be non-empty');
  }
  
  if (!config.allowedExtensions || config.allowedExtensions.length === 0) {
    errors.push('allowedExtensions must be non-empty');
  }
  
  if (config.maxRequestsPerMinute <= 0) {
    errors.push('maxRequestsPerMinute must be positive');
  }
  
  if (config.tokenRotationInterval <= 0) {
    errors.push('tokenRotationInterval must be positive');
  }
  
  if (config.maxURLLength <= 0) {
    errors.push('maxURLLength must be positive');
  }
  
  if (config.rateLimitConfig.capacity <= 0) {
    errors.push('rateLimitConfig.capacity must be positive');
  }
  
  if (config.rateLimitConfig.refillRate <= 0) {
    errors.push('rateLimitConfig.refillRate must be positive');
  }
  
  return errors;
}
```

## Common Issues and Solutions

### Issue: Videos Not Playing

**Symptoms**: Videos show loading spinner but never play

**Possible Causes**:
1. Security blocking valid requests
2. Rate limiting too restrictive
3. Domain not whitelisted
4. Token generation failing

**Solutions**:
1. Check security logs for blocked requests
2. Verify domain is in allowedDomains
3. Check rate limit configuration
4. Verify token generation is working

**Debug Steps**:
```swift
// Check if security is blocking requests
let result = securityManager.validateRequest(url: url, headers: headers)
if case .blocked(let reason) = result {
    print("Request blocked: \(reason)")
}

// Check rate limiting
let canProceed = securityManager.checkRateLimit(for: domain)
print("Rate limit check: \(canProceed)")

// Check token validity
let isValid = securityManager.validateToken(token)
print("Token valid: \(isValid)")
```

### Issue: High CPU Usage

**Symptoms**: App becomes sluggish, high CPU usage

**Possible Causes**:
1. Rate limiting calculations too frequent
2. Token rotation too frequent
3. Validation overhead too high
4. Memory leaks in security manager

**Solutions**:
1. Increase token rotation interval
2. Optimize rate limiting algorithm
3. Cache validation results
4. Check for memory leaks

**Debug Steps**:
```swift
// Profile validation overhead
let startTime = CFAbsoluteTimeGetCurrent()
for _ in 0..<1000 {
    _ = securityManager.validateRequest(url: url, headers: headers)
}
let endTime = CFAbsoluteTimeGetCurrent()
let averageTime = (endTime - startTime) / 1000.0
print("Average validation time: \(averageTime)ms")

// Check memory usage
let memoryUsage = getMemoryUsage()
print("Memory usage: \(memoryUsage) bytes")
```

### Issue: False Positives

**Symptoms**: Valid requests being blocked

**Possible Causes**:
1. Domain not in whitelist
2. Extension not allowed
3. Rate limits too low
4. Malicious pattern detection too aggressive

**Solutions**:
1. Add domain to allowedDomains
2. Add extension to allowedExtensions
3. Increase rate limits
4. Review malicious pattern detection

**Debug Steps**:
```swift
// Check domain whitelist
let isDomainAllowed = securityManager.isDomainAllowed(domain)
print("Domain allowed: \(isDomainAllowed)")

// Check extension whitelist
let isExtensionAllowed = securityManager.isExtensionAllowed(extension)
print("Extension allowed: \(isExtensionAllowed)")

// Check rate limit status
let rateLimitStatus = securityManager.getRateLimitStatus(for: domain)
print("Rate limit status: \(rateLimitStatus)")
```

### Issue: Security Events Not Logged

**Symptoms**: No security events in logs

**Possible Causes**:
1. Logging disabled
2. Log level too high
3. Logging system not initialized
4. Events not being generated

**Solutions**:
1. Enable security event logging
2. Lower log level
3. Initialize logging system
4. Check event generation

**Debug Steps**:
```swift
// Check logging configuration
print("Logging enabled: \(config.logSecurityEvents)")

// Test event logging
securityManager.logSecurityEvent(.authenticationFailure)
// Check if event appears in logs

// Check log level
print("Current log level: \(Logger.currentLevel)")
```

## Security Checklist

### Pre-Deployment

- [ ] Security configuration validated
- [ ] All domains whitelisted
- [ ] Rate limits appropriate for traffic
- [ ] Token rotation working
- [ ] HTTPS enforcement enabled
- [ ] Logging configured
- [ ] Performance tests passed
- [ ] Security tests passed

### Post-Deployment

- [ ] Security events being logged
- [ ] No false positives
- [ ] Performance within limits
- [ ] Rate limiting effective
- [ ] Token rotation working
- [ ] Monitoring alerts configured
- [ ] Incident response procedures tested

### Regular Maintenance

- [ ] Review security logs weekly
- [ ] Update domain whitelist as needed
- [ ] Monitor performance metrics
- [ ] Review rate limit effectiveness
- [ ] Update security configuration
- [ ] Test incident response procedures
- [ ] Review and update documentation

## Emergency Procedures

### Disable Security (Emergency Only)

```typescript
// Emergency configuration to disable security
proxySecurity: {
  enabled: false,  // Disable all security checks
  // ... other config ignored when disabled
}
```

**Warning**: Only use in emergency situations. This completely disables all security protections.

### Increase Rate Limits (Temporary)

```typescript
// Temporary rate limit increase
rateLimitConfig: {
  capacity: 1000,   // Very high capacity
  refillRate: 100   // Very high refill rate
}
```

**Warning**: Monitor system resources when using high rate limits.

### Add Emergency Domain

```typescript
// Add emergency domain to whitelist
allowedDomains: [
  'emergency-cdn.example.com',
  // ... existing domains
]
```

**Warning**: Verify domain is legitimate before adding to whitelist.

## Monitoring and Alerting

### Key Metrics to Monitor

1. **Security Events**: Count of blocked requests
2. **Rate Limiting**: Requests per second per domain
3. **Performance**: Validation latency
4. **Token Rotation**: Success/failure rate
5. **Memory Usage**: Security manager memory consumption

### Alert Thresholds

```typescript
const alertThresholds = {
  securityEvents: {
    warning: 10,    // 10 events per minute
    critical: 100   // 100 events per minute
  },
  rateLimiting: {
    warning: 0.8,   // 80% of rate limit
    critical: 0.95  // 95% of rate limit
  },
  performance: {
    warning: 2,     // 2ms validation time
    critical: 5     // 5ms validation time
  },
  memory: {
    warning: 50,    // 50MB
    critical: 100   // 100MB
  }
};
```

### Log Analysis

```bash
# Count security events by type
grep "SECURITY_EVENT" app.log | cut -d' ' -f4 | sort | uniq -c

# Monitor rate limiting
grep "RATE_LIMIT" app.log | tail -100

# Check performance
grep "VALIDATION_TIME" app.log | awk '{print $NF}' | sort -n
```

## Best Practices

### Configuration Management

1. **Version Control**: Keep security config in version control
2. **Environment Specific**: Use different configs for dev/staging/prod
3. **Validation**: Validate config before deployment
4. **Documentation**: Document all configuration changes
5. **Testing**: Test config changes in staging first

### Security Management

1. **Principle of Least Privilege**: Only allow necessary domains/extensions
2. **Defense in Depth**: Multiple security layers
3. **Regular Review**: Review security config regularly
4. **Incident Response**: Have procedures for security incidents
5. **Monitoring**: Monitor security events continuously

### Performance Management

1. **Baseline**: Establish performance baselines
2. **Monitoring**: Monitor performance continuously
3. **Optimization**: Optimize based on monitoring data
4. **Testing**: Test performance changes
5. **Documentation**: Document performance characteristics

## Conclusion

This quick reference guide provides essential information for configuring, troubleshooting, and maintaining the ProxySecurityManager. Keep this guide handy for quick reference during development, deployment, and maintenance activities.

For detailed information, refer to:
- `PROXY_SECURITY_DESIGN.md` for architecture details
- `PROXY_SECURITY_TESTING.md` for testing procedures
- Source code for implementation details
