import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/gangs/[gangId]/attendance/route';
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

describe('Attendance API', () => {
    const mockGangId = 'gang-123';
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

    describe('POST /api/gangs/[gangId]/attendance', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);
            const req = createRequest('POST', {});
            const res = await POST(req, { params: { gangId: mockGangId } });
            expect(res.status).toBe(401);
        });

        it('should return 403 if user is not Admin/Owner', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
            (getGangPermissions as any).mockResolvedValue({ isAdmin: false, isOwner: false });

            const req = createRequest('POST', {
                sessionName: 'Test', sessionDate: '2023-01-01', startTime: '2023-01-01', endTime: '2023-01-01'
            });
            const res = await POST(req, { params: { gangId: mockGangId } });
            expect(res.status).toBe(403);
        });

        it('should create a session successfully', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
            (getGangPermissions as any).mockResolvedValue({ isAdmin: true });

            const mockGang = { id: mockGangId };
            const mockSession = { id: 'session-123', status: 'SCHEDULED' };

            const mockQuery = {
                query: {
                    gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
                },
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([mockSession]) })
            };

            // @ts-ignore
            db.query = mockQuery.query;
            // @ts-ignore
            db.insert = mockQuery.insert;

            const body = {
                sessionName: 'War Prep',
                sessionDate: new Date().toISOString(),
                startTime: new Date().toISOString(),
                endTime: new Date().toISOString(),
            };

            const req = createRequest('POST', body);
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.session.status).toBe('SCHEDULED');
            expect(mockQuery.insert).toHaveBeenCalled();
        });
    });

    describe('GET /api/gangs/[gangId]/attendance', () => {
        it('should return 401 if not authenticated', async () => {
            (getServerSession as any).mockResolvedValue(null);
            const req = createRequest('GET');
            const res = await GET(req, { params: { gangId: mockGangId } });
            expect(res.status).toBe(401);
        });

        it('should return list of sessions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

            const mockSessions = [{ id: '1', sessionName: 'Session 1' }, { id: '2', sessionName: 'Session 2' }];
            const mockQuery = {
                query: {
                    attendanceSessions: { findMany: vi.fn().mockResolvedValue(mockSessions) }
                }
            };
            // @ts-ignore
            db.query = mockQuery.query;

            const req = createRequest('GET');
            const res = await GET(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json).toHaveLength(2);
            expect(json[0].sessionName).toBe('Session 1');
        });
    });
});
