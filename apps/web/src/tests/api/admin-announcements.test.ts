import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@gang/database');
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'admin:announcements:test'),
}));

import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('Admin announcements route throttling', () => {
    let GET: typeof import('@/app/api/admin/announcements/route').GET;
    let POST: typeof import('@/app/api/admin/announcements/route').POST;
    let PATCH: typeof import('@/app/api/admin/announcements/route').PATCH;
    let DELETE: typeof import('@/app/api/admin/announcements/route').DELETE;
    let getServerSessionMock: any;
    let dbModule: any;

    const createRequest = (method: string, url: string, body?: unknown) =>
        new NextRequest(url, {
            method,
            body: body ? JSON.stringify(body) : undefined,
        });

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.ADMIN_DISCORD_IDS = 'admin-123';

        const nextAuth = await import('next-auth');
        dbModule = await import('@gang/database');
        ({ GET, POST, PATCH, DELETE } = await import('@/app/api/admin/announcements/route'));

        getServerSessionMock = nextAuth.getServerSession as any;
        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'admin-123', name: 'System Admin' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);

        (dbModule.db as any).query = {
            systemAnnouncements: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };
        (dbModule.db.insert as any) = vi.fn(() => ({
            values: vi.fn().mockResolvedValue(undefined),
        }));
        (dbModule.db.update as any) = vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        }));
        (dbModule.db.delete as any) = vi.fn(() => ({
            where: vi.fn().mockResolvedValue(undefined),
        }));
    });

    it('returns 429 for GET when the durable admin announcements rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await GET(createRequest('GET', 'http://localhost:3000/api/admin/announcements'));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.query.systemAnnouncements.findMany).not.toHaveBeenCalled();
    });

    it('returns 429 for POST when the durable admin announcements rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await POST(createRequest('POST', 'http://localhost:3000/api/admin/announcements', {
            title: 'Hello',
            content: 'World',
        }));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.insert).not.toHaveBeenCalled();
    });

    it('returns 429 for PATCH when the durable admin announcements rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await PATCH(createRequest('PATCH', 'http://localhost:3000/api/admin/announcements', {
            id: 'ann-123',
            isActive: false,
        }));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.update).not.toHaveBeenCalled();
    });

    it('returns 429 for DELETE when the durable admin announcements rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await DELETE(createRequest('DELETE', 'http://localhost:3000/api/admin/announcements?id=ann-123'));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.delete).not.toHaveBeenCalled();
    });
});
