import { handleVisibilityChange, clearAllPlayback } from '../../rn_app/platback_manager/PlaybackManager';
import { MediaCardVisibility } from '../../rn_app/platback_manager/MediaCardVisibility';
import { playbackEvents } from '../../rn_app/platback_manager/PlaybackManager';

describe('PlaybackManager Integration', () => {
  beforeEach(() => {
    // Clear all event listeners and playback state
    playbackEvents.removeAllListeners();
    clearAllPlayback();
    jest.clearAllMocks();
  });

  afterEach(() => {
    playbackEvents.removeAllListeners();
    clearAllPlayback();
  });

  it('should emit play event when video becomes active', () => {
    const playListener = jest.fn();
    playbackEvents.on('play', playListener);

    handleVisibilityChange(
      'video-1',
      'short',
      MediaCardVisibility.isActive,
      'VOD'
    );

    expect(playListener).toHaveBeenCalledWith('video-1');
  });

  it('should emit pause event when video leaves active state', () => {
    const pauseListener = jest.fn();
    playbackEvents.on('pause', pauseListener);

    // First activate the video
    handleVisibilityChange('video-1', 'short', MediaCardVisibility.isActive, 'VOD');
    
    // Then move it to willResignActive
    handleVisibilityChange('video-1', 'short', MediaCardVisibility.willResignActive, 'VOD');

    expect(pauseListener).toHaveBeenCalledWith('video-1');
  });

  it('should handle video transitioning to different states', () => {
    const playListener = jest.fn();
    const pauseListener = jest.fn();
    playbackEvents.on('play', playListener);
    playbackEvents.on('pause', pauseListener);

    // Activate first video
    handleVisibilityChange('video-1', 'short', MediaCardVisibility.isActive, 'VOD');
    expect(playListener).toHaveBeenCalledWith('video-1');
    
    // Move to willResignActive
    handleVisibilityChange('video-1', 'short', MediaCardVisibility.willResignActive, 'VOD');
    expect(pauseListener).toHaveBeenCalledWith('video-1');
  });

  it('should handle visibility change from notActive to prefetch', () => {
    const playListener = jest.fn();
    playbackEvents.on('play', playListener);

    handleVisibilityChange('video-1', 'short', MediaCardVisibility.prefetch, 'VOD');

    // Should not play in prefetch state
    expect(playListener).not.toHaveBeenCalled();
  });

  it('should handle visibility change from prefetch to prepareToBeActive', () => {
    const playListener = jest.fn();
    playbackEvents.on('play', playListener);

    handleVisibilityChange('video-1', 'short', MediaCardVisibility.prefetch, 'VOD');
    handleVisibilityChange('video-1', 'short', MediaCardVisibility.prepareToBeActive, 'VOD');

    // Should not play yet in prepareToBeActive state
    expect(playListener).not.toHaveBeenCalled();
  });

  it('should handle released state without errors', () => {
    // Activate video first
    handleVisibilityChange('video-1', 'short', MediaCardVisibility.isActive, 'VOD');
    
    // Then release it - should not throw
    expect(() => {
      handleVisibilityChange('video-1', 'short', MediaCardVisibility.released, 'VOD');
    }).not.toThrow();
  });
});

