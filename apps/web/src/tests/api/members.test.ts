import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH, DELETE } from '@/app/api/gangs/[gangId]/members/[memberId]/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/permissions');

// Imports for mocking
import { getServerSession } from 'next-auth';
import { db } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';

// Global Fetch Mock
global.fetch = vi.fn();

describe('Members API', () => {
    const mockGangId = 'gang-123';
    const mockMemberId = 'member-123';
    const mockUserId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createRequest = (method: string, body?: any) => {
        return new NextRequest('http://localhost:3000/api', {
            method,
            body: body ? JSON.stringify(body) : undefined,
        });
    };

    describe('PATCH /api/gangs/[gangId]/members/[memberId]', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);
            const req = createRequest('PATCH', {});
            const res = await PATCH(req, { params: { gangId: mockGangId, memberId: mockMemberId } });
            expect(res.status).toBe(401);
        });

        it('should update member details successfully', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            // Mock permissions — Admin can update member details
            (getGangPermissions as any).mockResolvedValue({
                isOwner: false,
                isAdmin: true,
                isTreasurer: false,
                isMember: true,
                level: 'ADMIN',
            });

            // Mock db.update chain
            const mockUpdate = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            // Mock db.insert chain (for audit log)
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
            expect(mockUpdate).toHaveBeenCalled();
            expect(mockInsert).toHaveBeenCalled(); // Audit Log
        });
    });

    describe('DELETE /api/gangs/[gangId]/members/[memberId]', () => {
        it('should soft delete member and remove roles', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Admin' } });

            // Mock permissions — Admin can kick
            (getGangPermissions as any).mockResolvedValue({
                isOwner: false,
                isAdmin: true,
                isTreasurer: false,
                isMember: true,
                level: 'ADMIN',
            });

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

            // Mock db.update chain
            const mockUpdate = vi.fn().mockReturnValue({
                set: vi.fn().mockReturnValue({
                    where: vi.fn().mockResolvedValue(undefined),
                }),
            });

            // Mock db.insert chain
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
            expect(mockUpdate).toHaveBeenCalled(); // Soft Delete
            expect(global.fetch).toHaveBeenCalled(); // Discord Role Removal
        });
    });
});
