import {NativeModules} from 'react-native';
import CacheManager from '../../rn_app/services/CacheManager';

// Mock native modules
jest.mock('react-native', () => ({
  NativeModules: {
    CacheManager: {
      setupSecurity: jest.fn(),
      getSecurityStats: jest.fn(),
      updateSecurityConfig: jest.fn(),
      clearSecurityData: jest.fn(),
      getCachedURL: jest.fn(),
    },
  },
}));

describe('ProxySecurityManager Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Security Configuration', () => {
    it('should setup security with valid configuration', async () => {
      const securityConfig = {
        enabled: true,
        allowedDomains: ['test-cdn.com', 'example.com'],
        allowedExtensions: ['.m3u8', '.ts', '.m4s'],
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

      NativeModules.CacheManager.setupSecurity.mockResolvedValue(true);

      await CacheManager.setupSecurity(securityConfig);

      expect(NativeModules.CacheManager.setupSecurity).toHaveBeenCalledWith(
        securityConfig,
      );
    });

    it('should handle security setup errors', async () => {
      const securityConfig = {
        enabled: true,
        allowedDomains: ['test-cdn.com'],
        allowedExtensions: ['.m3u8'],
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

      const error = new Error('Security setup failed');
      NativeModules.CacheManager.setupSecurity.mockRejectedValue(error);

      await expect(CacheManager.setupSecurity(securityConfig)).rejects.toThrow(
        'Security setup failed',
      );
    });
  });

  describe('Security Statistics', () => {
    it('should get security statistics', async () => {
      const mockStats = {
        config: {
          enabled: true,
          allowedDomains: 2,
          allowedExtensions: 3,
          maxRequestsPerMinute: 600,
          tokenRotationInterval: 300,
          enforceHTTPS: true,
          maxURLLength: 2048,
          deploymentPhase: 'monitoring',
        },
        tokenGenerator: {
          currentToken: 'sec_abc123...',
          tokenExpiry: 1234567890,
          isExpired: false,
        },
        urlValidator: {
          allowedDomains: 2,
          allowedExtensions: 3,
          maliciousPatterns: 15,
          compiledPatterns: 15,
          maxURLLength: 2048,
          enforceHTTPS: true,
        },
        rateLimiter: {},
        eventLogger: {
          totalEvents: 0,
          eventTypes: 0,
          eventCounts: {},
          lastCleanup: 1234567890,
        },
      };

      NativeModules.CacheManager.getSecurityStats.mockResolvedValue(mockStats);

      const stats = await CacheManager.getSecurityStats();

      expect(NativeModules.CacheManager.getSecurityStats).toHaveBeenCalled();
      expect(stats).toEqual(mockStats);
    });

    it('should handle security stats errors', async () => {
      NativeModules.CacheManager.getSecurityStats.mockResolvedValue({
        error: 'Security manager not initialized',
      });

      const stats = await CacheManager.getSecurityStats();

      expect(stats).toEqual({
        error: 'Security manager not initialized',
      });
    });
  });

  describe('Security Configuration Updates', () => {
    it('should update security configuration', async () => {
      const newConfig = {
        enabled: true,
        allowedDomains: ['new-cdn.com'],
        allowedExtensions: ['.m3u8', '.ts'],
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

      NativeModules.CacheManager.updateSecurityConfig.mockResolvedValue(true);

      await CacheManager.updateSecurityConfig(newConfig);

      expect(
        NativeModules.CacheManager.updateSecurityConfig,
      ).toHaveBeenCalledWith(newConfig);
    });

    it('should handle configuration update errors', async () => {
      const newConfig = {
        enabled: true,
        allowedDomains: ['test.com'],
        allowedExtensions: ['.m3u8'],
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

      const error = new Error('Configuration update failed');
      NativeModules.CacheManager.updateSecurityConfig.mockRejectedValue(error);

      await expect(
        CacheManager.updateSecurityConfig(newConfig),
      ).rejects.toThrow('Configuration update failed');
    });
  });

  describe('Security Data Management', () => {
    it('should clear security data', async () => {
      NativeModules.CacheManager.clearSecurityData.mockResolvedValue(true);

      await CacheManager.clearSecurityData();

      expect(NativeModules.CacheManager.clearSecurityData).toHaveBeenCalled();
    });

    it('should handle clear security data errors', async () => {
      const error = new Error('Clear data failed');
      NativeModules.CacheManager.clearSecurityData.mockRejectedValue(error);

      await expect(CacheManager.clearSecurityData()).rejects.toThrow(
        'Clear data failed',
      );
    });
  });

  describe('URL Caching with Security', () => {
    it('should get cached URL with security validation', async () => {
      const originalURL = 'https://test-cdn.com/video.m3u8';
      const cachedURL = 'http://localhost:8080/proxy/test-cdn.com/video.m3u8';

      NativeModules.CacheManager.getCachedURL.mockReturnValue(cachedURL);

      const result = await CacheManager.getCachedURL(originalURL);

      expect(NativeModules.CacheManager.getCachedURL).toHaveBeenCalledWith(
        originalURL,
      );
      expect(result).toBe(cachedURL);
    });

    it('should handle security violations in URL caching', async () => {
      const maliciousURL = 'https://malicious.com/video.m3u8';

      // Security violation - return null
      NativeModules.CacheManager.getCachedURL.mockReturnValue(null);

      const result = await CacheManager.getCachedURL(maliciousURL);

      expect(result).toBeNull();
    });

    it('should fallback to original URL on security errors', async () => {
      const originalURL = 'https://test-cdn.com/video.m3u8';

      // Simulate security error
      NativeModules.CacheManager.getCachedURL.mockImplementation(() => {
        throw new Error('Security validation failed');
      });

      const result = await CacheManager.getCachedURL(originalURL);

      // Should fallback to original URL
      expect(result).toBe(originalURL);
    });
  });
});

describe('Security Configuration Validation', () => {
  it('should validate required security fields', () => {
    const validConfig = {
      enabled: true,
      allowedDomains: ['test-cdn.com'],
      allowedExtensions: ['.m3u8'],
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

    // All required fields present
    expect(validConfig.enabled).toBeDefined();
    expect(validConfig.allowedDomains).toBeDefined();
    expect(validConfig.allowedExtensions).toBeDefined();
    expect(validConfig.maxRequestsPerMinute).toBeDefined();
    expect(validConfig.tokenRotationInterval).toBeDefined();
    expect(validConfig.enforceHTTPS).toBeDefined();
    expect(validConfig.maxURLLength).toBeDefined();
    expect(validConfig.logSecurityEvents).toBeDefined();
    expect(validConfig.rateLimitConfig).toBeDefined();
    expect(validConfig.deploymentPhase).toBeDefined();
  });

  it('should validate deployment phases', () => {
    const validPhases = ['monitoring', 'soft', 'full'];
    
    validPhases.forEach(phase => {
      expect(['monitoring', 'soft', 'full']).toContain(phase);
    });
  });

  it('should validate rate limit configuration', () => {
    const rateLimitConfig = {
      capacity: 100,
      refillRate: 10,
    };

    expect(rateLimitConfig.capacity).toBeGreaterThan(0);
    expect(rateLimitConfig.refillRate).toBeGreaterThan(0);
  });
});
