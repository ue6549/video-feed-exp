// Navigation types for the video feed app
export type RootStackParamList = {
  FeedScreen: undefined;
  Settings: undefined;
  // Future screens can be added here
  // VideoDetail: { videoId: string };
  // Profile: { userId: string };
};

// Navigation prop types
export type RootStackScreenProps<T extends keyof RootStackParamList> = {
  navigation: any; // Will be properly typed when @react-navigation is added
  route: {
    params: RootStackParamList[T];
  };
};

// Screen names as constants
export const SCREEN_NAMES = {
  FEED: 'FeedScreen',
  SETTINGS: 'Settings',
} as const;

