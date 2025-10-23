/**
 * MediaCardVisibility States:
 * 
 * Visibility-based states that control when video players are mounted and unmounted.
 * Note: These states control video player lifecycle, but actual playback is controlled
 * by PlaybackManager based on widget priority and play rules.
 * 
 * - prefetch: Video is approaching viewport, start prefetching content
 * - prepareToBeActive: Video player attached and ready to play (mounted but paused)
 * - isActive: Video meets visibility criteria for playing (50% for shorts, 90% for carousel)
 *   NOTE: isActive means "eligible to play" based on visibility, but actual playback 
 *   is controlled by PlaybackManager based on widget priority and play rules.
 * - willResignActive: Video losing visibility, should pause and prepare to unmount
 * - notActive: Video off screen, unmount video player
 * - released: Complete cleanup, cancel prefetch operations
 */
export enum MediaCardVisibility {
  prefetch = 'prefetch',
  prepareToBeActive = 'prepareToBeActive',
  isActive = 'isActive',
  willResignActive = 'willResignActive',
  notActive = 'notActive',
  released = 'released',
}

export enum MediaCardType {
  short = 'short',
  carousel = 'carousel',
}

export interface VisibilityTransitioningConfig {
  movingIn: {
    prefetch: number; // e.g., 5% visibility - start prefetch
    prepareToBeActive: number; // e.g., 25% visibility - mount player paused
    isActive: number; // e.g., 50% visibility - play video
  };
  movingOut: {
    willResignActive: number; // e.g., 90% visibility - pause video
    notActive: number; // e.g., 20% visibility - unmount player
    released: number; // e.g., 5% visibility - cancel prefetch, cleanup
  };
}

// Define the visibility thresholds for our custom logic
export const SHORTS_VISIBILITY_CONFIG: VisibilityTransitioningConfig = {
  movingIn: {
    // 10% or more visible (incoming) -> Start prefetch (increased from 5% for earlier player attachment)
    prefetch: 10,
    // 25% or more visible (incoming) -> Add video component, paused
    prepareToBeActive: 25,
    // 50% or more visible (incoming) -> Play video
    isActive: 50,
  },
  movingOut: {
    // 90% or less visible (outgoing) -> Pause video
    willResignActive: 90,
    // 20% or less visible (outgoing) -> Remove video component
    notActive: 20,
    // 10% or less visible (outgoing) -> Cancel prefetch, full cleanup (increased from 5% to match incoming)
    released: 10,
  },
};

export const CAROUSEL_CARDS_VISIBILITY_CONFIG: VisibilityTransitioningConfig = {
  movingIn: {
    // 10% or more visible (incoming) -> Start prefetch (increased from 5% for earlier player attachment)
    prefetch: 10,
    // 25% or more visible (incoming) -> Add video component, paused
    prepareToBeActive: 25,
    // 90% or more visible (incoming) -> Play video (carousel needs high visibility)
    isActive: 90,
  },
  movingOut: {
    // 70% or less visible (outgoing) -> Pause video
    willResignActive: 70,
    // 10% or less visible (outgoing) -> Remove video component
    notActive: 10,
    // 10% or less visible (outgoing) -> Cancel prefetch, full cleanup (increased from 5% to match incoming)
    released: 10,
  },
};
