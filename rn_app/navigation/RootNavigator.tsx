import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { RootStackParamList, SCREEN_NAMES } from './types';
import FeedScreen from '../screens/FeedScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createStackNavigator<RootStackParamList>();

const RootNavigator: React.FC = () => {
  return (
    <Stack.Navigator 
      screenOptions={{ 
        headerShown: false,
        gestureEnabled: true,
        cardStyleInterpolator: ({ current, layouts }) => {
          return {
            cardStyle: {
              transform: [
                {
                  translateX: current.progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [layouts.screen.width, 0],
                  }),
                },
              ],
            },
          };
        },
      }}
    >
      <Stack.Screen 
        name={SCREEN_NAMES.FEED} 
        component={FeedScreen}
        options={{
          title: 'Video Feed',
        }}
      />
      <Stack.Screen 
        name={SCREEN_NAMES.SETTINGS} 
        component={SettingsScreen}
        options={{
          title: 'Settings',
          headerShown: true,
          headerStyle: {
            backgroundColor: '#1f0505ff',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
          },
        }}
      />
    </Stack.Navigator>
  );
};

export default RootNavigator;

