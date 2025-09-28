package com.videofeedapp; // Adjust package name as needed

public enum VisibilityChangeDirection {
    MOVING_IN("movingIn"),
    MOVING_OUT("movingOut"),
    NONE("none");

    private final String value;

    VisibilityChangeDirection(String value) {
        this.value = value;
    }

    public String getValue() {
        return value;
    }

    public static VisibilityChangeDirection fromString(String text) {
        for (VisibilityChangeDirection b : VisibilityChangeDirection.values()) {
            if (b.value.equalsIgnoreCase(text)) {
                return b;
            }
        }
        return NONE; // Default or error handling
    }
}
