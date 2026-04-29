import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { z } from 'zod';
import { requireGangAccess, isGangAccessError } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit, getClientIp } from '@/lib/apiRateLimit';
import { logError } from '@/lib/logger';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
]);
const ALLOWED_IMAGE_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);
const ALLOWED_DISCORD_HOSTS = new Set([
    'cdn.discordapp.com',
    'media.discordapp.net',
    'images-ext-1.discordapp.net',
    'images-ext-2.discordapp.net',
]);

const UploadRequestSchema = z.object({
    gangId: z.string().min(1).max(64),
    url: z.string().url().optional(),
});

function ensureUploadServiceConfigured() {
    if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
    ) {
        throw new Error('UPLOAD_SERVICE_UNAVAILABLE');
    }
}

function resolveFolder(gangId: string) {
    return `gang-logos/${gangId}`;
}

function sanitizeUploadResult(result: any) {
    return {
        secure_url: result.secure_url,
        public_id: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        resource_type: result.resource_type,
    };
}

async function discardUnsupportedUpload(result: any) {
    if (result?.public_id) {
        await cloudinary.uploader.destroy(result.public_id, { resource_type: 'image' }).catch(() => undefined);
    }
}

function isAllowedUploadedImage(result: any) {
    return result?.resource_type === 'image' && ALLOWED_IMAGE_FORMATS.has(String(result?.format || '').toLowerCase());
}

function validateDiscordCdnUrl(rawUrl: string) {
    const parsed = new URL(rawUrl);

    if (parsed.protocol !== 'https:') {
        throw new Error('INVALID_UPLOAD_URL');
    }

    if (!ALLOWED_DISCORD_HOSTS.has(parsed.hostname)) {
        throw new Error('UNSUPPORTED_UPLOAD_HOST');
    }

    return parsed.toString();
}

export async function POST(req: NextRequest) {
    let gangId = 'unknown';

    try {
        ensureUploadServiceConfigured();

        const formData = await req.formData();
        const file = formData.get('file');
        const rawUrl = formData.get('url');
        const rawGangId = formData.get('gangId');

        const parsedInput = UploadRequestSchema.parse({
            gangId: typeof rawGangId === 'string' ? rawGangId : '',
            url: typeof rawUrl === 'string' && rawUrl ? rawUrl : undefined,
        });
        gangId = parsedInput.gangId;

        await requireGangAccess({ gangId: parsedInput.gangId, minimumRole: 'OWNER' });
        const rateLimited = await enforceRouteRateLimit(req, {
            scope: 'api:upload',
            limit: 10,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('upload', parsedInput.gangId, getClientIp(req)),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const hasFile = file instanceof File;
        const hasUrl = Boolean(parsedInput.url);

        if ((hasFile && hasUrl) || (!hasFile && !hasUrl)) {
            return NextResponse.json(
                { error: 'Provide exactly one upload source' },
                { status: 400 }
            );
        }

        const folder = resolveFolder(parsedInput.gangId);

        if (hasFile && file instanceof File) {
            if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
                return NextResponse.json({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' }, { status: 400 });
            }

            if (file.size <= 0 || file.size > MAX_UPLOAD_SIZE) {
                return NextResponse.json({ error: 'Image must be between 1 byte and 5MB' }, { status: 400 });
            }

            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const result = await new Promise<any>((resolve, reject) => {
                cloudinary.uploader.upload_stream(
                    {
                        folder,
                        resource_type: 'image',
                    },
                    (error, uploadResult) => {
                        if (error) {
                            reject(error);
                            return;
                        }

                        resolve(uploadResult);
                    }
                ).end(buffer);
            });

            if (!isAllowedUploadedImage(result)) {
                await discardUnsupportedUpload(result);
                return NextResponse.json({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' }, { status: 400 });
            }

            return NextResponse.json(sanitizeUploadResult(result));
        }

        if (parsedInput.url) {
            const safeUrl = validateDiscordCdnUrl(parsedInput.url);
            const result = await cloudinary.uploader.upload(safeUrl, {
                folder,
                resource_type: 'image',
            });

            if (!isAllowedUploadedImage(result)) {
                await discardUnsupportedUpload(result);
                return NextResponse.json({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' }, { status: 400 });
            }

            return NextResponse.json(sanitizeUploadResult(result));
        }

        return NextResponse.json({ error: 'No upload payload provided' }, { status: 400 });
    } catch (error: any) {
        if (isGangAccessError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid upload request' }, { status: 400 });
        }

        if (error.message === 'UPLOAD_SERVICE_UNAVAILABLE') {
            return NextResponse.json({ error: 'Upload service unavailable' }, { status: 503 });
        }

        if (error.message === 'INVALID_UPLOAD_URL' || error.message === 'UNSUPPORTED_UPLOAD_HOST') {
            return NextResponse.json(
                { error: 'Only HTTPS Discord CDN image URLs are supported' },
                { status: 400 }
            );
        }

        logError('api.upload.failed', error, {
            gangId,
            clientIp: getClientIp(req),
        });
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}

export async function GET() {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
