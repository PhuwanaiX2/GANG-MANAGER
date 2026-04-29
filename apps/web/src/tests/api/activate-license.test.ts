import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/gangAccess', () => {
    class GangAccessError extends Error {
        constructor(
            message: string,
            public readonly status: number
        ) {
            super(message);
            this.name = 'GangAccessError';
        }
    }

    return {
        GangAccessError,
        isGangAccessError: (error: unknown) => error instanceof GangAccessError,
        requireGangAccess: vi.fn(),
    };
});
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'activate-license:test'),
}));

import { getServerSession } from 'next-auth';
import { db, normalizeSubscriptionTier } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { POST } from '@/app/api/gangs/[gangId]/activate-license/route';

describe('POST /api/gangs/[gangId]/activate-license', () => {
    const mockGangId = 'gang-123';
    const mockDiscordId = 'discord-123';
    const setCalls: Array<Record<string, unknown>> = [];
    let insertValuesMock: any;

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api/gangs/gang-123/activate-license', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        setCalls.length = 0;

        (getServerSession as any).mockResolvedValue({ user: { discordId: mockDiscordId } });
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { id: 'member-owner', discordId: mockDiscordId, gangRole: 'OWNER', name: 'Owner' },
            session: { user: { discordId: mockDiscordId, name: 'Owner' } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (normalizeSubscriptionTier as any).mockImplementation((tier: string | null | undefined) => (
            tier === 'TRIAL' ? 'TRIAL' : tier === 'PREMIUM' || tier === 'PRO' ? 'PREMIUM' : 'FREE'
        ));

        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({ gangRole: 'OWNER' }),
            },
            licenses: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'lic-123',
                    key: 'PREMIUM-ABC',
                    tier: 'PREMIUM',
                    durationDays: 30,
                    isActive: true,
                    expiresAt: null,
                }),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    subscriptionTier: 'FREE',
                    subscriptionExpiresAt: null,
                }),
            },
        };

        (db.update as any) = vi.fn(() => ({
            set: vi.fn((payload) => {
                setCalls.push(payload);
                return {
                    where: vi.fn().mockResolvedValue(undefined),
                };
            }),
        }));

        insertValuesMock = vi.fn().mockResolvedValue(undefined);
        (db.insert as any) = vi.fn(() => ({
            values: insertValuesMock,
        }));
    });

    it('returns 401 when unauthenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Unauthorized', 401));

        const res = await POST(createRequest({ licenseKey: 'PREMIUM-ABC' }), { params: { gangId: mockGangId } });
        expect(res.status).toBe(401);
    });

    it('returns 403 when the caller is not the gang owner', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const res = await POST(createRequest({ licenseKey: 'PREMIUM-ABC' }), { params: { gangId: mockGangId } });
        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'OWNER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect((db as any).query.licenses.findFirst).not.toHaveBeenCalled();
    });

    it('returns 429 before license lookup when the activation rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await POST(createRequest({ licenseKey: 'PREMIUM-ABC' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect((db as any).query.licenses.findFirst).not.toHaveBeenCalled();
    });

    it('validates that a license key is provided', async () => {
        const res = await POST(createRequest({ licenseKey: '   ' }), { params: { gangId: mockGangId } });
        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({ error: 'กรุณากรอก License Key' });
    });

    it('returns 404 when the license key does not exist', async () => {
        (db as any).query.licenses.findFirst.mockResolvedValue(null);

        const res = await POST(createRequest({ licenseKey: 'PREMIUM-ABC' }), { params: { gangId: mockGangId } });
        expect(res.status).toBe(404);
    });

    it('rejects inactive or expired license keys', async () => {
        (db as any).query.licenses.findFirst.mockResolvedValueOnce({
            id: 'lic-123',
            key: 'PREMIUM-ABC',
            tier: 'PREMIUM',
            durationDays: 30,
            isActive: false,
            expiresAt: null,
        });

        const inactive = await POST(createRequest({ licenseKey: 'PREMIUM-ABC' }), { params: { gangId: mockGangId } });
        expect(inactive.status).toBe(400);

        (db as any).query.licenses.findFirst.mockResolvedValueOnce({
            id: 'lic-124',
            key: 'PREMIUM-XYZ',
            tier: 'PREMIUM',
            durationDays: 30,
            isActive: true,
            expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
        });

        const expired = await POST(createRequest({ licenseKey: 'PREMIUM-XYZ' }), { params: { gangId: mockGangId } });
        expect(expired.status).toBe(400);
    });

    it('activates the license and stacks remaining premium days', async () => {
        (db as any).query.licenses.findFirst.mockResolvedValue({
            id: 'lic-123',
            key: 'PREMIUM-ABC',
            tier: 'PRO',
            durationDays: 30,
            isActive: true,
            expiresAt: null,
        });
        (db as any).query.gangs.findFirst.mockResolvedValue({
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        });

        const res = await POST(createRequest({ licenseKey: 'premium-abc' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.tier).toBe('PREMIUM');
        expect(json.durationDays).toBe(40);
        expect(json.bonusDays).toBe(10);
        expect(db.update).toHaveBeenCalledTimes(2);
        expect(db.insert).toHaveBeenCalledTimes(1);
        expect(insertValuesMock).toHaveBeenCalledTimes(1);
        expect(setCalls[0]).toMatchObject({ subscriptionTier: 'PREMIUM' });
        expect(setCalls[1]).toMatchObject({ isActive: false });
    });
});
