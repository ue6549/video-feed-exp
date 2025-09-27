// PlaybackEventEmitter.ts
import { EventEmitter } from 'eventemitter3';
import { MediaCardVisibility } from './MediaCardVisibility';

export const playbackEvents = new EventEmitter();
export type PlaybackEvent = 'play' | 'pause';
export type PlayItemType = string;


// type PlayItemType = 'short' | 'ad' | 'carousel' | 'merch';
// type MediaCardVisibility = 'prepareToActive' | 'Active' | 'willResignActive' | 'notActive';

interface VideoInfo {
  type: PlayItemType;
  state: MediaCardVisibility;
  isPlaying: boolean;
}

const videoMap: Map<string, VideoInfo> = new Map();
const maxPlaying: Record<PlayItemType, number> = {
  short: 1,
  ad: 1,
  carousel: 3,
  merch: 1
};

function playVideo(videoId: string): void {
    playbackEvents.emit('play', videoId);
}

function pauseVideo(videoId: string): void {
    playbackEvents.emit('pause', videoId);
}

export function handleVisibilityChange(videoId: string, videoType: PlayItemType, mediaVisibilityState: MediaCardVisibility) {
  let info = videoMap.get(videoId);
  if (!info) {
    info = { type: videoType, state: mediaVisibilityState, isPlaying: false };
    videoMap.set(videoId, info);
  } else {
    info.state = mediaVisibilityState;
  }

  switch (mediaVisibilityState) {
    case MediaCardVisibility.prepareToBeActive:
      if (getCurrentPlayingType() === null) {
        playVideo(videoId);
        info.isPlaying = true;
      }
      break;
    case MediaCardVisibility.isActive:
      attemptToPlay(videoId);
      break;
    case MediaCardVisibility.willResignActive:
      tryToActivateWaiting();
      break;
    case MediaCardVisibility.notActive:
      if (info.isPlaying) {
        pauseVideo(videoId);
        info.isPlaying = false;
      }
      videoMap.delete(videoId);
      tryToActivateWaiting();
      break;
  }
}

function getCurrentPlayingType(): PlayItemType | null {
  for (let v of videoMap.values()) {
    if (v.isPlaying) return v.type;
  }
  return null;
}

function attemptToPlay(videoId: string) {
  const info = videoMap.get(videoId)!;
  if (info.isPlaying) return;

  const videoType = info.type;
  let currentType: PlayItemType | null = null;
  const playingCount: Record<PlayItemType, number> = { short: 0, ad: 0, carousel: 0, merch: 0 };
  const resigning: string[] = [];
  for (let [id, v] of videoMap.entries()) {
    if (v.isPlaying) {
      playingCount[v.type]++;
      if (currentType === null) currentType = v.type;
      if (v.state === 'willResignActive') resigning.push(id);
    }
  }
  if (currentType === null) {
    playVideo(videoId);
    info.isPlaying = true;
    return;
  }
  if (currentType === videoType) {
    if (playingCount[videoType] < maxPlaying[videoType]) {
      playVideo(videoId);
      info.isPlaying = true;
      return;
    } else if (resigning.length > 0) {
      const toPause = resigning[0];
      pauseVideo(toPause);
      videoMap.get(toPause)!.isPlaying = false;
      playVideo(videoId);
      info.isPlaying = true;
    }
  } else if (resigning.length === playingCount[currentType]) {
    for (let id of resigning) {
      pauseVideo(id);
      videoMap.get(id)!.isPlaying = false;
    }
    playVideo(videoId);
    info.isPlaying = true;
  }
}

function tryToActivateWaiting() {
  const waiting: string[] = [];
  for (let [id, v] of videoMap.entries()) {
    if (v.state === MediaCardVisibility.isActive && !v.isPlaying) waiting.push(id);
  }
  for (let id of waiting) {
    attemptToPlay(id);
  }
}

// /**
//  * PlaybackManager class to manage video playback based on visibility and priority.
//  * 
//  * Combination of Media types that can play together
//  * 1. Short videos can not play with Carousels
//  * 2. Only one Short video can play at a time
//  * 3. Multiple viedos in a carousel can play at a time, upto 3
//  * 4. Ad = Short = Carousel in terms of priority and only 1 of them can play at a time. All > Merch.
//  * 5. If there is less then 3 videos playing on screen, one of the Merch video can play along with them.
//  */
// class PlaybackManager {
//     private mediaSourceToVisbility: Map<string, MediaCardVisibility> = new Map();
//     private mediaSourceToType: Map<string, PlayItemType> = new Map();
//     private maxConcurrentPlayingVideos: number = 3;
//     private maxConcurrentShortVideos: number = 1;
//     private maxConcurrentCarouselVideos: number = 3;
//     private maxConcurrentMerchVideos: number = 1;
//     private maxConcurrentAdVideos: number = 1;

