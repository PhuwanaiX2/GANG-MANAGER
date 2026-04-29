import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
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
    logInfo: vi.fn(),
    logWarn: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'server-transfer:test'),
}));
vi.mock('@gang/database', () => ({
    db: {
        query: {},
        delete: vi.fn(),
        update: vi.fn(),
        transaction: vi.fn(),
    },
    gangs: { id: 'gangs.id' },
    members: {
        id: 'members.id',
        gangId: 'members.gangId',
        isActive: 'members.isActive',
        status: 'members.status',
    },
    attendanceSessions: { id: 'attendanceSessions.id', gangId: 'attendanceSessions.gangId' },
    transactions: { gangId: 'transactions.gangId' },
    leaveRequests: { gangId: 'leaveRequests.gangId' },
    attendanceRecords: { sessionId: 'attendanceRecords.sessionId' },
    gangSettings: { id: 'gangSettings.id' },
    gangRoles: {
        gangId: 'gangRoles.gangId',
        permissionLevel: 'gangRoles.permissionLevel',
    },
}));

import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { DELETE, GET, PATCH, POST } from '@/app/api/gangs/[gangId]/server-transfer/route';

describe('/api/gangs/[gangId]/server-transfer owner gates', () => {
    const gangId = 'gang-123';
    const originalBotToken = process.env.DISCORD_BOT_TOKEN;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
        process.env.DISCORD_BOT_TOKEN = originalBotToken;
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'user-123', name: 'Not Owner' },
        });
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (db as any).delete = vi.fn();
        (db as any).update = vi.fn();
        (db as any).transaction = vi.fn(async (callback: any) => callback({
            get query() {
                return (db as any).query;
            },
            delete: (db as any).delete,
            update: (db as any).update,
        }));
        (db as any).query = {
            gangs: {
                findFirst: vi.fn(),
            },
        };
    });

    const createRequest = (method: string, body?: unknown) => new NextRequest('http://localhost:3000/api', {
        method,
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const allowOwner = () => {
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'owner-discord', name: 'Owner' },
        });
        (requireGangAccess as any).mockResolvedValue({ member: { id: 'owner-1' } });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    };

    const mockReadyGang = () => {
        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    id: gangId,
                    name: 'Midnight Wolves',
                    transferStatus: 'NONE',
                    settings: { announcementChannelId: 'announce-1' },
                }),
            },
            members: {
                findMany: vi.fn().mockResolvedValue([
                    { id: 'owner-1', name: 'Boss', gangRole: 'OWNER', discordId: 'owner-discord' },
                    { id: 'member-1', name: 'Member', gangRole: 'MEMBER', discordId: 'member-discord' },
                ]),
            },
        };
    };

    it('rejects starting a server transfer before destructive DB work when caller is not owner', async () => {
        const res = await POST(createRequest('POST', { deadlineDays: 3 }), {
            params: { gangId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect((db as any).query.gangs.findFirst).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('rejects reading transfer status before DB lookup when caller is not owner', async () => {
        const res = await GET(createRequest('GET'), {
            params: { gangId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect((db as any).query.gangs.findFirst).not.toHaveBeenCalled();
    });

    it('rejects cancelling a server transfer before DB lookup when caller is not owner', async () => {
        const res = await DELETE(createRequest('DELETE'), {
            params: { gangId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect((db as any).query.gangs.findFirst).not.toHaveBeenCalled();
    });

    it('rejects completing a server transfer before DB lookup when caller is not owner', async () => {
        const res = await PATCH(createRequest('PATCH'), {
            params: { gangId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(enforceRouteRateLimit).not.toHaveBeenCalled();
        expect((db as any).query.gangs.findFirst).not.toHaveBeenCalled();
    });

    it('rate limits server-transfer mutation paths before DB lookup', async () => {
        (requireGangAccess as any).mockResolvedValue({ member: { id: 'owner-1' } });
        (enforceRouteRateLimit as any).mockResolvedValue(
            new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            })
        );

        for (const [method, handler, body] of [
            ['POST', POST, { deadlineDays: 3 }],
            ['DELETE', DELETE, undefined],
            ['PATCH', PATCH, undefined],
        ] as const) {
            vi.clearAllMocks();
            (getServerSession as any).mockResolvedValue({
                user: { discordId: 'owner-discord', name: 'Owner' },
            });
            (requireGangAccess as any).mockResolvedValue({ member: { id: 'owner-1' } });
            (enforceRouteRateLimit as any).mockResolvedValue(
                new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                    status: 429,
                    headers: { 'Content-Type': 'application/json' },
                })
            );
            (db as any).query = {
                gangs: {
                    findFirst: vi.fn(),
                },
            };

            const res = await handler(createRequest(method, body), { params: { gangId } });

            expect(res.status).toBe(429);
            expect((db as any).query.gangs.findFirst).not.toHaveBeenCalled();
            expect((db as any).delete).not.toHaveBeenCalled();
            expect((db as any).update).not.toHaveBeenCalled();
        }
    });

    it('rejects starting transfer before destructive DB work when gang-name confirmation is missing', async () => {
        (requireGangAccess as any).mockResolvedValue({ member: { id: 'owner-1' } });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    id: gangId,
                    name: 'Midnight Wolves',
                    transferStatus: 'NONE',
                    settings: {},
                }),
            },
        };

        const res = await POST(createRequest('POST', { deadlineDays: 3, confirmationText: 'wrong name' }), {
            params: { gangId },
        });
        const body = await res.json();

        expect(res.status).toBe(400);
        expect(body.error).toContain('ชื่อแก๊ง');
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('rejects invalid transfer deadlines before destructive DB work', async () => {
        allowOwner();
        mockReadyGang();

        const res = await POST(createRequest('POST', {
            deadlineDays: -1,
            confirmationText: 'Midnight Wolves',
        }), {
            params: { gangId },
        });

        expect(res.status).toBe(400);
        expect((db as any).query.members.findMany).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('requires Discord announcement capability before destructive DB work', async () => {
        allowOwner();
        mockReadyGang();
        delete process.env.DISCORD_BOT_TOKEN;

        const res = await POST(createRequest('POST', {
            deadlineDays: 3,
            confirmationText: 'Midnight Wolves',
        }), {
            params: { gangId },
        });

        expect(res.status).toBe(503);
        expect((db as any).query.members.findMany).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('does not delete data when Discord announcement fails', async () => {
        allowOwner();
        mockReadyGang();
        process.env.DISCORD_BOT_TOKEN = 'bot-token';
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing permissions', { status: 403 })));

        const res = await POST(createRequest('POST', {
            deadlineDays: 3,
            confirmationText: 'Midnight Wolves',
        }), {
            params: { gangId },
        });

        expect(res.status).toBe(502);
        expect(fetch).toHaveBeenCalledWith(
            'https://discord.com/api/v10/channels/announce-1/messages',
            expect.objectContaining({ method: 'POST' })
        );
        expect((db as any).delete).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('disables the Discord announcement if starting transfer fails after posting it', async () => {
        allowOwner();
        mockReadyGang();
        process.env.DISCORD_BOT_TOKEN = 'bot-token';
        vi.stubGlobal('fetch', vi.fn()
            .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'message-1' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
            .mockResolvedValueOnce(new Response('{}', {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
            }))
        );
        (db as any).delete = vi.fn(() => {
            throw new Error('database is down');
        });

        const res = await POST(createRequest('POST', {
            deadlineDays: 3,
            confirmationText: 'Midnight Wolves',
        }), {
            params: { gangId },
        });

        expect(res.status).toBe(500);
        expect(fetch).toHaveBeenNthCalledWith(
            1,
            'https://discord.com/api/v10/channels/announce-1/messages',
            expect.objectContaining({ method: 'POST' })
        );
        expect(fetch).toHaveBeenNthCalledWith(
            2,
            'https://discord.com/api/v10/channels/announce-1/messages/message-1',
            expect.objectContaining({
                method: 'PATCH',
                body: expect.stringContaining('เริ่มย้ายเซิร์ฟไม่สำเร็จ'),
            })
        );
    });
});
