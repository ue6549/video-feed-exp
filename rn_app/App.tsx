/**
 * Video Feed App
 * Main entry point with navigation setup
 *
 * @format
 */

import React, {useEffect} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {AppState} from 'react-native';

import RootNavigator from './navigation/RootNavigator';
import {
  metricsFlushToFile,
  metricsInit,
  metricsRotateIfBig,
} from './instrumentation/MetricsDataRouter';
import {AppConfig} from './config/AppConfig';
import {NativeModules} from 'react-native';
import CacheManager from './services/CacheManager';

const {VideoPlayerPool} = NativeModules;

const App = () => {
  useEffect(() => {
    // Initialize native modules with config
    const initNativeConfig = async () => {
      try {
        // Set player pool size
        await VideoPlayerPool.setMaxPlayers(
          AppConfig.config.playerPool.maxPlayers,
        );

        // Set prefetch config
        await CacheManager.setPrefetchConfig(
          AppConfig.config.playerPool.avplayerPrefetchBufferSeconds,
          AppConfig.config.playerPool.avplayerPrefetchTimeoutSeconds,
        );

        // Setup security configuration
        await CacheManager.setupSecurity(AppConfig.config.proxySecurity);

        console.log('[App] ✅ Native config initialized:', {
          maxPlayers: AppConfig.config.playerPool.maxPlayers,
          bufferSeconds:
            AppConfig.config.playerPool.avplayerPrefetchBufferSeconds,
          timeoutSeconds:
            AppConfig.config.playerPool.avplayerPrefetchTimeoutSeconds,
          securityEnabled: AppConfig.config.proxySecurity.enabled,
          allowedDomains: AppConfig.config.proxySecurity.allowedDomains.length,
        });
      } catch (error) {
        console.error('[App] ❌ Failed to initialize native config:', error);
      }
    };

    initNativeConfig();

    // Initialize metrics system
    metricsInit();

    const iv = setInterval(() => {
      metricsFlushToFile();
      metricsRotateIfBig();
    }, 5000);

    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') {
        metricsFlushToFile();
      }
    });

    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
