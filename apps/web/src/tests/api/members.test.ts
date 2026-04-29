import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as createMember } from '@/app/api/gangs/[gangId]/members/route';
import { PATCH, DELETE } from '@/app/api/gangs/[gangId]/members/[memberId]/route';
import { PATCH as updateMemberRole } from '@/app/api/gangs/[gangId]/members/[memberId]/role/route';
import { PATCH as updateMemberStatus } from '@/app/api/gangs/[gangId]/members/[memberId]/status/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
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
    buildRateLimitSubject: vi.fn(() => 'members:test'),
}));
vi.mock('@/lib/tierGuard', () => ({
    checkTierAccess: vi.fn(),
}));

// Imports for mocking
import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { checkTierAccess } from '@/lib/tierGuard';

// Global Fetch Mock
global.fetch = vi.fn();

describe('Members API', () => {
    const mockGangId = 'gang-123';
    const mockMemberId = 'member-123';
    const mockUserId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.DISCORD_BOT_TOKEN;

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { discordId: mockUserId },
            session: { user: { discordId: mockUserId, name: 'Admin' } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (checkTierAccess as any).mockResolvedValue({ allowed: true });
    });

    const createRequest = (method: string, body?: any) => {
        return new NextRequest('http://localhost:3000/api', {
            method,
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    describe('POST /api/gangs/[gangId]/members', () => {
        it('should return 401 if create member caller is not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);

            const req = createRequest('POST', { name: 'Alice' });
            const res = await createMember(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(401);
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('should reject member creation without admin access before parsing payload', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member' } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

            const mockInsert = vi.fn();
            // @ts-ignore
            db.insert = mockInsert;

            const req = createRequest('POST', { name: 'Alice' });
            const res = await createMember(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(403);
            await expect(res.json()).resolves.toHaveProperty('error');
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('should validate create member payload after authorization', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const mockInsert = vi.fn();
            // @ts-ignore
            db.insert = mockInsert;

            const req = createRequest('POST', { name: '' });
            const res = await createMember(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(400);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(mockInsert).not.toHaveBeenCalled();
        });

        it('should create an approved member for admins', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            (db as any).query = {
                gangs: {
                    findFirst: vi.fn().mockResolvedValue({ transferStatus: 'ACTIVE' }),
                },
            } as any;

            const insertValues = vi.fn().mockResolvedValue(undefined);
            const mockInsert = vi.fn().mockReturnValue({ values: insertValues });
            // @ts-ignore
            db.insert = mockInsert;

            const req = createRequest('POST', { name: ' Alice ', discordUsername: 'alice#1234' });
            const res = await createMember(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            await expect(res.json()).resolves.toMatchObject({ success: true });
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({
                gangId: mockGangId,
                name: 'Alice',
                discordUsername: 'alice#1234',
                status: 'APPROVED',
                isActive: true,
                gangRole: 'MEMBER',
                transferStatus: 'CONFIRMED',
            }));
            expect(mockInsert).toHaveBeenCalledTimes(2);
        });
    });

    describe('PATCH /api/gangs/[gangId]/members/[memberId]', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);
            const req = createRequest('PATCH', {});
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });
            expect(res.status).toBe(401);
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('should reject empty update payloads before checking permissions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const mockUpdate = vi.fn();
            // @ts-ignore
            db.update = mockUpdate;

            const req = createRequest('PATCH', {});
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toMatchObject({ error: 'No member update fields provided' });
            expect(requireGangAccess).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should reject invalid update payloads before writing', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const mockUpdate = vi.fn();
            // @ts-ignore
            db.update = mockUpdate;

            const req = createRequest('PATCH', { balance: '250' });
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toMatchObject({ error: 'Invalid member update payload' });
            expect(requireGangAccess).not.toHaveBeenCalled();
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should update member details successfully', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const mockUpdate = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            // @ts-ignore
            db.update = mockUpdate;
            // @ts-ignore
            db.insert = mockInsert;

            const body = { isActive: true };
            const req = createRequest('PATCH', body);
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(mockUpdate).toHaveBeenCalled();
            expect(mockInsert).toHaveBeenCalled(); // Audit Log
        });

        it('should require treasurer access to update balance', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Treasurer' } });

            const mockUpdate = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            // @ts-ignore
            db.update = mockUpdate;
            // @ts-ignore
            db.insert = mockInsert;

            const req = createRequest('PATCH', { balance: 250 });
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(200);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
            expect(checkTierAccess).toHaveBeenCalledWith(mockGangId, 'finance');
            expect(mockUpdate).toHaveBeenCalled();
            expect(mockInsert).toHaveBeenCalled();
        });

        it('should reject balance updates when finance access is unavailable', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Treasurer' } });
            (checkTierAccess as any).mockResolvedValue({ allowed: false, message: 'Upgrade required' });

            const mockUpdate = vi.fn();
            // @ts-ignore
            db.update = mockUpdate;

            const req = createRequest('PATCH', { balance: 250 });
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(403);
            await expect(res.json()).resolves.toMatchObject({ error: 'Upgrade required', upgrade: true });
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'TREASURER' });
            expect(checkTierAccess).toHaveBeenCalledWith(mockGangId, 'finance');
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should reject balance updates without treasurer access', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

            const mockUpdate = vi.fn();
            // @ts-ignore
            db.update = mockUpdate;

            const req = createRequest('PATCH', { balance: 250 });
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(403);
            await expect(res.text()).resolves.toContain('Only Treasurer or Owner can update balance');
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('DELETE /api/gangs/[gangId]/members/[memberId]', () => {
        it('should soft delete member and remove roles', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const mockTargetMember = { id: mockMemberId, discordId: 'target-discord-id', gangId: mockGangId, gangRole: 'MEMBER' };
            const mockGang = { discordGuildId: 'guild-123' };
            const mockRoles = [{ discordRoleId: 'role-123' }];

            // Mock db.query
            (db as any).query = {
                members: {
                    findFirst: vi.fn().mockResolvedValue(mockTargetMember),
                },
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
                gangRoles: { findMany: vi.fn().mockResolvedValue(mockRoles) },
            } as any;

            const mockUpdate = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            // @ts-ignore
            db.update = mockUpdate;
            // @ts-ignore
            db.insert = mockInsert;

            process.env.DISCORD_BOT_TOKEN = 'mock-token';

            const req = createRequest('DELETE');
            const res = await DELETE(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(200);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(mockUpdate).toHaveBeenCalled(); // Soft Delete
            expect(global.fetch).toHaveBeenCalled(); // Discord Role Removal
        });

        it('should reject delete without admin access', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member' } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

            const mockUpdate = vi.fn();
            // @ts-ignore
            db.update = mockUpdate;

            const req = createRequest('DELETE');
            const res = await DELETE(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(403);
            await expect(res.text()).resolves.toContain('Only Admin or Owner can kick members');
            expect(mockUpdate).not.toHaveBeenCalled();
        });
    });

    describe('PATCH /api/gangs/[gangId]/members/[memberId]/role', () => {
        it('should reject invalid roles before checking permissions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const req = createRequest('PATCH', { role: 'OWNER' });
            const res = await updateMemberRole(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(400);
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('should reject role updates without admin access before member lookup', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member' } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

            const findMember = vi.fn();
            (db as any).query = {
                members: { findFirst: findMember },
            } as any;

            const req = createRequest('PATCH', { role: 'ADMIN' });
            const res = await updateMemberRole(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(403);
            await expect(res.text()).resolves.toContain('Insufficient Permissions');
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(findMember).not.toHaveBeenCalled();
        });

        it('should update member role for admins', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            (db as any).query = {
                members: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: mockMemberId,
                        gangId: mockGangId,
                        discordId: null,
                        gangRole: 'MEMBER',
                    }),
                },
                gangs: { findFirst: vi.fn().mockResolvedValue({ id: mockGangId, discordGuildId: 'guild-123' }) },
                gangRoles: { findMany: vi.fn().mockResolvedValue([]) },
            } as any;

            const updateSet = vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            });
            const mockUpdate = vi.fn().mockReturnValue({ set: updateSet });
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            // @ts-ignore
            db.update = mockUpdate;
            // @ts-ignore
            db.insert = mockInsert;

            const req = createRequest('PATCH', { role: 'ADMIN' });
            const res = await updateMemberRole(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(200);
            await expect(res.json()).resolves.toMatchObject({ success: true, role: 'ADMIN' });
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({ gangRole: 'ADMIN' }));
            expect(mockInsert).toHaveBeenCalled();
        });
    });

    describe('PATCH /api/gangs/[gangId]/members/[memberId]/status', () => {
        it('should reject invalid status before checking permissions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            const req = createRequest('PATCH', { status: 'PENDING' });
            const res = await updateMemberStatus(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(400);
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('should reject status updates without admin access before writing', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Member' } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

            const mockUpdate = vi.fn();
            // @ts-ignore
            db.update = mockUpdate;

            const req = createRequest('PATCH', { status: 'APPROVED' });
            const res = await updateMemberStatus(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(403);
            await expect(res.json()).resolves.toHaveProperty('error');
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(mockUpdate).not.toHaveBeenCalled();
        });

        it('should approve members for admins', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            (db as any).query = {
                members: {
                    findFirst: vi.fn().mockResolvedValue({
                        id: mockMemberId,
                        gangId: mockGangId,
                        discordId: null,
                        gangRole: 'MEMBER',
                        status: 'PENDING',
                        isActive: false,
                        transferStatus: null,
                        name: 'Alice',
                    }),
                },
                gangs: {
                    findFirst: vi.fn().mockResolvedValue({
                        discordGuildId: 'guild-123',
                        transferStatus: 'ACTIVE',
                    }),
                },
                gangRoles: { findMany: vi.fn().mockResolvedValue([]) },
            } as any;

            const updateSet = vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            });
            const mockUpdate = vi.fn().mockReturnValue({ set: updateSet });
            const mockInsert = vi.fn().mockReturnValue({
                values: vi.fn().mockResolvedValue(undefined),
            });

            // @ts-ignore
            db.update = mockUpdate;
            // @ts-ignore
            db.insert = mockInsert;

            const req = createRequest('PATCH', { status: 'APPROVED' });
            const res = await updateMemberStatus(req, { params: { gangId: mockGangId, memberId: mockMemberId } });

            expect(res.status).toBe(200);
            await expect(res.json()).resolves.toMatchObject({ success: true, status: 'APPROVED' });
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ADMIN' });
            expect(updateSet).toHaveBeenCalledWith(expect.objectContaining({
                status: 'APPROVED',
                isActive: true,
                transferStatus: 'CONFIRMED',
            }));
            expect(mockInsert).toHaveBeenCalled();
        });
    });

    describe('durable member mutation throttling', () => {
        it('rate limits member mutation routes before DB lookup/write work', async () => {
            const tooManyRequests = () => new Response(JSON.stringify({ error: 'Too Many Requests' }), {
                status: 429,
                headers: { 'Content-Type': 'application/json' },
            });

            for (const [method, handler, params, body] of [
                ['POST', createMember, { gangId: mockGangId }, { name: 'Alice' }],
                ['PATCH', PATCH, { gangId: mockGangId, memberId: mockMemberId }, { isActive: true }],
                ['DELETE', DELETE, { gangId: mockGangId, memberId: mockMemberId }, undefined],
                ['PATCH', updateMemberRole, { gangId: mockGangId, memberId: mockMemberId }, { role: 'ADMIN' }],
                ['PATCH', updateMemberStatus, { gangId: mockGangId, memberId: mockMemberId }, { status: 'APPROVED' }],
            ] as const) {
                vi.clearAllMocks();
                delete process.env.DISCORD_BOT_TOKEN;

                (getServerSession as any).mockResolvedValue({
                    user: { discordId: mockUserId, name: 'Admin' },
                });
                (requireGangAccess as any).mockResolvedValue({
                    gang: { id: mockGangId },
                    member: { discordId: mockUserId },
                    session: { user: { discordId: mockUserId, name: 'Admin' } },
                });
                (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());

                const findFirst = vi.fn();
                const findMany = vi.fn();
                (db as any).query = {
                    gangs: { findFirst },
                    members: { findFirst },
                    gangRoles: { findMany },
                };
                (db as any).insert = vi.fn();
                (db as any).update = vi.fn();

                const res = await handler(createRequest(method, body), { params } as any);

                expect(res.status).toBe(429);
                await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
                expect(findFirst).not.toHaveBeenCalled();
                expect(findMany).not.toHaveBeenCalled();
                expect((db as any).insert).not.toHaveBeenCalled();
                expect((db as any).update).not.toHaveBeenCalled();
            }
        });
    });
});
