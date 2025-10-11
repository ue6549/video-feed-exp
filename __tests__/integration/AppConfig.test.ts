describe('AppConfig Integration', () => {
  // Test that AppConfig can be imported and used
  // Note: AppConfig relies on React Native modules that are mocked in test environment
  
  it('should be importable without errors', () => {
    expect(() => {
      require('../../rn_app/config/AppConfig');
    }).not.toThrow();
  });

  it('should export AppConfig class', () => {
    const module = require('../../rn_app/config/AppConfig');
    expect(module).toBeDefined();
    expect(module.AppConfig).toBeDefined();
  });

  it('should have config object available', () => {
    const { AppConfig } = require('../../rn_app/config/AppConfig');
    
    // Verify config exists
    expect(AppConfig.config).toBeDefined();
    expect(typeof AppConfig.config).toBe('object');
  });

  it('should have expected config sections', () => {
    const { AppConfig } = require('../../rn_app/config/AppConfig');
    const config = AppConfig.config;
    
    // Verify main config sections exist (based on actual config structure)
    expect(config).toHaveProperty('playback');
    expect(config).toHaveProperty('visibility');
    expect(config).toHaveProperty('prefetch');
    expect(config).toHaveProperty('cache');
    expect(config).toHaveProperty('performance');
    expect(config).toHaveProperty('widgets');
  });
});

