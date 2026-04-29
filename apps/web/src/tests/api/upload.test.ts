import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockCloudinaryDestroy, mockCloudinaryUpload, mockCloudinaryUploadStream } = vi.hoisted(() => ({
    mockCloudinaryDestroy: vi.fn(),
    mockCloudinaryUpload: vi.fn(),
    mockCloudinaryUploadStream: vi.fn(),
}));

vi.mock('cloudinary', () => ({
    v2: {
        config: vi.fn(),
        uploader: {
            destroy: mockCloudinaryDestroy,
            upload: mockCloudinaryUpload,
            upload_stream: mockCloudinaryUploadStream,
        },
    },
}));

vi.mock('@/lib/gangAccess');
vi.mock('@/lib/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'upload:test'),
    getClientIp: vi.fn(() => '127.0.0.1'),
}));

import { GET, POST } from '@/app/api/upload/route';
import { requireGangAccess, isGangAccessError } from '@/lib/gangAccess';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('Upload API', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CLOUDINARY_CLOUD_NAME = 'demo';
        process.env.CLOUDINARY_API_KEY = 'key';
        process.env.CLOUDINARY_API_SECRET = 'secret';
        (isGangAccessError as any).mockImplementation((error: any) => Boolean(error?.status));
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: 'gang-1', discordGuildId: 'guild-1', name: 'Gang One' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    it('returns 405 for GET requests', async () => {
        const response = await GET();

        expect(response.status).toBe(405);
        expect(await response.json()).toMatchObject({ error: 'Method not allowed' });
    });

    it('returns 400 when the upload request is invalid', async () => {
        const formData = new FormData();
        formData.append('url', 'https://cdn.discordapp.com/test.png');

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'Invalid upload request' });
    });

    it('returns 403 when gang authorization fails', async () => {
        (requireGangAccess as any).mockRejectedValue({ message: 'Forbidden', status: 403 });

        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('url', 'https://cdn.discordapp.com/icons/guild/image.png');

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(403);
        expect(await response.json()).toMatchObject({ error: 'Forbidden' });
        expect(mockCloudinaryUpload).not.toHaveBeenCalled();
    });

    it('returns 429 when the durable upload rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('url', 'https://cdn.discordapp.com/icons/guild/image.png');

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(429);
        expect(await response.json()).toMatchObject({ error: 'Too Many Requests' });
        expect(mockCloudinaryUpload).not.toHaveBeenCalled();
    });

    it('rejects remote uploads from unsupported hosts', async () => {
        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('url', 'https://example.com/logo.png');

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({
            error: 'Only HTTPS Discord CDN image URLs are supported',
        });
        expect(mockCloudinaryUpload).not.toHaveBeenCalled();
    });

    it('rejects non-image file uploads', async () => {
        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('file', new File(['not-an-image'], 'notes.txt', { type: 'text/plain' }));

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' });
    });

    it('rejects svg file uploads even when the browser labels them as images', async () => {
        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('file', new File(['<svg></svg>'], 'logo.svg', { type: 'image/svg+xml' }));

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' });
        expect(mockCloudinaryUploadStream).not.toHaveBeenCalled();
    });

    it('discards remote uploads when Cloudinary reports an unsupported image format', async () => {
        mockCloudinaryUpload.mockResolvedValue({
            secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/gang-logos/gang-1/logo.svg',
            public_id: 'gang-logos/gang-1/logo',
            width: 512,
            height: 512,
            format: 'svg',
            resource_type: 'image',
        });
        mockCloudinaryDestroy.mockResolvedValue({});

        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('url', 'https://cdn.discordapp.com/icons/guild/logo.svg');

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(400);
        expect(await response.json()).toMatchObject({ error: 'Only PNG, JPG, WEBP, or GIF images are allowed' });
        expect(mockCloudinaryDestroy).toHaveBeenCalledWith('gang-logos/gang-1/logo', { resource_type: 'image' });
    });

    it('uploads Discord CDN URLs into a gang-scoped folder and returns a sanitized payload', async () => {
        mockCloudinaryUpload.mockResolvedValue({
            secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/gang-logos/gang-1/logo.png',
            public_id: 'gang-logos/gang-1/logo',
            width: 512,
            height: 512,
            format: 'png',
            resource_type: 'image',
            bytes: 12345,
        });

        const formData = new FormData();
        formData.append('gangId', 'gang-1');
        formData.append('url', 'https://cdn.discordapp.com/icons/guild/logo.png');

        const response = await POST(
            new Request('http://localhost/api/upload', {
                method: 'POST',
                body: formData,
            }) as any
        );

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
            secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/gang-logos/gang-1/logo.png',
            public_id: 'gang-logos/gang-1/logo',
            width: 512,
            height: 512,
            format: 'png',
            resource_type: 'image',
        });
        expect(mockCloudinaryUpload).toHaveBeenCalledWith(
            'https://cdn.discordapp.com/icons/guild/logo.png',
            expect.objectContaining({
                folder: 'gang-logos/gang-1',
                resource_type: 'image',
            })
        );
    });
});
