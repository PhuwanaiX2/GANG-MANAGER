import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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

vi.mock('@gang/database', () => ({
    db: {
        update: vi.fn(),
    },
    gangs: {
        id: 'gangs.id',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: vi.fn((column, value) => ({ column, value })),
}));

vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
}));

vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'gang-settings:test'),
}));

import { db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError } from '@/lib/logger';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { PUT } from '@/app/api/gangs/[gangId]/route';

describe('PUT /api/gangs/[gangId]', () => {
    const mockGangId = 'gang-123';
    const mockDiscordId = 'discord-123';
    let updateSet: ReturnType<typeof vi.fn>;
    let updateWhere: ReturnType<typeof vi.fn>;

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api/gangs/gang-123', {
        method: 'PUT',
        body: JSON.stringify(body),
    });

    beforeEach(() => {
        vi.clearAllMocks();

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { discordId: mockDiscordId },
            session: { user: { discordId: mockDiscordId } },
        });

        updateWhere = vi.fn().mockResolvedValue(undefined);
        updateSet = vi.fn(() => ({ where: updateWhere }));
        (db.update as any).mockReturnValue({ set: updateSet });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    it('returns 401 when the caller is unauthenticated', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Unauthorized', 401));

        const res = await PUT(createRequest({ name: 'New Gang' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
        expect(db.update).not.toHaveBeenCalled();
    });

    it('returns 403 when the caller is not the owner', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const res = await PUT(createRequest({ name: 'New Gang' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({
            error: 'Forbidden: Only Owner can update gang settings',
        });
        expect(db.update).not.toHaveBeenCalled();
    });

    it('validates update payload before writing', async () => {
        const res = await PUT(createRequest({ logoUrl: 'not-a-url' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
        expect(db.update).not.toHaveBeenCalled();
    });

    it('returns 429 before parsing payload and writing when the owner update is rate limited', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(new Response(
            JSON.stringify({ error: 'Too Many Requests' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        ));

        const res = await PUT(createRequest({ name: 'New Gang' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'OWNER' });
        expect(db.update).not.toHaveBeenCalled();
    });

    it('updates gang settings for an owner', async () => {
        const res = await PUT(createRequest({ name: 'New Gang', logoUrl: null }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({
            success: true,
            name: 'New Gang',
            logoUrl: null,
        });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'OWNER' });
        expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
            name: 'New Gang',
            logoUrl: null,
            updatedAt: expect.any(Date),
        }));
        expect(updateWhere).toHaveBeenCalledTimes(1);
    });

    it('logs and returns 500 for unexpected errors', async () => {
        const error = new Error('database unavailable');
        (db.update as any).mockImplementation(() => {
            throw error;
        });

        const res = await PUT(createRequest({ name: 'New Gang' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(500);
        expect(logError).toHaveBeenCalledWith('api.gangs.update.failed', error, {
            gangId: mockGangId,
            actorDiscordId: mockDiscordId,
        });
    });
});
