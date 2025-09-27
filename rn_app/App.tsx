/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import VideoFeed from './VideoFeed';

const App = () => {
  return (
    <SafeAreaProvider>
      <VideoFeed />
    </SafeAreaProvider>
  );
};

export default App;
