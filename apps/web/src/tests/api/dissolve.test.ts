import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/gangs/[gangId]/dissolve/route';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
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
    logError: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'dissolve:test'),
}));

vi.mock('discord.js', () => {
    const mockDelete = vi.fn();
    const mockGet = vi.fn();

    return {
        REST: class {
            setToken = vi.fn().mockReturnThis();
            delete = mockDelete;
            get = mockGet;
        },
        _mocks: {
            delete: mockDelete,
            get: mockGet,
        },
    };
});

vi.mock('discord-api-types/v10', () => ({
    Routes: {
        guildRole: (gid: string, rid: string) => `roles/${gid}/${rid}`,
        guildChannels: (gid: string) => `channels/${gid}`,
        channel: (cid: string) => `channels/${cid}`,
    },
}));

import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logWarn } from '@/lib/logger';

describe('Dissolve API', () => {
    const mockGangId = 'gang-123';
    const mockUserId = 'user-123';
    const originalBotToken = process.env.DISCORD_BOT_TOKEN;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DISCORD_BOT_TOKEN = originalBotToken || 'bot-token';

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { discordId: mockUserId },
            session: { user: { discordId: mockUserId } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    const createRequest = (body: any) => new NextRequest('http://localhost:3000/api', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    it('returns 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const res = await POST(createRequest({}), { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
        expect(requireGangAccess).not.toHaveBeenCalled();
    });

    it('returns 403 and logs when requester is not the owner', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const res = await POST(createRequest({}), { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'OWNER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect(logWarn).toHaveBeenCalledWith(
            'api.dissolve.forbidden',
            expect.objectContaining({
                gangId: mockGangId,
                actorDiscordId: mockUserId,
            })
        );
    });

    it('returns 429 before reading gang data when the dissolve rate limit is exceeded', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );
        (db as any).query = {
            gangs: { findFirst: vi.fn() },
        };
        (db as any).delete = vi.fn();

        const res = await POST(createRequest({ deleteData: true }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect((db as any).query.gangs.findFirst).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
    });

    it('rejects dissolve when gang-name confirmation is missing before Discord or DB deletion', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

        const mockGang = {
            id: mockGangId,
            name: 'Midnight Wolves',
            discordGuildId: 'guild-123',
            roles: [{ discordRoleId: 'role-1' }],
            settings: {},
        };

        (db as any).query = {
            gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
        };
        (db as any).delete = vi.fn();
        (db as any).update = vi.fn();

        const Discord = await import('discord.js');
        const mockRestDelete = (Discord as any)._mocks.delete;

        const res = await POST(createRequest({ deleteData: true, confirmationText: 'wrong' }), {
            params: { gangId: mockGangId },
        });

        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('ชื่อแก๊ง') });
        expect(mockRestDelete).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('rejects dissolve before Discord or DB deletion when the bot token is missing', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        delete process.env.DISCORD_BOT_TOKEN;

        const mockGang = {
            id: mockGangId,
            name: 'Midnight Wolves',
            discordGuildId: 'guild-123',
            roles: [{ discordRoleId: 'role-1' }],
            settings: {},
        };

        (db as any).query = {
            gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
        };
        (db as any).delete = vi.fn();
        (db as any).update = vi.fn();

        const Discord = await import('discord.js');
        const mockRestDelete = (Discord as any)._mocks.delete;

        const res = await POST(createRequest({
            deleteData: true,
            confirmationText: 'Midnight Wolves',
        }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(503);
        expect(mockRestDelete).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('dissolves gang and cleans up discord resources', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

        const mockGang = {
            id: mockGangId,
            name: 'Midnight Wolves',
            discordGuildId: 'guild-123',
            roles: [{ discordRoleId: 'role-1' }, { discordRoleId: 'role-2' }],
            settings: {},
        };

        (db as any).query = {
            gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
        };
        (db as any).update = vi.fn().mockReturnValue({
            set: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
        });
        (db as any).delete = vi.fn().mockReturnValue({
            where: vi.fn().mockReturnThis(),
        });

        const Discord = await import('discord.js');
        const mockRestGet = (Discord as any)._mocks.get;
        const mockRestDelete = (Discord as any)._mocks.delete;

        mockRestGet.mockResolvedValue([
            { id: 'cat1', name: '📌 ข้อมูลทั่วไป', type: 4 },
            { id: 'c1', name: 'General', parent_id: 'cat1' },
        ]);

        const res = await POST(createRequest({
            deleteData: true,
            confirmationText: 'Midnight Wolves',
        }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(200);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'OWNER' });
        expect((db as any).delete).toHaveBeenCalled();
        expect(mockRestDelete).toHaveBeenCalledTimes(4);
    });
});
