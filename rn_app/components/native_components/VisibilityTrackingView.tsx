import { requireNativeComponent, ViewProps } from 'react-native';

// Define the shape of the visibility state event data
export interface VisibilityStateChangeEvent {
  id: string;
  currentVisibilityPercentage: number;
  [key: string]: string | number | boolean; // Allow for dynamic boolean keys
}

// Define the shape of the props for the native view
export interface TrackingViewProps extends ViewProps {
  uniqueId: string;
  throttleInterval?: number;
  visibilityThresholds?: {
    [key: string]: number; // Any string key mapping to a number threshold
  };
  onVisibilityStateChange: (event: { nativeEvent: VisibilityStateChangeEvent }) => void;
}

// requireNativeComponent links the JS to the native component
export const VisibilityTrackingView = requireNativeComponent<TrackingViewProps>('TrackingView');
