export const DEFULT_ASPECT_RATIO = 9 / 16; // Fallback aspect ratio
export const STR_DEFULT_ASPECT_RATIO = '16:9'; // Fallback aspect ratio string
export const FALLBACK_MEDIA_WIDTH = 1000;

export const parseAspectRatio = (ratioString: string): number | undefined => {
    const parts = ratioString.split(':');
    if (parts.length === 2) {
        const width = parseFloat(parts[1]);
        const height = parseFloat(parts[0]);
        return width / height;
    }
    return undefined;
};

export const getMediaDimensions = (ratioString: string, width?: number, height?: number) => {
    const aspectRatioValue = parseAspectRatio(ratioString) ?? DEFULT_ASPECT_RATIO;
    if (width && !height) {
        return { width: Math.ceil(width), height: Math.ceil(width / aspectRatioValue), aspectRatio: aspectRatioValue };
    } else if (!width && height) {
        return { width: Math.ceil(height * aspectRatioValue), height: Math.ceil(height), aspectRatio: aspectRatioValue };
    } else if (width && height) {
        return { width: Math.ceil(width), height: Math.ceil(height), aspectRatio: width / height };
    } else {
        return { width: FALLBACK_MEDIA_WIDTH, height: Math.ceil(FALLBACK_MEDIA_WIDTH / aspectRatioValue), aspectRatio: aspectRatioValue }; // Default size
    }
}

export const getImageUrl = (parameterizedUrl: String, width?: number, height?: number, q?: number) => {
    return parameterizedUrl.replace('{@width}', `${width ? width : 1000}`)
        .replace('{@height}', `${height ? height : 1000}`)
        .replace('{@quality}', `${q ? q : 75}`);
}
