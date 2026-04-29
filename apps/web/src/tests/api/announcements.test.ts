import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/gangs/[gangId]/announcements/route';

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
    buildRateLimitSubject: vi.fn(() => 'announcements:test'),
}));

import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logWarn } from '@/lib/logger';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

global.fetch = vi.fn();

describe('POST /api/gangs/[gangId]/announcements', () => {
    const mockGangId = 'gang-123';
    const insertReturning = vi.fn();
    const insertValues = vi.fn(() => ({ returning: insertReturning }));

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.DISCORD_BOT_TOKEN = 'mock-token';

        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'user-123', name: 'Admin User' },
        });
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { discordId: 'user-123' },
            session: { user: { discordId: 'user-123', name: 'Admin User' } },
        });
        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    id: mockGangId,
                    settings: { announcementChannelId: 'channel-123' },
                }),
            },
        };
        (db as any).insert = vi.fn(() => ({ values: insertValues }));
        insertReturning.mockResolvedValue([{ id: 'ann-1', content: 'announcement', discordMessageId: 'discord-msg-1' }]);
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ id: 'discord-msg-1', mention_everyone: true }),
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    const createRequest = (body: Record<string, unknown>) => new NextRequest('http://localhost:3000/api', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    it('returns 401 when user is not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const res = await POST(createRequest({ content: 'announcement' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
        expect(requireGangAccess).not.toHaveBeenCalled();
    });

    it('returns 400 for empty content before checking permissions', async () => {
        const res = await POST(createRequest({ content: '' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
        expect(requireGangAccess).not.toHaveBeenCalled();
    });

    it('returns 403 when user lacks announcement permission', async () => {
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const res = await POST(createRequest({ content: 'announcement' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
    });

    it('returns 429 before gang lookup, Discord post, and database insert when rate limited', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(new Response(
            JSON.stringify({ error: 'Too Many Requests' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        ));
        const findGang = (db as any).query.gangs.findFirst;

        const res = await POST(createRequest({ content: 'announcement' }), { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
        expect(findGang).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
        expect((db as any).insert).not.toHaveBeenCalled();
    });

    it('does not append @everyone unless explicitly requested', async () => {
        const res = await POST(createRequest({ content: 'Important announcement', mentionEveryone: false }), { params: { gangId: mockGangId } });
        const [, init] = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(init.body);

        expect(res.status).toBe(200);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
        expect(body.content).toBe('# Important announcement');
        expect(body.content).not.toContain('@everyone');
        expect(body.allowed_mentions).toEqual({ parse: [] });
    });

    it('sends @everyone with allowed mentions when explicitly requested', async () => {
        const res = await POST(createRequest({ content: 'Important announcement', mentionEveryone: true }), { params: { gangId: mockGangId } });
        const [, init] = (global.fetch as any).mock.calls[0];
        const body = JSON.parse(init.body);

        expect(res.status).toBe(200);
        expect(body.content).toBe('@everyone\n# Important announcement');
        expect(body.allowed_mentions).toEqual({ parse: ['everyone'] });
    });

    it('warns when Discord accepts the message but does not apply @everyone', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ id: 'discord-msg-1', mention_everyone: false }),
        });

        const res = await POST(createRequest({ content: 'Important announcement', mentionEveryone: true }), { params: { gangId: mockGangId } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.discord).toMatchObject({
            posted: true,
            mentionEveryoneRequested: true,
            warning: 'mention_everyone_not_applied',
        });
        expect(logWarn).toHaveBeenCalledWith(
            'api.announcements.discord_mention_everyone_not_applied',
            expect.objectContaining({
                gangId: mockGangId,
                actorDiscordId: 'user-123',
                channelId: 'channel-123',
                discordMessageId: 'discord-msg-1',
            })
        );
    });

    it('keeps saving the announcement when Discord responds with a failure', async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            status: 500,
            text: vi.fn().mockResolvedValue('discord failed'),
        });

        const res = await POST(createRequest({ content: 'Important announcement', mentionEveryone: true }), { params: { gangId: mockGangId } });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);
        expect(logWarn).toHaveBeenCalledWith(
            'api.announcements.discord_post_failed',
            expect.objectContaining({
                gangId: mockGangId,
                actorDiscordId: 'user-123',
                channelId: 'channel-123',
                mentionEveryone: true,
                statusCode: 500,
                responseBody: 'discord failed',
            })
        );
    });
});
