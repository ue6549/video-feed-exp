import React from 'react';
import { View, Text, StyleSheet, ViewProps } from 'react-native';
import VideoCard, { VideoCardProps } from '../components/VideoCard';
import { getImageUrl, getMediaDimensions, STR_DEFULT_ASPECT_RATIO } from '../utilities/Utilities';
import { SHORTS_VISIBILITY_CONFIG } from '../platback_manager/MediaCardVisibility';
// Import VideoData type
import type { VideoData } from '../VideoFeed';

interface ShortVideoWidgetProps extends ViewProps {
    videoProps: VideoCardProps;
    title?: string;
    snippet?: string;
    topComment?: string;
}

const ShortVideoWidget: React.FC<ShortVideoWidgetProps> = ({
    videoProps,
    title,
    snippet,
    topComment,
    ...rest
}) => {
    const displayText = title || snippet || '';
    const { width, height, aspectRatio } = getMediaDimensions((videoProps.item.aspectRatio ?? STR_DEFULT_ASPECT_RATIO));
    const thumbnailUrl = getImageUrl(videoProps.item.thumbnailUrl, width, height, 75);

    return (
        <View {...rest}>
            <VideoCard
                {...videoProps}                                  // <-- includes geekMode, applyLoadConfigOptimisations, videoProps.videoProps, etc.
                style={[styles.item, { aspectRatio }]}
                visibilityConfig={SHORTS_VISIBILITY_CONFIG}
            />
            <View style={styles.infoSection}>
                {displayText ? (
                    <Text style={styles.titleSnippet} numberOfLines={2} ellipsizeMode="tail">
                        {displayText}
                    </Text>
                ) : null}
                {topComment ? (
                    <Text style={styles.comment} numberOfLines={2} ellipsizeMode="tail">
                        {topComment}
                    </Text>
                ) : null}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    item: {
        width: '100%',
    },
    infoSection: {
        // marginTop: 8,
        paddingHorizontal: 12,
        backgroundColor: '#2a2727af',
        paddingVertical: 8,
        paddingBottom: 16,
        paddingTop: 12,
    },
    titleSnippet: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fed',
        marginBottom: 4,
    },
    comment: {
        fontSize: 11,
        color: '#edc',
        fontStyle: 'italic',
    },
});

export default ShortVideoWidget;