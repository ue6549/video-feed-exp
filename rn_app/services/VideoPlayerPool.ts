import { NativeModules } from 'react-native';

const { VideoPlayerPool: NativeVideoPlayerPool } = NativeModules;

export interface PoolStats {
  availablePlayers: number;
  activePlayers: number;
  availableLayers: number;
  activeLayers: number;
  maxPlayers: number;
  maxLayers: number;
}

class VideoPlayerPoolService {
  /**
   * Get current pool statistics
   */
  async getPoolStats(): Promise<PoolStats> {
    try {
      const stats = await NativeVideoPlayerPool.getPoolStats();
      return stats as PoolStats;
    } catch (error) {
      console.error('Failed to get pool stats:', error);
      return {
        availablePlayers: 0,
        activePlayers: 0,
        availableLayers: 0,
        activeLayers: 0,
        maxPlayers: 5,
        maxLayers: 8,
      };
    }
  }

  /**
   * Clear the entire pool (for debugging/testing)
   */
  async clearPool(): Promise<void> {
    try {
      await NativeVideoPlayerPool.clearPool();
    } catch (error) {
      console.error('Failed to clear pool:', error);
    }
  }

  /**
   * Get pool utilization percentage
   */
  async getPoolUtilization(): Promise<{
    playerUtilization: number;
    layerUtilization: number;
  }> {
    const stats = await this.getPoolStats();
    
    const playerUtilization = stats.maxPlayers > 0 
      ? (stats.activePlayers / stats.maxPlayers) * 100 
      : 0;
    
    const layerUtilization = stats.maxLayers > 0 
      ? (stats.activeLayers / stats.maxLayers) * 100 
      : 0;

    return {
      playerUtilization,
      layerUtilization,
    };
  }

  /**
   * Check if pool is healthy (not overutilized)
   */
  async isPoolHealthy(): Promise<boolean> {
    const utilization = await this.getPoolUtilization();
    return utilization.playerUtilization < 90 && utilization.layerUtilization < 90;
  }

  /**
   * Log pool statistics for debugging
   */
  async logPoolStats(): Promise<void> {
    const stats = await this.getPoolStats();
    const utilization = await this.getPoolUtilization();
    
    console.log('VideoPlayerPool Stats:', {
      ...stats,
      ...utilization,
    });
  }
}

export default new VideoPlayerPoolService();

