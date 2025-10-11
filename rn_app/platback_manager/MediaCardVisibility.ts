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
        prefetch: number;          // e.g., 5% visibility - start prefetch
        prepareToBeActive: number; // e.g., 25% visibility - mount player paused
        isActive: number;          // e.g., 50% visibility - play video
    };
    movingOut: {
        willResignActive: number;  // e.g., 90% visibility - pause video
        notActive: number;         // e.g., 20% visibility - unmount player
        released: number;          // e.g., 5% visibility - cancel prefetch, cleanup
    };
}


// Define the visibility thresholds for our custom logic
export const SHORTS_VISIBILITY_CONFIG: VisibilityTransitioningConfig = {
    movingIn: {
        // 5% or more visible (incoming) -> Start prefetch
        prefetch: 5,
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
        // 5% or less visible (outgoing) -> Cancel prefetch, full cleanup
        released: 5,
    }
};

export const CAROUSEL_CARDS_VISIBILITY_CONFIG: VisibilityTransitioningConfig = {
    movingIn: {
        // 5% or more visible (incoming) -> Start prefetch
        prefetch: 5,
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
        // 5% or less visible (outgoing) -> Cancel prefetch, full cleanup
        released: 5,
    }
};
