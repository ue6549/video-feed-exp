/**
 * Video Feed App
 * Main entry point with navigation setup
 *
 * @format
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { AppState } from 'react-native';

import RootNavigator from './navigation/RootNavigator';
import { metricsFlushToFile, metricsInit, metricsRotateIfBig } from './instrumentation/MetricsDataRouter';

const App = () => {
  useEffect(() => {
    // Initialize metrics system
    metricsInit();

    const iv = setInterval(() => {
      metricsFlushToFile();
      metricsRotateIfBig();
    }, 5000);

    const sub = AppState.addEventListener('change', s => {
      if (s !== 'active') metricsFlushToFile();
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
