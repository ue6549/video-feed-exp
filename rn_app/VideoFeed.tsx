import React from 'react';
import { View, FlatList, StyleSheet, Dimensions, Image } from 'react-native';
import { VisibilityTrackingView } from './components';
import feedData from './resources/video-feed';
import VideoCard from './components/VideoCard';

interface IFeedItem {
    id: string;
    widgetType: 'short' | 'carousel';
    color: string;
    videoSource: {
        sourceType: string;
        url: string;
        type: string;
    };
    thumbnail: {
        width: number,
        aspectRatio: string,
        type: string,
        height: number,
        dynamicImageUrl: string
    };
}

const DATA: IFeedItem[] = Array.from({ length: feedData.length }, (_, i) => ({
    id: i.toString(),
    widgetType: i % 4 != 3 ? 'short' : 'carousel',
    color: `#${Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0')}`,
    videoSource: feedData[i].video_source,
    thumbnail: feedData[i].thumbail,
}));

const renderRow = ({ item }: { item: IFeedItem }) => {
    const isCarousel = item.widgetType === 'carousel';
    // const height = isCarousel ? Dimensions.get('window').height / 4 : Dimensions.get('window').height / 1.2;
    const parseAspectRatio = (ratioString: string): number | undefined => {
        const parts = ratioString.split(':');
        if (parts.length === 2) {
            const width = parseFloat(parts[1]);
            const height = parseFloat(parts[0]);
            return width / height;
        }
        return undefined;
    };

    const aspectRatioValue = parseAspectRatio(item.thumbnail.aspectRatio) ?? 9 / 16;
    return (
        <VideoCard
            item={{ id: item.id, videoSource: item.videoSource, thumbnailUrl: _getImageUrl(item, Dimensions.get('window').width, 75) }}
            style={[styles.item, { aspectRatio : aspectRatioValue, backgroundColor: item.color }]}
        />
    );
};

const _getImageUrl = (item: IFeedItem, width?: number, height?: number, q?: number) => {
    return item.thumbnail.dynamicImageUrl.replace('{@width}', `${width ? width : 1000}`)
        .replace('{@height}', `${height ? height : 1000}`)
        .replace('{@quality}', `${q ? q : 75}`);
}

const VideoFeed = () => (
    <FlatList
        data={DATA}
        keyExtractor={item => item.id}
        renderItem={renderRow}
        contentContainerStyle={styles.container}
    />
);

const styles = StyleSheet.create({
    container: {
        paddingVertical: 16,
    },
    item: {
        marginVertical: 8,
        marginHorizontal: 16,
        borderRadius: 12,
        overflow: 'hidden',
        width: '100%',
    },
    // thumbnail: {
    //     ...StyleSheet.absoluteFillObject,
    // },
    // video: {
    //     width: '100%',
    //     height: '100%',
    //     borderRadius: 12,
    //     ...StyleSheet.absoluteFillObject,
    // },
});

export default VideoFeed;