import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/gangs/[gangId]/leaves/[requestId]/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
vi.mock('next-auth');
vi.mock('@gang/database', () => {
    class LeaveReviewError extends Error {
        statusCode: number;

        constructor(message: string, statusCode: number) {
            super(message);
            this.statusCode = statusCode;
        }
    }

    return {
        db: {
            query: {},
            update: vi.fn(),
            insert: vi.fn(),
        },
        gangs: {
            id: 'gangs.id',
        },
        reviewLeaveRequest: vi.fn(),
        buildLeaveReviewDiscordEmbed: vi.fn(() => ({ title: 'reviewed', description: 'done', color: 0x57F287 })),
        LeaveReviewError,
    };
});
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
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'leaves-review:test'),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('nanoid', () => ({ nanoid: () => 'generated-id' }));

// Imports for mocking
import { getServerSession } from 'next-auth';
import { db, reviewLeaveRequest, LeaveReviewError } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

// Global Fetch Mock
global.fetch = vi.fn();

describe('PATCH /api/gangs/[gangId]/leaves/[requestId]', () => {
    const mockGangId = 'gang-123';
    const mockRequestId = 'req-123';
    const mockUserId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
        (isFeatureEnabled as any).mockResolvedValue(true);
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { id: 'admin-member', discordId: mockUserId, gangRole: 'ADMIN' },
            session: { user: { discordId: mockUserId, name: 'Admin' } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api', {
            method: 'PATCH',
            body: JSON.stringify(body),
        });
    };

    it('should return 401 if not authenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);
        const req = createRequest({});
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(401);
    });

    it('should return 403 if user is not Admin/Owner', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
        expect(reviewLeaveRequest).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid status', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

        const req = createRequest({ status: 'INVALID' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(400);
    });

    it('should rate limit leave reviews before service mutation and notifications', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });
        (enforceRouteRateLimit as any).mockResolvedValue(new Response(
            JSON.stringify({ error: 'Too Many Requests' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        ));

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
        expect(reviewLeaveRequest).not.toHaveBeenCalled();
        expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should return 404 if request not found', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (reviewLeaveRequest as any).mockRejectedValue(new LeaveReviewError('ไม่พบคำขอลา', 404));

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(404);
    });

    it('should return 409 when the leave request has already been processed', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (reviewLeaveRequest as any).mockRejectedValue(new LeaveReviewError('คำขอลานี้ถูกดำเนินการไปแล้ว (อนุมัติแล้ว)', 409));

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });

        expect(res.status).toBe(409);
        await expect(res.json()).resolves.toMatchObject({
            error: expect.stringContaining('ถูกดำเนินการไปแล้ว'),
        });
    });

    it('should update status and send discord log on success', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

        const mockExistingRequest = {
            id: mockRequestId,
            status: 'PENDING',
            type: 'FULL',
            reason: 'Sick',
            memberId: 'member-1',
            member: { name: 'Member A', discordId: 'discord-1' },
            requestsChannelId: 'requests-channel-1',
            requestsMessageId: 'requests-message-1',
        };

        const mockUpdatedRequest = {
            ...mockExistingRequest,
            status: 'APPROVED',
            startDate: new Date(),
            endDate: new Date(),
        };

        const mockGang = {
            settings: { logChannelId: 'channel-123' }
        };

        // Mock DB
        (db as any).query = {
            gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
        };
        (reviewLeaveRequest as any).mockResolvedValue({
            leaveRequest: mockExistingRequest,
            updatedRequest: mockUpdatedRequest,
            reviewer: { id: 'reviewer-id' },
        });

        // Mock Process Env
        process.env.DISCORD_BOT_TOKEN = 'mock-token';

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });

        expect(res.status).toBe(200);
        expect(reviewLeaveRequest).toHaveBeenCalledWith(db, expect.objectContaining({
            gangId: mockGangId,
            requestId: mockRequestId,
            status: 'APPROVED',
            reviewerDiscordId: mockUserId,
        }));
        expect(global.fetch).toHaveBeenCalled(); // Should send log to Discord
    });
});
