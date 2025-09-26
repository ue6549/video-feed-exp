import React, { useState, useEffect } from 'react';
import { View, Image, StyleSheet, Dimensions, ViewProps } from 'react-native';
import { VisibilityTrackingView, VisibilityStateChangeEvent } from './native_components/VisibilityTrackingView'; // Import your components
import Video from 'react-native-video';

// Sample interface for your video item data
interface VideoItem {
    id: string;
    videoSource: { url: string };
    thumbnailUrl: string;
}

interface VideoCardProps extends ViewProps {
    item: VideoItem;
}

// Define the visibility thresholds for our custom logic
const THRESHOLDS = {
    // 10% or more visible (incoming) -> Add video component, paused
    prepareToBeActive: 10,
    // 50% or more visible (incoming) -> Play video
    isActive: 50,
    // 30% or less visible (outgoing) -> Pause video
    willResignActive: 30,
    // 0% visible (outgoing) -> Remove video component
    notActive: 0,
};

const VideoCard: React.FC<VideoCardProps> = ({ item, ...rest }) => {
    const [isPlayerAttached, setIsPlayerAttached] = useState(false);
    const [isPlayerPlaying, setIsPlayerPlaying] = useState(false);
    const [lastVisibilityPercentage, setLastVisibilityPercentage] = useState(0);

    const onVisibilityChange = (event: { nativeEvent: VisibilityStateChangeEvent }) => {
        const { currentVisibilityPercentage } = event.nativeEvent;
        const incoming = currentVisibilityPercentage > lastVisibilityPercentage;
        setLastVisibilityPercentage(currentVisibilityPercentage);

        // Logic based on incoming/outgoing direction
        if (incoming) {
            if (currentVisibilityPercentage >= THRESHOLDS.isActive) {
                setIsPlayerAttached(true);
                setIsPlayerPlaying(true);
            } else if (currentVisibilityPercentage >= THRESHOLDS.prepareToBeActive) {
                setIsPlayerAttached(true);
                setIsPlayerPlaying(false);
            }
        } else { // Outgoing
            if (currentVisibilityPercentage <= THRESHOLDS.notActive) {
                setIsPlayerAttached(false);
                setIsPlayerPlaying(false);
            } else if (currentVisibilityPercentage <= THRESHOLDS.willResignActive) {
                setIsPlayerPlaying(false);
            }
        }
    };

    return (
        // Spread the rest props (including 'style') to the VisibilityTrackingView
        <VisibilityTrackingView
            {...rest}
            throttleInterval={50}
            visibilityThresholds={THRESHOLDS}
            uniqueId={item.id}
            onVisibilityStateChange={onVisibilityChange}>
            
            {/* Thumbnail Image */}
            {!isPlayerAttached && (
                <Image
                    source={{ uri: item.thumbnailUrl }}
                    style={styles.media}
                    resizeMode="cover"
                />
            )}
            
            {/* Video Component */}
            {isPlayerAttached && (
                <Video
                    source={{ uri: item.videoSource.url }}
                    style={styles.media}
                    controls={true}
                    resizeMode="contain"
                    onError={(e) => console.error('Video playback error', e)}
                    paused={!isPlayerPlaying}
                    repeat={true}
                    playInBackground={false}
                />
            )}
        </VisibilityTrackingView>
    );
};

const styles = StyleSheet.create({
    media: {
        width: '100%',
        height: '100%',
    },
});

export default VideoCard;
