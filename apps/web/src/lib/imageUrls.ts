type CloudinaryImageOptions = {
    width?: number;
    height?: number;
    crop?: 'fill' | 'fit' | 'limit';
};

const CLOUDINARY_UPLOAD_SEGMENT = '/image/upload/';

function clampDimension(value: number | undefined, fallback: number) {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(24, Math.min(512, Math.round(value as number)));
}

function hasCloudinaryTransform(firstSegment: string | undefined) {
    if (!firstSegment) return false;
    if (/^v\d+$/.test(firstSegment)) return false;
    return firstSegment.includes(',') || /^(c|f|q|w|h|g|e|r|dpr)_/.test(firstSegment);
}

export function getOptimizedCloudinaryImageUrl(
    imageUrl: string | null | undefined,
    options: CloudinaryImageOptions = {}
) {
    if (!imageUrl) return imageUrl ?? null;

    let parsed: URL;
    try {
        parsed = new URL(imageUrl);
    } catch {
        return imageUrl;
    }

    if (parsed.protocol !== 'https:' || parsed.hostname !== 'res.cloudinary.com') {
        return imageUrl;
    }

    const uploadIndex = parsed.pathname.indexOf(CLOUDINARY_UPLOAD_SEGMENT);
    if (uploadIndex < 0) return imageUrl;

    const afterUpload = parsed.pathname.slice(uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length);
    const firstSegment = afterUpload.split('/')[0];
    if (hasCloudinaryTransform(firstSegment)) return imageUrl;

    const width = clampDimension(options.width, 96);
    const height = clampDimension(options.height, width);
    const crop = options.crop || 'fill';
    const transform = `f_auto,q_auto,c_${crop},w_${width},h_${height}`;

    parsed.pathname = `${parsed.pathname.slice(0, uploadIndex + CLOUDINARY_UPLOAD_SEGMENT.length)}${transform}/${afterUpload}`;
    return parsed.toString();
}

export function getOptimizedAvatarUrl(src: string | null | undefined, size = 96) {
    return getOptimizedCloudinaryImageUrl(src, { width: size, height: size }) ?? src ?? null;
}
