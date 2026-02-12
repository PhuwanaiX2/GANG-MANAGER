import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from '@/app/api/gangs/[gangId]/leaves/[requestId]/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/permissions');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Imports for mocking
import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';

// Global Fetch Mock
global.fetch = vi.fn();

describe('PATCH /api/gangs/[gangId]/leaves/[requestId]', () => {
    const mockGangId = 'gang-123';
    const mockRequestId = 'req-123';
    const mockUserId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
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
        (getGangPermissions as any).mockResolvedValue({ isAdmin: false, isOwner: false });

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(403);
    });

    it('should return 400 for invalid status', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (getGangPermissions as any).mockResolvedValue({ isAdmin: true });

        const req = createRequest({ status: 'INVALID' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(400);
    });

    it('should return 404 if request not found', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
        (getGangPermissions as any).mockResolvedValue({ isAdmin: true });

        const mockQuery = {
            query: {
                leaveRequests: { findFirst: vi.fn().mockResolvedValue(null) }, // Not found
            }
        };
        // @ts-ignore
        db.query = mockQuery.query;

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });
        expect(res.status).toBe(404);
    });

    it('should update status and send discord log on success', async () => {
        (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });
        (getGangPermissions as any).mockResolvedValue({ isAdmin: true });

        const mockExistingRequest = {
            id: mockRequestId,
            type: 'FULL',
            reason: 'Sick',
            member: { name: 'Member A' }
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

        const mockQuery = {
            query: {
                leaveRequests: { findFirst: vi.fn().mockResolvedValue(mockExistingRequest) },
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
                members: { findFirst: vi.fn().mockResolvedValue({ id: 'reviewer-id' }) }
            },
            update: vi.fn().mockReturnValue({
                set: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                returning: vi.fn().mockResolvedValue([mockUpdatedRequest])
            })
        };

        // Mock DB
        // @ts-ignore
        db.query = mockQuery.query;
        // @ts-ignore
        db.update = mockQuery.update;

        // Mock Process Env
        process.env.DISCORD_BOT_TOKEN = 'mock-token';

        const req = createRequest({ status: 'APPROVED' });
        const res = await PATCH(req, { params: { gangId: mockGangId, requestId: mockRequestId } });

        expect(res.status).toBe(200);
        expect(mockQuery.update).toHaveBeenCalled();
        expect(global.fetch).toHaveBeenCalled(); // Should send log to Discord
    });
});
