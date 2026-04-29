import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

import { POST as createGangFee } from '../../app/api/gangs/[gangId]/finance/gang-fee/route';
import { POST as settleGangFee } from '../../app/api/gangs/[gangId]/finance/gang-fee/settle/route';

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
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'gang-fee:test'),
}));

vi.mock('nanoid', () => ({ nanoid: () => 'batch-123' }));
vi.mock('discord.js', () => {
    class REST {
        setToken() {
            return this;
        }
        post = vi.fn().mockResolvedValue({});
    }
    return { REST };
});
vi.mock('discord-api-types/v10', () => ({
    Routes: { channelMessages: (id: string) => `/channels/${id}/messages` },
}));

import { getServerSession } from 'next-auth';
import { createCollectionBatch, waiveCollectionDebt, db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('Gang fee flow (create + settle)', () => {
    const mockGangId = 'gang-123';
    const mockUserDiscordId = 'user-123';
    const mockActorMemberId = 'mem-admin-1';

    beforeEach(() => {
        vi.clearAllMocks();

        (checkTierAccess as any).mockResolvedValue({
            allowed: true,
            tier: 'PREMIUM',
            tierConfig: { name: 'Premium' },
            message: undefined,
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { id: mockActorMemberId, discordId: mockUserDiscordId, name: 'Admin' },
            session: { user: { discordId: mockUserDiscordId, name: 'Admin' } },
        });

        (db as any).query = {
            members: {
                findMany: vi.fn().mockResolvedValue([{ id: 'mem-1' }, { id: 'mem-2' }]),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    name: 'Test Gang',
                    settings: { announcementChannelId: null },
                }),
            },
        };

        vi.mocked(createCollectionBatch as any).mockResolvedValue({
            batchId: 'batch-123',
            count: 2,
            totalAmountDue: 200,
        });
        vi.mocked(waiveCollectionDebt as any).mockResolvedValue({
            waived: true,
            amount: 100,
        });
    });

    const createRequest = (body: any) =>
        new NextRequest('http://localhost:3000/api', {
            method: 'POST',
            body: JSON.stringify(body),
        });

    it('create: should return 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Unauthorized', 401));

        const req = createRequest({ amount: 100, description: 'Premium' });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
    });

    it('create: should return 403 before rate limiting when requester cannot manage finance', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const req = createRequest({ amount: 100, description: 'Premium' });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect(createCollectionBatch).not.toHaveBeenCalled();
    });

    it('create: should return 429 when durable gang-fee creation rate limit is exceeded', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const req = createRequest({ amount: 100, description: 'Premium' });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(createCollectionBatch).not.toHaveBeenCalled();
    });

    it('create: should create a collection batch with selected members', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });

        const req = createRequest({ amount: 100, description: 'Premium' });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(json.count).toBe(2);
        expect(json.batchId).toBe('batch-123');

        expect(createCollectionBatch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                gangId: mockGangId,
                title: 'Premium',
                description: 'ตั้งยอดเก็บเงินแก๊ง: Premium',
                amountPerMember: 100,
                memberIds: ['mem-1', 'mem-2'],
                actorId: mockActorMemberId,
            })
        );
    });

    it('create: should create a fine collection with selected members only', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });

        const req = createRequest({
            amount: 150,
            description: 'Rule violation',
            collectionType: 'FINE',
            memberIds: ['mem-2'],
        });
        const res = await createGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.collectionType).toBe('FINE');
        expect(createCollectionBatch).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                gangId: mockGangId,
                title: 'Rule violation',
                description: 'ค่าปรับสมาชิก: Rule violation',
                amountPerMember: 150,
                memberIds: ['mem-2'],
                actorId: mockActorMemberId,
            })
        );
    });

    it('settle: should return 429 when durable gang-fee settle rate limit is exceeded', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const req = createRequest({ memberId: 'mem-1', batchId: 'batch-123' });
        const res = await settleGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(waiveCollectionDebt).not.toHaveBeenCalled();
    });

    it('settle: should return 403 before rate limiting when requester cannot manage finance', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const req = createRequest({ memberId: 'mem-1', batchId: 'batch-123' });
        const res = await settleGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect(waiveCollectionDebt).not.toHaveBeenCalled();
    });

    it('settle: should call waiveCollectionDebt and return success', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });

        const req = createRequest({ memberId: 'mem-1', batchId: 'batch-123' });
        const res = await settleGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.success).toBe(true);
        expect(waiveCollectionDebt).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                gangId: mockGangId,
                memberId: 'mem-1',
                batchId: 'batch-123',
                actorId: mockActorMemberId,
            })
        );
    });

    it('settle: should map not-found debt to 404', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserDiscordId, name: 'Admin' } });
        vi.mocked(waiveCollectionDebt as any).mockRejectedValue(
            new Error('ไม่พบหนี้เก็บเงินแก๊งที่ยังค้างอยู่')
        );

        const req = createRequest({ memberId: 'mem-1', batchId: 'batch-123' });
        const res = await settleGangFee(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(404);
        const json = await res.json();
        expect(json.error).toContain('ไม่พบหนี้เก็บเงินแก๊ง');
    });
});
