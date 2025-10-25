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
    strategy: 'auto' | 'avplayer' | 'manifest'; // Prefetch strategy
    prefetchDurationSeconds: number; // Duration to prefetch before canceling (AVAssetDownloadTask)
    carousel: {
      initialVideos: number; // Number of videos to prefetch when carousel appears
      horizontalLookahead: number; // Future: videos to prefetch ahead during horizontal scroll
    };
  };
  cache: {
    maxSizeMB: number;
    strategy: 'LRU';
    manifestTemplateId: string;
  };
  playerPool: {
    maxPlayers: number;
    avplayerPrefetchBufferSeconds: number;
    avplayerPrefetchTimeoutSeconds: number;
  };
  playback: {
    previewDuration: number;
    sequencingEnabled: boolean;
    rotateToSoftPlay: boolean;
    widgetPreviewDurations: {
      short: number;
      carousel: number;
      merch: number;
      default: number;
    };
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
      security: boolean;
    };
  };
  proxySecurity: {
    enabled: boolean;
    allowedDomains: string[];
    allowedExtensions: string[];
    maxRequestsPerMinute: number;
    tokenRotationInterval: number;
    enforceHTTPS: boolean;
    maxURLLength: number;
    logSecurityEvents: boolean;
    rateLimitConfig: {
      capacity: number;
      refillRate: number;
    };
    deploymentPhase: 'monitoring' | 'soft' | 'full';
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
        cardsVisible: {small: 2.5, medium: 3.5, large: 3.5},
        maxConcurrentVideos: 3,
      },
      short: {maxConcurrentVideos: 1},
      merch: {maxConcurrentVideos: 1},
      default: {maxConcurrentVideos: 1},
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
      strategy: 'auto', // Try AVPlayer first, fallback to manifest
      prefetchDurationSeconds: 2, // Duration to prefetch before canceling (AVAssetDownloadTask)
      carousel: {
        initialVideos: 2, // Prefetch first 2 videos when carousel appears
        horizontalLookahead: 2, // Future: prefetch 2 ahead during horizontal scroll
      },
    },
    cache: {
      maxSizeMB: 500,
      strategy: 'LRU',
      manifestTemplateId: 'hls-vod-v3',
    },
    playerPool: {
      maxPlayers: 3, // Hard limit on AVPlayer pool
      avplayerPrefetchBufferSeconds: 2, // Buffer 2 seconds for prefetch
      avplayerPrefetchTimeoutSeconds: 5, // Safety timeout for prefetch (fail fast)
    },
    playback: {
      previewDuration: 10, // General fallback duration
      sequencingEnabled: true, // Enable playback sequencing
      rotateToSoftPlay: true, // Enable rotation to soft play
      widgetPreviewDurations: {
        short: 15, // 15 seconds for short videos
        carousel: 5, // 5 seconds for carousel videos
        merch: 0, // No preview for merch (image only)
        default: 10, // 10 seconds default fallback
      },
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
      enabled: __DEV__, // Auto-enable in debug mode
      level: __DEV__ ? 'debug' : 'none',
      modules: {
        visibility: true,
        playback: true,
        prefetch: true,
        video: true,
        metrics: false,
        security: true,
      },
    },
    proxySecurity: {
      enabled: true,
      allowedDomains: ['2gud-live-cdn.akamaized.net', 'cdn.example.com'],
      allowedExtensions: ['.m3u8', '.ts', '.m4s', '.mp4'],
      maxRequestsPerMinute: 600,
      tokenRotationInterval: 300, // 5 minutes
      enforceHTTPS: true,
      maxURLLength: 2048,
      logSecurityEvents: true,
      rateLimitConfig: {
        capacity: 100,
        refillRate: 10,
      },
      deploymentPhase: 'monitoring' as const,
    },
  };

  /**
   * Update configuration with deep merge
   */
  static update(newConfig: Partial<AppConfigType>): boolean {
    const oldConfig = {...this.config};
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
  private static requiresReload(
    oldConfig: AppConfigType,
    newConfig: AppConfigType,
  ): boolean {
    // Navigation changes require reload
    if (oldConfig.feed.maxContentWidth !== newConfig.feed.maxContentWidth) {
      return true;
    }

    // Performance class changes require reload
    if (
      oldConfig.performance.isLowEndDevice !==
      newConfig.performance.isLowEndDevice
    ) {
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
    const result = {...target};

    for (const key in source) {
      if (
        source[key] &&
        typeof source[key] === 'object' &&
        !Array.isArray(source[key])
      ) {
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
    return path
      .split('.')
      .reduce((obj: any, key) => obj?.[key], this.config as any);
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
          cardsVisible: {small: 2.5, medium: 3.5, large: 3.5},
          maxConcurrentVideos: 3,
        },
        short: {maxConcurrentVideos: 1},
        merch: {maxConcurrentVideos: 1},
        default: {maxConcurrentVideos: 1},
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
        strategy: 'auto',
        prefetchDurationSeconds: 2,
        carousel: {
          initialVideos: 2,
          horizontalLookahead: 2,
        },
      },
      cache: {
        maxSizeMB: 500,
        strategy: 'LRU',
        manifestTemplateId: 'hls-vod-v3',
      },
      playerPool: {
        maxPlayers: 3,
        avplayerPrefetchBufferSeconds: 2,
        avplayerPrefetchTimeoutSeconds: 5,
      },
      playback: {
        previewDuration: 10,
        sequencingEnabled: true,
        rotateToSoftPlay: true,
        widgetPreviewDurations: {
          short: 15,
          carousel: 5,
          merch: 0,
          default: 10,
        },
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
          security: true,
        },
      },
      proxySecurity: {
        enabled: true,
        allowedDomains: ['2gud-live-cdn.akamaized.net', 'cdn.example.com'],
        allowedExtensions: ['.m3u8', '.ts', '.m4s', '.mp4'],
        maxRequestsPerMinute: 600,
        tokenRotationInterval: 300,
        enforceHTTPS: true,
        maxURLLength: 2048,
        logSecurityEvents: true,
        rateLimitConfig: {
          capacity: 100,
          refillRate: 10,
        },
        deploymentPhase: 'monitoring' as const,
      },
    };

    this.listeners.forEach(listener => listener(this.config));
  }
}
