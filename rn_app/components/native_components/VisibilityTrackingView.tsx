import { requireNativeComponent, ViewProps } from 'react-native';

// Define the shape of the visibility state event data
export type VisibilityChangeDirection = 'movingIn' | 'movingOut';

export interface VisibilityStateChangeEvent {
  uniqueId: string
  direction: VisibilityChangeDirection
  visibilityPercentage: number
}

export interface RawVisibilityTransitioningConfig {
    movingIn: number[];
    movingOut: number[];
}


// Define the shape of the props for the native view
/**
 * visibilityThresholds is a dictionary of string keys to number values.
 * This allows for dynamic thresholds to be defined and passed to the native component.
 * 
 * Not creating a strict enum or union type for the keys allows for more flexibility.
 * 
 * Not creating a minimum delay or timeout for viewbility change events. The throttle interval should be sufficient.
 * 
 * Not creating a scroll state based condition for viewbility change events also. I think the throttle interval should be sufficient.
 * Although in some cases, the scroll state may be important. Will see if that is required in future.
 */
export interface TrackingViewProps extends ViewProps {
  uniqueId: string;
  throttleInterval?: number;
  visibilityConfig?: RawVisibilityTransitioningConfig
  onVisibilityStateChange: (event: { nativeEvent: VisibilityStateChangeEvent }) => void;
}

// requireNativeComponent links the JS to the native component
export const VisibilityTrackingView = requireNativeComponent<TrackingViewProps>('TrackingView');
