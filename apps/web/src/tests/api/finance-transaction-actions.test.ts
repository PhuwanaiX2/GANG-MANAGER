import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRestPost } = vi.hoisted(() => ({
    mockRestPost: vi.fn(),
}));

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
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
vi.mock('@/lib/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'finance-transaction:test'),
}));
vi.mock('@/lib/tierGuard', () => ({
    checkTierAccess: vi.fn(),
}));
vi.mock('discord.js', () => {
    class REST {
        setToken() {
            return this;
        }
        post = mockRestPost;
    }

    return { REST };
});
vi.mock('discord-api-types/v10', () => ({
    Routes: {
        userChannels: () => '/users/@me/channels',
        channelMessages: (id: string) => `/channels/${id}/messages`,
    },
}));

import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { checkTierAccess } from '@/lib/tierGuard';
import { PATCH } from '@/app/api/gangs/[gangId]/finance/[transactionId]/route';

describe('PATCH /api/gangs/[gangId]/finance/[transactionId]', () => {
    const gangId = 'gang-123';
    const transactionId = 'txn-123';

    const createRequest = (body: unknown) =>
        new NextRequest(`http://localhost:3000/api/gangs/${gangId}/finance/${transactionId}`, {
            method: 'PATCH',
            body: JSON.stringify(body),
        });

    beforeEach(() => {
        vi.clearAllMocks();
        mockRestPost.mockResolvedValue({ id: 'dm-channel-1' });

        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'user-123', name: 'Treasurer' },
        });
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: gangId },
            member: { id: 'member-123', discordId: 'user-123' },
            session: { user: { discordId: 'user-123', name: 'Treasurer' } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (checkTierAccess as any).mockResolvedValue({
            allowed: true,
        });

        (db as any).query = {
            transactions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: transactionId,
                    status: 'PENDING',
                    type: 'LOAN',
                    amount: 500,
                    memberId: null,
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: 'member-123' }),
            },
        };
        (db.update as any) = vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        }));
        (db.insert as any) = vi.fn(() => ({
            values: vi.fn().mockResolvedValue(undefined),
        }));
    });

    it('returns 401 when the requester is unauthenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Unauthorized', 401));

        const res = await PATCH(createRequest({ action: 'APPROVE' }), {
            params: { gangId, transactionId },
        });

        expect(res.status).toBe(401);
    });

    it('returns 403 before rate limiting or DB lookup when the requester is not a treasurer or owner', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const res = await PATCH(createRequest({ action: 'APPROVE' }), {
            params: { gangId, transactionId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'TREASURER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect(db.query.transactions.findFirst).not.toHaveBeenCalled();
    });

    it('returns 429 when the durable finance transaction rate limit is exceeded', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        const res = await PATCH(createRequest({ action: 'APPROVE' }), {
            params: { gangId, transactionId },
        });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(db.query.transactions.findFirst).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid action', async () => {
        const res = await PATCH(createRequest({ action: 'MAYBE' }), {
            params: { gangId, transactionId },
        });

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({ error: 'Invalid action' });
        expect(checkTierAccess).not.toHaveBeenCalled();
    });

    it('returns 403 before DB lookup when approving after finance access is no longer available', async () => {
        (checkTierAccess as any).mockResolvedValue({
            allowed: false,
            message: 'Upgrade required',
        });

        const res = await PATCH(createRequest({ action: 'APPROVE' }), {
            params: { gangId, transactionId },
        });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Upgrade required', upgrade: true });
        expect(checkTierAccess).toHaveBeenCalledWith(gangId, 'finance');
        expect(db.query.transactions.findFirst).not.toHaveBeenCalled();
    });

    it('returns 409 when the transaction has already been processed', async () => {
        (db.query.transactions.findFirst as any).mockResolvedValue({
            id: transactionId,
            status: 'APPROVED',
            type: 'LOAN',
            amount: 500,
            memberId: 'member-1',
        });

        const res = await PATCH(createRequest({ action: 'APPROVE' }), {
            params: { gangId, transactionId },
        });

        expect(res.status).toBe(409);
        await expect(res.json()).resolves.toMatchObject({
            alreadyProcessed: true,
            currentStatus: 'APPROVED',
        });
    });

    it('uses explicit collection-payment wording when notifying rejected DEPOSIT requests', async () => {
        const previousToken = process.env.DISCORD_BOT_TOKEN;
        process.env.DISCORD_BOT_TOKEN = 'test-token';

        mockRestPost
            .mockResolvedValueOnce({ id: 'dm-channel-1' })
            .mockResolvedValueOnce({});
        (db.query.transactions.findFirst as any).mockResolvedValue({
            id: transactionId,
            status: 'PENDING',
            type: 'DEPOSIT',
            amount: 500,
            memberId: 'member-1',
        });
        (db.query.members.findFirst as any).mockResolvedValue({
            discordId: 'discord-member-1',
            name: 'Alice',
        });

        try {
            const res = await PATCH(createRequest({ action: 'REJECT' }), {
                params: { gangId, transactionId },
            });

            expect(res.status).toBe(200);
            expect(mockRestPost).toHaveBeenNthCalledWith(2, '/channels/dm-channel-1/messages', {
                body: {
                    content: expect.stringContaining('คำขอชำระค่าเก็บเงินแก๊ง / ฝากเครดิต'),
                },
            });
        } finally {
            if (previousToken === undefined) {
                delete process.env.DISCORD_BOT_TOKEN;
            } else {
                process.env.DISCORD_BOT_TOKEN = previousToken;
            }
        }
    });
});
