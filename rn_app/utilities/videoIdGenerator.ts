/**
 * Generate clean, comprehensible video IDs
 * Format: vid-<widget_index>-<video_index>
 * 
 * Examples:
 * - vid-0-0 (first widget, first video)
 * - vid-3-2 (4th widget is carousel, 3rd video in that carousel)
 * - vid-5-0 (6th widget, single video)
 */

export const generateVideoId = (widgetIndex: number, videoIndex: number = 0): string => {
  return `vid-${widgetIndex}-${videoIndex}`;
};

/**
 * Parse video ID back to indices
 */
export const parseVideoId = (videoId: string): { widgetIndex: number; videoIndex: number } | null => {
  const match = videoId.match(/^vid-(\d+)-(\d+)$/);
  if (!match) return null;
  
  return {
    widgetIndex: parseInt(match[1], 10),
    videoIndex: parseInt(match[2], 10),
  };
};

