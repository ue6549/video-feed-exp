package com.videofeedapp; // Adjust package name as needed

import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;

public class VisibilityEvent {
    private String uniqueId;
    VisibilityChangeDirection direction;
    double visibilityPercentage;

    public VisibilityEvent(String uniqueId, VisibilityChangeDirection direction, double visibilityPercentage) {
        this.uniqueId = uniqueId;
        this.direction = direction;
        this.visibilityPercentage = visibilityPercentage;
    }

    public WritableMap toWritableMap() {
        WritableMap map = Arguments.createMap();
        map.putString("uniqueId", uniqueId);
        map.putString("direction", direction.getValue());
        map.putDouble("visibilityPercentage", visibilityPercentage);
        return map;
    }
}
