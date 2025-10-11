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
});

