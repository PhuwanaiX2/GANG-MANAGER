import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/gangs/[gangId]/leaves/route';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@gang/database', () => {
    class CreateLeaveRequestError extends Error {
        statusCode: number;

        constructor(message: string, statusCode: number) {
            super(message);
            this.statusCode = statusCode;
        }
    }

    return {
        db: {
            query: {},
            update: vi.fn(() => ({
                set: vi.fn(() => ({
                    where: vi.fn().mockResolvedValue(undefined),
                })),
            })),
        },
        gangs: {
            id: 'gangs.id',
        },
        members: {
            gangId: 'members.gangId',
            discordId: 'members.discordId',
            isActive: 'members.isActive',
            status: 'members.status',
        },
        leaveRequests: {
            id: 'leaveRequests.id',
            gangId: 'leaveRequests.gangId',
        },
        createLeaveRequest: vi.fn(),
        CreateLeaveRequestError,
        buildLeaveRequestDiscordEmbed: vi.fn(() => ({
            title: 'แจ้งเข้าช้า',
            description: 'mock embed',
            color: 0xFEE75C,
            footer: { text: 'mock footer' },
        })),
    };
});
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'leaves-create:test'),
}));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { db, createLeaveRequest, CreateLeaveRequestError } from '@gang/database';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';

global.fetch = vi.fn();

describe('POST /api/gangs/[gangId]/leaves', () => {
    const mockGangId = 'gang-123';
    const mockUserId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
        (isFeatureEnabled as any).mockResolvedValue(true);
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: vi.fn().mockResolvedValue({ id: 'discord-message-1' }),
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        delete process.env.DISCORD_BOT_TOKEN;
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    it('should return 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const req = createRequest({ type: 'FULL', startDate: '2025-01-02', endDate: '2025-01-02' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(401);
    });

    it('should rate limit leave creation before member lookup and service writes', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member A' } });
        (enforceRouteRateLimit as any).mockResolvedValue(new Response(
            JSON.stringify({ error: 'Too Many Requests' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        ));

        const findMember = vi.fn();
        (db as any).query = {
            members: { findFirst: findMember },
        };

        const req = createRequest({ type: 'FULL', startDate: '2025-01-02', endDate: '2025-01-02' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(findMember).not.toHaveBeenCalled();
        expect(createLeaveRequest).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return 404 if the current member is not found', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue(null) },
        };

        const req = createRequest({ type: 'FULL', startDate: '2025-01-02', endDate: '2025-01-02' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(404);
        await expect(res.json()).resolves.toMatchObject({ error: 'ไม่พบสมาชิกในแก๊งนี้' });
    });

    it('should return 400 for invalid payload', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Member A' }) },
        };

        const req = createRequest({ type: 'LATE', lateDate: '2025-01-02' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(400);
    });

    it('should create a full-day leave request for a member', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member A' } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Member A', discordId: 'discord-1' }) },
            gangs: { findFirst: vi.fn().mockResolvedValue(null) },
        };
        (createLeaveRequest as any).mockResolvedValue({
            createdRequest: {
                id: 'leave-1',
                type: 'FULL',
                startDate: new Date('2025-01-01T17:00:00.000Z'),
                endDate: new Date('2025-01-02T16:59:59.999Z'),
                reason: 'พักรักษาตัว',
            },
        });

        const req = createRequest({
            type: 'FULL',
            startDate: '2025-01-02',
            endDate: '2025-01-02',
            reason: 'พักรักษาตัว',
        });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(201);
        expect(createLeaveRequest).toHaveBeenCalledWith(db, expect.objectContaining({
            gangId: mockGangId,
            memberId: 'member-1',
            type: 'FULL',
            actorDiscordId: mockUserId,
            actorName: 'Member A',
            reason: 'พักรักษาตัว',
        }));

        const call = (createLeaveRequest as any).mock.calls[0][1];
        expect(call.startDate).toBeInstanceOf(Date);
        expect(call.endDate).toBeInstanceOf(Date);
        expect(call.startDate.toISOString()).toBe('2025-01-01T17:00:00.000Z');
        expect(call.endDate.toISOString()).toBe('2025-01-02T16:59:59.999Z');
    });

    it('should create a late leave request and notify Discord when a requests channel exists', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member A' } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Member A', discordId: 'discord-1' }) },
            gangs: { findFirst: vi.fn().mockResolvedValue({ settings: { requestsChannelId: 'channel-1' } }) },
        };
        process.env.DISCORD_BOT_TOKEN = 'mock-token';
        (createLeaveRequest as any).mockResolvedValue({
            createdRequest: {
                id: 'leave-late-1',
                type: 'LATE',
                startDate: new Date('2025-01-02T13:00:00.000Z'),
                endDate: new Date('2025-01-02T13:00:00.000Z'),
                reason: 'รถติด',
            },
        });

        const req = createRequest({
            type: 'LATE',
            lateDate: '2025-01-02',
            lateTime: '20:00',
            reason: 'รถติด',
        });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(201);
        expect(createLeaveRequest).toHaveBeenCalledWith(db, expect.objectContaining({
            type: 'LATE',
            memberId: 'member-1',
        }));
        expect(global.fetch).toHaveBeenCalled();
    });

    it('should keep creating leave requests and log a warning when Discord notification fails', async () => {
        const notificationError = new Error('discord unavailable');
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member A' } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Member A', discordId: 'discord-1' }) },
            gangs: { findFirst: vi.fn().mockResolvedValue({ settings: { requestsChannelId: 'channel-1' } }) },
        };
        process.env.DISCORD_BOT_TOKEN = 'mock-token';
        (global.fetch as any).mockRejectedValue(notificationError);
        (createLeaveRequest as any).mockResolvedValue({
            createdRequest: {
                id: 'leave-1',
                type: 'FULL',
                startDate: new Date('2025-01-01T17:00:00.000Z'),
                endDate: new Date('2025-01-02T16:59:59.999Z'),
                reason: null,
            },
        });

        const req = createRequest({ type: 'FULL', startDate: '2025-01-02', endDate: '2025-01-02' });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(201);
        expect(logWarn).toHaveBeenCalledWith('api.leaves.create.notification_failed', expect.objectContaining({
            gangId: mockGangId,
            memberId: 'member-1',
            requestId: 'leave-1',
            error: notificationError,
        }));
    });

    it('should log unexpected create failures through the structured logger', async () => {
        const error = new Error('database unavailable');
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Member A' }) },
        };
        (createLeaveRequest as any).mockRejectedValue(error);

        const req = createRequest({
            type: 'FULL',
            startDate: '2025-01-02',
            endDate: '2025-01-02',
        });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(500);
        expect(logError).toHaveBeenCalledWith('api.leaves.create.failed', error, {
            gangId: mockGangId,
        });
    });

    it('should surface shared create errors from the leave service', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (db as any).query = {
            members: { findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Member A' }) },
        };
        (createLeaveRequest as any).mockRejectedValue(new CreateLeaveRequestError('มีรายการลาช่วงนี้อยู่แล้ว', 409));

        const req = createRequest({
            type: 'FULL',
            startDate: '2025-01-02',
            endDate: '2025-01-02',
        });
        const res = await POST(req, { params: { gangId: mockGangId } });

        expect(res.status).toBe(409);
        await expect(res.json()).resolves.toMatchObject({ error: 'มีรายการลาช่วงนี้อยู่แล้ว' });
    });
});
