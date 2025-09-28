package com.videofeedapp; // Adjust package name as needed

import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import javax.annotation.Nullable;
import java.util.Map;

public class TrackingViewManager extends SimpleViewManager<TrackingView> {

    public static final String REACT_CLASS = "TrackingView"; // Matches RCT_EXPORT_MODULE(TrackingView)

    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @Override
    protected TrackingView createViewInstance(ThemedReactContext reactContext) {
        return new TrackingView(reactContext);
    }

    @ReactProp(name = "uniqueId")
    public void setUniqueId(TrackingView view, @Nullable String uniqueId) {
        view.setUniqueId(uniqueId);
    }

    @ReactProp(name = "throttleInterval")
    public void setThrottleInterval(TrackingView view, @Nullable Double throttleInterval) {
        view.setThrottleInterval(throttleInterval);
    }

    @ReactProp(name = "visibilityConfig")
    public void setVisibilityConfig(TrackingView view, @Nullable ReadableMap visibilityConfigMap) {
        if (visibilityConfigMap != null) {
            view.setVisibilityConfig(new ViewabilityTransitioningConfig(visibilityConfigMap));
        } else {
            view.setVisibilityConfig(null);
        }
    }

    @Override
    public @Nullable Map getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.of(
                "onVisibilityStateChange", // Event name matches iOS
                MapBuilder.of("registrationName", "onVisibilityStateChange")
        );
    }
}
