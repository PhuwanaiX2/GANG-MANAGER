import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@gang/database');
vi.mock('nanoid', () => ({ nanoid: vi.fn(() => 'license-123') }));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'admin:licenses:test'),
}));

import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('Admin licenses route throttling', () => {
    let GET: typeof import('@/app/api/admin/licenses/route').GET;
    let POST: typeof import('@/app/api/admin/licenses/route').POST;
    let PATCH: typeof import('@/app/api/admin/licenses/[id]/route').PATCH;
    let DELETE: typeof import('@/app/api/admin/licenses/[id]/route').DELETE;
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
        ({ GET, POST } = await import('@/app/api/admin/licenses/route'));
        ({ PATCH, DELETE } = await import('@/app/api/admin/licenses/[id]/route'));

        getServerSessionMock = nextAuth.getServerSession as any;
        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'admin-123', name: 'System Admin' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);

        (dbModule.db as any).query = {
            licenses: {
                findMany: vi.fn().mockResolvedValue([]),
                findFirst: vi.fn().mockResolvedValue({
                    id: 'license-123',
                    key: 'PREMIUM-AAAA',
                    tier: 'PREMIUM',
                    durationDays: 30,
                    isActive: true,
                    maxMembers: 40,
                }),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ id: 'gang-123' }),
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

    it('returns 429 for GET when the durable admin licenses rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await GET(createRequest('GET', 'http://localhost:3000/api/admin/licenses'));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.query.licenses.findMany).not.toHaveBeenCalled();
    });

    it('returns 429 for POST when the durable admin licenses create rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await POST(createRequest('POST', 'http://localhost:3000/api/admin/licenses', {
            tier: 'PREMIUM',
            durationDays: 30,
        }));

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.insert).not.toHaveBeenCalled();
    });

    it('returns 429 for PATCH when the durable admin license update rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await PATCH(createRequest('PATCH', 'http://localhost:3000/api/admin/licenses/license-123', {
            isActive: false,
        }), { params: { id: 'license-123' } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.query.licenses.findFirst).not.toHaveBeenCalled();
        expect(dbModule.db.update).not.toHaveBeenCalled();
    });

    it('returns 429 for DELETE when the durable admin license delete rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await DELETE(
            createRequest('DELETE', 'http://localhost:3000/api/admin/licenses/license-123'),
            { params: { id: 'license-123' } }
        );

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.query.licenses.findFirst).not.toHaveBeenCalled();
        expect(dbModule.db.delete).not.toHaveBeenCalled();
    });
});
