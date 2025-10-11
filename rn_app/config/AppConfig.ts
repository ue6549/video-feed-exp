// Centralized configuration system with runtime editing support
export interface AppConfigType {
  feed: {
    maxContentWidth: number;
    firstPageSize: number;
    subsequentPageSize: number;
    prefetchThreshold: number;
  };
  widgets: {
    carousel: {
      cardsVisible: {
        small: number;
        medium: number;
        large: number;
      };
      maxConcurrentVideos: number;
    };
    short: {
      maxConcurrentVideos: number;
    };
    merch: {
      maxConcurrentVideos: number;
    };
    default: {
      maxConcurrentVideos: number;
    };
  };
  visibility: {
    prefetchRange: number;
    mountThreshold: number;
    softPlayThreshold: number;
    hardPlayThreshold: number;
    softPauseThreshold: number;
    hardPauseThreshold: number;
    unmountThreshold: number;
    nativeThrottleMs: number;
  };
  prefetch: {
    enabled: boolean;
    vodOnly: boolean;
    segmentCount: number;
    maxConcurrent: number;
    priorities: string[];
  };
  cache: {
    maxSizeMB: number;
    strategy: 'LRU';
    manifestTemplateId: string;
  };
  playback: {
    previewDuration: number;
    sequencingEnabled: boolean;
    rotateToSoftPlay: boolean;
  };
  performance: {
    isLowEndDevice: boolean;
    autoplayOnLowEnd: boolean;
  };
  offline: {
    mockOfflineMode: boolean;
    showOnlyCachedVideos: boolean;
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error' | 'none';
    modules: {
      visibility: boolean;
      playback: boolean;
      prefetch: boolean;
      video: boolean;
      metrics: boolean;
    };
  };
}

export class AppConfig {
  private static listeners: Array<(config: AppConfigType) => void> = [];
  
  static config: AppConfigType = {
    feed: {
      maxContentWidth: 768,
      firstPageSize: 10,
      subsequentPageSize: 8,
      prefetchThreshold: 3,
    },
    widgets: {
      carousel: {
        cardsVisible: { small: 2.5, medium: 3.5, large: 3.5 },
        maxConcurrentVideos: 3,
      },
      short: { maxConcurrentVideos: 1 },
      merch: { maxConcurrentVideos: 1 },
      default: { maxConcurrentVideos: 1 },
    },
    visibility: {
      prefetchRange: 5,
      mountThreshold: 1,
      softPlayThreshold: 20,
      hardPlayThreshold: 50,
      softPauseThreshold: 80,
      hardPauseThreshold: 20,
      unmountThreshold: 0,
      nativeThrottleMs: 50,
    },
    prefetch: {
      enabled: true,
      vodOnly: true,
      segmentCount: 2,
      maxConcurrent: 3,
      priorities: ['short', 'carousel', 'merch'],
    },
    cache: {
      maxSizeMB: 500,
      strategy: 'LRU',
      manifestTemplateId: 'hls-vod-v3',
    },
    playback: {
      previewDuration: 30,
      sequencingEnabled: true,
      rotateToSoftPlay: true,
    },
    performance: {
      isLowEndDevice: false,
      autoplayOnLowEnd: false,
    },
    offline: {
      mockOfflineMode: false,
      showOnlyCachedVideos: true,
    },
    logging: {
      enabled: __DEV__,  // Auto-enable in debug mode
      level: __DEV__ ? 'debug' : 'none',
      modules: {
        visibility: true,
        playback: true,
        prefetch: true,
        video: true,
        metrics: false,
      },
    },
  };

  /**
   * Update configuration with deep merge
   */
  static update(newConfig: Partial<AppConfigType>): boolean {
    const oldConfig = { ...this.config };
    this.config = this.deepMerge(this.config, newConfig);
    
    // Notify listeners
    this.listeners.forEach(listener => listener(this.config));
    
    // Check if reload is required
    return this.requiresReload(oldConfig, this.config);
  }

  /**
   * Subscribe to configuration changes
   */
  static subscribe(listener: (config: AppConfigType) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Check if changes require app reload
   */
  private static requiresReload(oldConfig: AppConfigType, newConfig: AppConfigType): boolean {
    // Navigation changes require reload
    if (oldConfig.feed.maxContentWidth !== newConfig.feed.maxContentWidth) {
      return true;
    }
    
    // Performance class changes require reload
    if (oldConfig.performance.isLowEndDevice !== newConfig.performance.isLowEndDevice) {
      return true;
    }
    
    // Cache strategy changes require reload
    if (oldConfig.cache.strategy !== newConfig.cache.strategy) {
      return true;
    }
    
    return false;
  }

  /**
   * Deep merge utility
   */
  private static deepMerge(target: any, source: any): any {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  /**
   * Get configuration value by path
   */
  static get(path: string): any {
    return path.split('.').reduce((obj: any, key) => obj?.[key], this.config as any);
  }

  /**
   * Reset to default configuration
   */
  static reset(): void {
    this.config = {
      feed: {
        maxContentWidth: 768,
        firstPageSize: 10,
        subsequentPageSize: 8,
        prefetchThreshold: 3,
      },
      widgets: {
        carousel: {
          cardsVisible: { small: 2.5, medium: 3.5, large: 3.5 },
          maxConcurrentVideos: 3,
        },
        short: { maxConcurrentVideos: 1 },
        merch: { maxConcurrentVideos: 1 },
        default: { maxConcurrentVideos: 1 },
      },
      visibility: {
        prefetchRange: 5,
        mountThreshold: 1,
        softPlayThreshold: 20,
        hardPlayThreshold: 50,
        softPauseThreshold: 80,
        hardPauseThreshold: 20,
        unmountThreshold: 0,
        nativeThrottleMs: 50,
      },
      prefetch: {
        enabled: true,
        vodOnly: true,
        segmentCount: 2,
        maxConcurrent: 3,
        priorities: ['short', 'carousel', 'merch'],
      },
      cache: {
        maxSizeMB: 500,
        strategy: 'LRU',
        manifestTemplateId: 'hls-vod-v3',
      },
      playback: {
        previewDuration: 30,
        sequencingEnabled: true,
        rotateToSoftPlay: true,
      },
      performance: {
        isLowEndDevice: false,
        autoplayOnLowEnd: false,
      },
      offline: {
        mockOfflineMode: false,
        showOnlyCachedVideos: true,
      },
      logging: {
        enabled: __DEV__,
        level: __DEV__ ? 'debug' : 'none',
        modules: {
          visibility: true,
          playback: true,
          prefetch: true,
          video: true,
          metrics: false,
        },
      },
    };
    
    this.listeners.forEach(listener => listener(this.config));
  }
}

