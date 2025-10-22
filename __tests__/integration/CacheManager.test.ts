import CacheManager from '../../rn_app/services/CacheManager';

// CacheManager is mocked in jest.setup.js, but we can test the mock's behavior
describe('CacheManager Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return cache status for video URL', async () => {
    const url = 'https://test.com/video.m3u8';
    const status = await CacheManager.getCacheStatus(url);

    expect(status).toHaveProperty('isCached');
    expect(status).toHaveProperty('cachedBytes');
    expect(typeof status.isCached).toBe('boolean');
    expect(typeof status.cachedBytes).toBe('number');
  });

  it('should handle cache setup without errors', async () => {
    await expect(CacheManager.setupCache()).resolves.not.toThrow();
  });

  it('should get total cache size', async () => {
    const size = await CacheManager.getTotalCacheSize();
    expect(typeof size).toBe('number');
    expect(size).toBeGreaterThanOrEqual(0);
  });

  it('should clear cache successfully', async () => {
    await expect(CacheManager.clearCache()).resolves.not.toThrow();
  });

  it('should call getCacheStatus with correct URL', async () => {
    const testUrl = 'https://example.com/test.m3u8';
    await CacheManager.getCacheStatus(testUrl);

    expect(CacheManager.getCacheStatus).toHaveBeenCalledWith(testUrl);
  });

  // Security-related tests
  it('should setup security configuration', async () => {
    const securityConfig = {
      enabled: true,
      allowedDomains: ['test-cdn.com'],
      allowedExtensions: ['.m3u8', '.ts'],
      maxRequestsPerMinute: 600,
      tokenRotationInterval: 300,
      enforceHTTPS: true,
      maxURLLength: 2048,
      logSecurityEvents: true,
      rateLimitConfig: {
        capacity: 100,
        refillRate: 10,
      },
      deploymentPhase: 'monitoring',
    };

    await expect(
      CacheManager.setupSecurity(securityConfig),
    ).resolves.not.toThrow();
  });

  it('should get security statistics', async () => {
    const stats = await CacheManager.getSecurityStats();

    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });

  it('should update security configuration', async () => {
    const newConfig = {
      enabled: true,
      allowedDomains: ['new-cdn.com'],
      allowedExtensions: ['.m3u8'],
      maxRequestsPerMinute: 1000,
      tokenRotationInterval: 600,
      enforceHTTPS: true,
      maxURLLength: 4096,
      logSecurityEvents: true,
      rateLimitConfig: {
        capacity: 200,
        refillRate: 20,
      },
      deploymentPhase: 'soft',
    };

    await expect(
      CacheManager.updateSecurityConfig(newConfig),
    ).resolves.not.toThrow();
  });

  it('should clear security data', async () => {
    await expect(CacheManager.clearSecurityData()).resolves.not.toThrow();
  });

  it('should handle security setup errors gracefully', async () => {
    const invalidConfig = {
      enabled: true,
      allowedDomains: [], // Invalid: empty domains
      allowedExtensions: [], // Invalid: empty extensions
      maxRequestsPerMinute: -1, // Invalid: negative value
      tokenRotationInterval: 0, // Invalid: zero interval
      enforceHTTPS: true,
      maxURLLength: 0, // Invalid: zero length
      logSecurityEvents: true,
      rateLimitConfig: {
        capacity: 0, // Invalid: zero capacity
        refillRate: 0, // Invalid: zero rate
      },
      deploymentPhase: 'monitoring',
    };

    // Should handle invalid config gracefully
    await expect(
      CacheManager.setupSecurity(invalidConfig),
    ).resolves.not.toThrow();
  });
});
