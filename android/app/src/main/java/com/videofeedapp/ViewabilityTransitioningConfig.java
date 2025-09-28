package com.videofeedapp; // Adjust package name as needed

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public class ViewabilityTransitioningConfig {
    private final List<Double> movingIn;
    private final List<Double> movingOut;

    public ViewabilityTransitioningConfig(ReadableMap map) {
        List<Double> tempMovingIn = new ArrayList<>();
        if (map.hasKey("movingIn") && map.getType("movingIn").name().equals("Array")) {
            ReadableArray arr = map.getArray("movingIn");
            for (int i = 0; i < arr.size(); i++) {
                tempMovingIn.add(arr.getDouble(i));
            }
            Collections.sort(tempMovingIn); // Sort ascending
        }
        this.movingIn = tempMovingIn;

        List<Double> tempMovingOut = new ArrayList<>();
        if (map.hasKey("movingOut") && map.getType("movingOut").name().equals("Array")) {
            ReadableArray arr = map.getArray("movingOut");
            for (int i = 0; i < arr.size(); i++) {
                tempMovingOut.add(arr.getDouble(i));
            }
            Collections.sort(tempMovingOut, Collections.reverseOrder()); // Sort descending
        }
        this.movingOut = tempMovingOut;
    }

    public List<Double> getMovingIn() {
        return movingIn;
    }

    public List<Double> getMovingOut() {
        return movingOut;
    }
}
