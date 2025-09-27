export enum MediaCardVisibility {
    prepareToBeActive = 'prepareToBeActive',
    isActive = 'isActive',
    willResignActive = 'willResignActive',
    notActive = 'notActive',
}

export enum MediaCardType {
    short = 'short',
    carousel = 'carousel',
}

export interface VisibilityTransitioningConfig {
    movingIn: {
        prepareToBeActive: number; // e.g., 10% visibility
        isActive: number;          // e.g., 50% visibility
    };
    movingOut: {
        willResignActive: number;  // e.g., 30% visibility
        notActive: number;         // e.g., 0% visibility
    };
}


// Define the visibility thresholds for our custom logic
export const SHORTS_VISIBILITY_CONFIG: VisibilityTransitioningConfig = {
    movingIn: {
        // 10% or more visible (incoming) -> Add video component, paused
        prepareToBeActive: 25,
        // 50% or more visible (incoming) -> Play video
        isActive: 40,
    },
    movingOut: {
        // 30% or less visible (outgoing) -> Pause video
        willResignActive: 50,
        // 0% visible (outgoing) -> Remove video component
        notActive: 20,
    }
};

export const CAROUSEL_CARDS_VISIBILITY_CONFIG: VisibilityTransitioningConfig = {
    movingIn: {
        // 10% or more visible (incoming) -> Add video component, paused
        prepareToBeActive: 25,
        // 50% or more visible (incoming) -> Play video
        isActive: 90,
    },
    movingOut: {
        // 30% or less visible (outgoing) -> Pause video
        willResignActive: 45,
        // 0% visible (outgoing) -> Remove video component
        notActive: 20,
    }
};
