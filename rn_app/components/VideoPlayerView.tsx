import React from 'react';
import { requireNativeComponent, ViewProps } from 'react-native';

// Event types
interface VideoLoadEvent {
  videoId: string;
  duration: number;
  naturalSize: {
    width: number;
    height: number;
  };
}

interface VideoProgressEvent {
  videoId: string;
  currentTime: number;
  playableDuration: number;
  duration: number;
}

interface VideoEndEvent {
  videoId: string;
}

interface VideoErrorEvent {
  videoId: string;
  error: string;
}

interface VideoBufferEvent {
  videoId: string;
  isBuffering: boolean;
}

interface VideoReadyForDisplayEvent {
  videoId: string;
}

// Props interface
interface VideoPlayerViewProps extends ViewProps {
  source: string;
  paused?: boolean;
  muted?: boolean;
  videoId: string;
  onLoad?: (event: { nativeEvent: VideoLoadEvent }) => void;
  onProgress?: (event: { nativeEvent: VideoProgressEvent }) => void;
  onEnd?: (event: { nativeEvent: VideoEndEvent }) => void;
  onError?: (event: { nativeEvent: VideoErrorEvent }) => void;
  onBuffer?: (event: { nativeEvent: VideoBufferEvent }) => void;
  onReadyForDisplay?: (event: { nativeEvent: VideoReadyForDisplayEvent }) => void;
}

// requireNativeComponent links the JS to the native component
const NativeVideoPlayerView = requireNativeComponent<VideoPlayerViewProps>('VideoPlayerView');

const VideoPlayerView: React.FC<VideoPlayerViewProps> = (props) => {
  return <NativeVideoPlayerView {...props} />;
};

export default VideoPlayerView;
