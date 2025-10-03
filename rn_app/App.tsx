/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import VideoFeed from './VideoFeed';
import { metricsFlushToFile, metricsInit, metricsRotateIfBig } from './instrumentation/MetricsDataRouter';
import { AppState } from 'react-native';

const App = () => {
  // useEffect(() => {
  //   metricsInit();

  //   const iv = setInterval(() => {
  //     metricsFlushToFile();
  //     metricsRotateIfBig();
  //   }, 5000);

  //   const sub = AppState.addEventListener('change', s => {
  //     if (s !== 'active') metricsFlushToFile();
  //   });

  //   return () => {
  //     clearInterval(iv);
  //     sub.remove();
  //   };
  // }, []);

  return (
    <SafeAreaProvider>
      <VideoFeed />
    </SafeAreaProvider>
  );
};

export default App;