//     private currentPlayingShortVideos: Set<string> = new Set();
//     private currentPlayingCarouselVideos: Set<string> = new Set();
//     private currentPlayingMerchVideos: Set<string> = new Set();
//     private currentPlayingAdVideos: Set<string> = new Set();

//     private currentPlayingVideos: () => Set<string> = () => {
//         const all = new Set<string>();
//         this.currentPlayingShortVideos.forEach(v => all.add(v));
//         this.currentPlayingCarouselVideos.forEach(v => all.add(v));
//         this.currentPlayingMerchVideos.forEach(v => all.add(v));
//         this.currentPlayingAdVideos.forEach(v => all.add(v));
//         return all;
//     }


//     handleVisibilityChange(videoId: string, videoType: PlayItemType, mediaVisibilityState: MediaCardVisibility) {
//         const isHardAsk = mediaVisibilityState === MediaCardVisibility.isActive;
//         const isSoftAsk = mediaVisibilityState === MediaCardVisibility.prepareToBeActive;

//         if (mediaVisibilityState === MediaCardVisibility.notActive) {
//             this.mediaSourceToVisbility.delete(videoId);
//             this.mediaSourceToType.delete(videoId);
//         }
//         else if (mediaVisibilityState === MediaCardVisibility.prepareToBeActive 
//             || mediaVisibilityState === MediaCardVisibility.isActive
//             || mediaVisibilityState === MediaCardVisibility.willResignActive) {

//             this.mediaSourceToVisbility.set(videoId, mediaVisibilityState);
//             this.mediaSourceToType.set(videoId, videoType);

//             if (mediaVisibilityState === MediaCardVisibility.prepareToBeActive) {
//                 if (this.currentPlayingVideos().size == 0) {
//                     // Play any video, add to approapriate set
//                 }
//             } else if (mediaVisibilityState === MediaCardVisibility.isActive) {
//                 if (this.currentPlayingVideos().size == 0) {
//                     // Play any video, add to approapriate set
//                 }
//                 if (videoType === 'short' 
//                     && this.currentPlayingShortVideos.size < this.maxConcurrentShortVideos
//                     && this.currentPlayingCarouselVideos.size === 0) {
                    
//                 }
//                 if (videoType === 'merch' && this.currentPlayingVideos().size < this.maxConcurrentPlayingVideos) {
//                     // Play if there is space
//                 }
//             }
//         }
//     }
// }

// export const playbackManager = new PlaybackManager();

// // Central module to manage playback
// // export const playbackManager = {

// //   activeVideoId: null as string | null,
// //   activeVideoType: null as 'short' | 'carousel' | null,

// //   handleVisibilityChange(videoId: string, videoType: PlayItemType, mediaVisibilityState: MediaCardVisibility) {
// //     // Implement your priority logic here
// //     const isHardAsk = mediaVisibilityState === MediaCardVisibility.isActive;
// //     const isSoftAsk = mediaVisibilityState === MediaCardVisibility.prepareToBeActive;

// //     if (isHardAsk) {
// //       if (this.activeVideoId !== videoId) {
// //         playbackEvents.emit('pause', this.activeVideoId);
// //         this.activeVideoId = videoId;
// //         this.activeVideoType = videoType;
// //         playbackEvents.emit('play', videoId);
// //       }
// //     } else if (isSoftAsk && this.activeVideoType !== 'short') {
// //         if (this.activeVideoId !== videoId) {
// //           playbackEvents.emit('pause', this.activeVideoId);
// //           this.activeVideoId = videoId;
// //           this.activeVideoType = videoType;
// //           playbackEvents.emit('play', videoId);
// //         }
// //     } else if (this.activeVideoId === videoId && percentage < 30) {
// //       this.activeVideoId = null;
// //       this.activeVideoType = null;
// //       playbackEvents.emit('pause', videoId);
// //     }
// //   },
// // };
