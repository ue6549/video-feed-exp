package com.videofeedapp; // Adjust package name as needed

import android.content.Context;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewTreeObserver;
import android.widget.TextView;
import android.widget.FrameLayout;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.uimanager.events.RCTEventEmitter;

public class TrackingView extends FrameLayout implements ViewTreeObserver.OnScrollChangedListener {

    private String uniqueId;
    private Double throttleInterval;
    private ViewabilityTransitioningConfig visibilityConfig;
    private TextView visibilityLabel; // For debugging, similar to iOS
    private boolean isTracking = false;

    private long lastEmittedTime = 0;
    private Double lastVisibilityPercentage = null;
    private VisibilityChangeDirection lastVisibilityChangeDirection = null;
    private VisibilityEvent lastEmittedVisibilityEvent = null;

    private Handler handler = new Handler(Looper.getMainLooper());
    private Runnable visibilityUpdateRunnable = new Runnable() {
        @Override
        public void run() {
            updateVisibility();
            if (isTracking) {
                handler.postDelayed(this, 16); // Approximately 60 FPS, like CADisplayLink
            }
        }
    };

    public TrackingView(Context context) {
        super(context);
        setupView();
    }

    private void setupView() {
        setBackgroundColor(android.graphics.Color.BLUE); // Similar to iOS systemBlue
        visibilityLabel = new TextView(getContext());
        visibilityLabel.setTextColor(android.graphics.Color.WHITE);
        visibilityLabel.setTextAlignment(TEXT_ALIGNMENT_CENTER);
        FrameLayout.LayoutParams params = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT);
        params.gravity = android.view.Gravity.CENTER;
        visibilityLabel.setLayoutParams(params);
        addView(visibilityLabel);
    }

    public void setUniqueId(String uniqueId) {
        this.uniqueId = uniqueId;
    }

    public void setThrottleInterval(Double throttleInterval) {
        this.throttleInterval = throttleInterval;
    }

    public void setVisibilityConfig(ViewabilityTransitioningConfig visibilityConfig) {
        this.visibilityConfig = visibilityConfig;
        if (this.visibilityConfig != null) {
            // For debugging, similar to iOS print statements
            System.out.println("Moving In (Ascending): " + visibilityConfig.getMovingIn());
            System.out.println("Moving Out (Descending): " + visibilityConfig.getMovingOut());
        }
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        startVisibilityTracking();
        getViewTreeObserver().addOnScrollChangedListener(this);
    }

    @Override
    protected void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        stopVisibilityTracking();
        getViewTreeObserver().removeOnScrollChangedListener(this);
    }

    private void startVisibilityTracking() {
        if (!isTracking) {
            processVisibilityEvent(0.0); // Initial state
            isTracking = true;
            handler.post(visibilityUpdateRunnable);
        }
    }

    private void stopVisibilityTracking() {
        if (isTracking) {
            processVisibilityEvent(0.0); // Final state
            isTracking = false;
            handler.removeCallbacks(visibilityUpdateRunnable);
        }
    }

    @Override
    public void onScrollChanged() {
        // Trigger visibility update on scroll
        // The handler.postDelayed will ensure it's not too frequent
    }

    private void updateVisibility() {
        if (!isAttachedToWindow()) {
            stopVisibilityTracking();
            return;
        }

        Rect globalVisibleRect = new Rect();
        getGlobalVisibleRect(globalVisibleRect);

        int viewHeight = getHeight();
        int viewWidth = getWidth();

        double visibilityPercentage;
        if (viewHeight > 0 && viewWidth > 0) {
            double visibleArea = globalVisibleRect.height() * globalVisibleRect.width();
            double totalArea = viewHeight * viewWidth;
            visibilityPercentage = (visibleArea / totalArea) * 100.0;
        } else {
            visibilityPercentage = 0.0;
        }

        visibilityLabel.setText(String.format("%s - %.0f%% Visible", uniqueId, visibilityPercentage));
        processVisibilityEvent(visibilityPercentage);
    }

    private void processVisibilityEvent(double percentage) {
        if (visibilityConfig == null || uniqueId == null) {
            return;
        }

        VisibilityChangeDirection changeDirection = VisibilityChangeDirection.NONE;
        double percentageChange = percentage - (lastVisibilityPercentage != null ? lastVisibilityPercentage : 0);
        if (percentageChange > 0) {
            changeDirection = VisibilityChangeDirection.MOVING_IN;
        } else if (percentageChange < 0) {
            changeDirection = VisibilityChangeDirection.MOVING_OUT;
        }

        lastVisibilityPercentage = percentage;
        lastVisibilityChangeDirection = changeDirection;

        if (changeDirection == VisibilityChangeDirection.NONE) {
            return;
        }

        long currentTimestamp = System.currentTimeMillis();
        double interval = throttleInterval != null ? throttleInterval : 0;
        long elapsedTime = currentTimestamp - lastEmittedTime;

        if (interval > 0 && elapsedTime < interval) { // interval is in ms for Android
            return;
        }

        boolean shouldSendEvent = false;

        if (changeDirection == VisibilityChangeDirection.MOVING_IN) {
            Double currentCrossedThreshold = null;
            for (Double threshold : visibilityConfig.getMovingIn()) {
                if (percentage > threshold) {
                    currentCrossedThreshold = threshold;
                } else {
                    break; // Since sorted ascending
                }
            }

            if (currentCrossedThreshold != null) {
                if (lastEmittedVisibilityEvent != null) {
                    VisibilityChangeDirection lastEventDirection = lastEmittedVisibilityEvent.direction;
                    if (lastEventDirection == VisibilityChangeDirection.MOVING_OUT) {
                        shouldSendEvent = true;
                    } else if (lastEventDirection == VisibilityChangeDirection.MOVING_IN) {
                        Double previousThreshold = null;
                        for (Double threshold : visibilityConfig.getMovingIn()) {
                            if (lastEmittedVisibilityEvent.visibilityPercentage > threshold) {
                                previousThreshold = threshold;
                            } else {
                                break;
                            }
                        }
                        if (previousThreshold == null || !previousThreshold.equals(currentCrossedThreshold)) {
                            shouldSendEvent = true;
                        }
                    }
                } else {
                    shouldSendEvent = true;
                }
            }
        } else if (changeDirection == VisibilityChangeDirection.MOVING_OUT && lastEmittedVisibilityEvent != null) {
            Double currentCrossedThreshold = null;
            for (Double threshold : visibilityConfig.getMovingOut()) {
                if (percentage < threshold) { // Note the change for descending sort
                    currentCrossedThreshold = threshold;
                } else {
                    break;
                }
            }

            VisibilityChangeDirection lastEventDirection = lastEmittedVisibilityEvent.direction;
            Double previousThreshold = null;
            for (Double threshold : visibilityConfig.getMovingOut()) {
                if (lastEmittedVisibilityEvent.visibilityPercentage < threshold) {
                    previousThreshold = threshold;
                } else {
                    break;
                }
            }

            if (currentCrossedThreshold != null) {
                if (VisibilityChangeDirection.MOVING_IN == lastEventDirection) {
                    shouldSendEvent = true;
                } else if (previousThreshold != null) {
                    if (!previousThreshold.equals(currentCrossedThreshold)) {
                        shouldSendEvent = true;
                    }
                }
            }
        }

        if (shouldSendEvent) {
            VisibilityEvent newVisibilityEvent = new VisibilityEvent(uniqueId, changeDirection, percentage);
            sendVisibilityStateChangeEvent(newVisibilityEvent);

            lastEmittedTime = currentTimestamp;
            lastEmittedVisibilityEvent = newVisibilityEvent;
        }
    }

    private void sendVisibilityStateChangeEvent(VisibilityEvent event) {
        ReactContext reactContext = (ReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                getId(),
                "onVisibilityStateChange", // Event name matches iOS RCTDirectEventBlock
                event.toWritableMap()
        );
    }
}
