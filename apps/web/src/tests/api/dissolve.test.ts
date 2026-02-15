import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/gangs/[gangId]/dissolve/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

// Mock Discord REST - Define mocks inside to avoid hoisting issues or use vi.hoisted (but class is safer here)
vi.mock('discord.js', () => {
    const mockDelete = vi.fn();
    const mockGet = vi.fn();

    return {
        REST: class {
            constructor() { }
            setToken = vi.fn().mockReturnThis();
            delete = mockDelete;
            get = mockGet;
        },
        // Expose mocks for assertions
        _mocks: {
            delete: mockDelete,
            get: mockGet
        }
    };
});
vi.mock('discord-api-types/v10', () => ({
    Routes: {
        guildRole: (gid: string, rid: string) => `roles/${gid}/${rid}`,
        guildChannels: (gid: string) => `channels/${gid}`,
        channel: (cid: string) => `channels/${cid}`,
    }
}));


// Imports for mocking
import { getServerSession } from 'next-auth';
import { db } from '@gang/database';

describe('Dissolve API', () => {
    const mockGangId = 'gang-123';
    const mockUserId = 'user-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    const createRequest = (body: any) => {
        return new NextRequest('http://localhost:3000/api', {
            method: 'POST',
            body: JSON.stringify(body),
        });
    };

    describe('POST /api/gangs/[gangId]/dissolve', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);
            const req = createRequest({});
            const res = await POST(req, { params: { gangId: mockGangId } });
            expect(res.status).toBe(401);
        });

        it('should return 403 if member not found', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

            const mockQuery = {
                query: {
                    gangRoles: { findFirst: vi.fn().mockResolvedValue(null) }, // Not verifying role here in code? 
                    // Code checks member existence first
                    members: { findFirst: vi.fn().mockResolvedValue(null) } // Not a member
                }
            };
            // @ts-ignore
            db.query = mockQuery.query;

            const req = createRequest({});
            const res = await POST(req, { params: { gangId: mockGangId } });
            expect(res.status).toBe(403);
        });

        it('should dissolve gang and cleanup discord resources', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

            const mockMember = { id: 'mem-1', discordId: mockUserId, gangId: mockGangId, gangRole: 'OWNER' };
            const mockGang = {
                id: mockGangId,
                discordGuildId: 'guild-123',
                roles: [{ discordRoleId: 'role-1' }, { discordRoleId: 'role-2' }],
                settings: {}
            };

            const mockQuery = {
                query: {
                    gangRoles: { findFirst: vi.fn().mockResolvedValue(null) },
                    members: { findFirst: vi.fn().mockResolvedValue(mockMember) },
                    gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) }
                },
                update: vi.fn().mockReturnValue({
                    set: vi.fn().mockReturnThis(),
                    where: vi.fn().mockReturnThis(),
                }),
                delete: vi.fn().mockReturnValue({
                    where: vi.fn().mockReturnThis()
                })
            };

            // @ts-ignore
            db.query = mockQuery.query;
            // @ts-ignore
            db.update = mockQuery.update;
            // @ts-ignore
            db.delete = mockQuery.delete;

            // Mock Discord Channels
            // @ts-ignore
            const Discord = await import('discord.js');
            // @ts-ignore
            const mockRestGet = Discord._mocks.get;
            // @ts-ignore
            const mockRestDelete = Discord._mocks.delete;

            mockRestGet.mockResolvedValue([
                { id: 'c1', name: 'General', parent_id: 'cat1' },
                { id: 'c2', name: 'Finance', parent_id: 'cat2' },
            ]);

            const body = { deleteData: true }; // Hard Delete
            const req = createRequest(body);
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);

            // Verify DB Delete
            expect(mockQuery.delete).toHaveBeenCalled();

            // Verify Discord Cleanup
            // @ts-ignore
            expect(Discord._mocks.delete).toHaveBeenCalledTimes(2);
        });
    });
});
