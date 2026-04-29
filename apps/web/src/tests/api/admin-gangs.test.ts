import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@gang/database');
vi.mock('nanoid', () => ({ nanoid: vi.fn(() => 'audit-123') }));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'admin:gangs:test'),
}));

import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

const ERROR_FORBIDDEN = '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e40\u0e02\u0e49\u0e32\u0e16\u0e36\u0e07';

describe('PATCH /api/admin/gangs/[gangId]', () => {
    let PATCH: typeof import('@/app/api/admin/gangs/[gangId]/route').PATCH;
    let getServerSessionMock: any;
    let dbModule: any;
    const setCalls: Array<Record<string, unknown>> = [];

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api/admin/gangs/gang-123', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        setCalls.length = 0;
        process.env.ADMIN_DISCORD_IDS = 'admin-123';

        const nextAuth = await import('next-auth');
        dbModule = await import('@gang/database');
        ({ PATCH } = await import('@/app/api/admin/gangs/[gangId]/route'));

        getServerSessionMock = nextAuth.getServerSession as any;
        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'admin-123', name: 'System Admin' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);

        (dbModule.db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    name: 'Alpha',
                    subscriptionTier: 'PREMIUM',
                    subscriptionExpiresAt: new Date('2026-05-01T00:00:00.000Z'),
                    isActive: true,
                }),
            },
        };

        (dbModule.db.update as any) = vi.fn(() => ({
            set: vi.fn((payload) => {
                setCalls.push(payload);
                return {
                    where: vi.fn().mockResolvedValue(undefined),
                };
            }),
        }));

        (dbModule.db.insert as any) = vi.fn(() => ({
            values: vi.fn().mockResolvedValue(undefined),
        }));
    });

    it('returns 403 when requester is not an admin', async () => {
        getServerSessionMock.mockResolvedValue({ user: { discordId: 'user-999' } });

        const res = await PATCH(createRequest({ subscriptionTier: 'FREE' }), { params: { gangId: 'gang-123' } });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: ERROR_FORBIDDEN });
    });

    it('returns 429 when the durable admin gang rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await PATCH(createRequest({ subscriptionTier: 'TRIAL' }), { params: { gangId: 'gang-123' } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(dbModule.db.update).not.toHaveBeenCalled();
    });

    it('defaults TRIAL to a future 7-day expiry when no expiry is provided', async () => {
        const now = Date.now();

        const res = await PATCH(createRequest({ subscriptionTier: 'TRIAL' }), { params: { gangId: 'gang-123' } });

        expect(res.status).toBe(200);
        expect(dbModule.db.update).toHaveBeenCalledTimes(1);
        expect(setCalls[0]).toMatchObject({ subscriptionTier: 'TRIAL' });
        expect(setCalls[0].subscriptionExpiresAt).toBeInstanceOf(Date);

        const expiryTime = (setCalls[0].subscriptionExpiresAt as Date).getTime();
        expect(expiryTime).toBeGreaterThan(now + 6 * 24 * 60 * 60 * 1000);
        expect(expiryTime).toBeLessThan(now + 8 * 24 * 60 * 60 * 1000);
    });

    it('clears expiry when downgrading a gang to FREE', async () => {
        const res = await PATCH(createRequest({
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: '2026-06-01T00:00:00.000Z',
        }), { params: { gangId: 'gang-123' } });

        expect(res.status).toBe(200);
        expect(setCalls[0]).toMatchObject({ subscriptionTier: 'FREE', subscriptionExpiresAt: null });
    });

    it('clears stale expiry when manually upgrading a gang to permanent PREMIUM', async () => {
        const res = await PATCH(createRequest({ subscriptionTier: 'PREMIUM' }), { params: { gangId: 'gang-123' } });

        expect(res.status).toBe(200);
        expect(setCalls[0]).toMatchObject({ subscriptionTier: 'PREMIUM', subscriptionExpiresAt: null });
    });
});
