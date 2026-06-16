import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, GET } from '@/app/api/gangs/[gangId]/attendance/route';
import { NextRequest } from 'next/server';

// Mock Dependencies
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
vi.mock('@/lib/tierGuard');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
    logInfo: vi.fn(),
}));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'attendance:test'),
}));

// Imports for mocking
import { getServerSession } from 'next-auth';
import {
    db,
    normalizeAttendanceCountingPolicy,
    normalizeAttendanceSessionMode,
    normalizeAttendanceVerificationMode,
} from '@gang/database';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

describe('Attendance API', () => {
    const mockGangId = 'gang-123';
    const mockUserId = 'user-123';
    const validSessionDate = '2026-04-25T17:00:00.000Z';
    const validStartTime = '2026-04-25T16:00:00.000Z';
    const validEndTime = '2026-04-25T17:20:00.000Z';

    beforeEach(() => {
        vi.clearAllMocks();
        (isFeatureEnabled as any).mockResolvedValue(true);
        (normalizeAttendanceSessionMode as any).mockImplementation((mode?: string | null) => mode === 'MANUAL_ROLL_CALL' ? 'MANUAL_ROLL_CALL' : 'DISCORD_SELF_CHECKIN');
        (normalizeAttendanceCountingPolicy as any).mockImplementation((policy?: string | null) => policy === 'SUPPLEMENTAL' ? 'SUPPLEMENTAL' : 'REQUIRED');
        (normalizeAttendanceVerificationMode as any).mockImplementation((mode?: string | null) => mode === 'CODE' ? 'CODE' : 'NONE');
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: mockGangId },
            member: { discordId: mockUserId },
            session: { user: { discordId: mockUserId } },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
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
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('should return 403 if user is not Admin/Owner', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));

            const req = createRequest('POST', {
                sessionName: 'Test', sessionDate: validSessionDate, startTime: validStartTime, endTime: validEndTime
            });
            const res = await POST(req, { params: { gangId: mockGangId } });
            expect(res.status).toBe(403);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ATTENDANCE_OFFICER' });
        });

        it('should validate required fields before checking permissions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

            const req = createRequest('POST', { sessionName: 'Missing dates' });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(400);
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('should reject sessions where end time is not after start time', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const findFirst = vi.fn();
            const insert = vi.fn();
            (db as any).query = {
                gangs: { findFirst },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Bad window',
                sessionDate: validSessionDate,
                startTime: '2026-04-25T17:00:00.000Z',
                endTime: '2026-04-25T16:59:00.000Z',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toMatchObject({ error: 'End time must be after start time' });
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ATTENDANCE_OFFICER' });
            expect(findFirst).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
        });

        it('should allow ATTENDANCE_OFFICER to create a session', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const mockGang = {
                id: mockGangId,
                settings: {
                    defaultAbsentPenalty: 50,
                },
            };
            const mockSession = { id: 'session-officer', status: 'SCHEDULED' };

            const returning = vi.fn().mockResolvedValue([mockSession]);
            const values = vi.fn().mockReturnValue({ returning });
            const auditValues = vi.fn().mockResolvedValue(undefined);

            const insert = vi.fn()
                .mockReturnValueOnce({ values })
                .mockReturnValueOnce({ values: auditValues });

            (db as any).query = {
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Officer Session',
                sessionDate: validSessionDate,
                startTime: validStartTime,
                endTime: validEndTime,
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ATTENDANCE_OFFICER' });
            expect(insert).toHaveBeenCalledTimes(2);
        });

        it('should create cross-day sessions when end datetime is after start datetime', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const mockGang = { id: mockGangId, settings: null };
            const mockSession = { id: 'session-cross-day', status: 'SCHEDULED' };

            const returning = vi.fn().mockResolvedValue([mockSession]);
            const values = vi.fn().mockReturnValue({ returning });
            const auditValues = vi.fn().mockResolvedValue(undefined);
            const insert = vi.fn()
                .mockReturnValueOnce({ values })
                .mockReturnValueOnce({ values: auditValues });

            (db as any).query = {
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Late night session',
                sessionDate: '2026-04-25T17:00:00.000Z',
                startTime: '2026-04-25T16:00:00.000Z',
                endTime: '2026-04-25T17:20:00.000Z',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            expect(values).toHaveBeenCalledWith(expect.objectContaining({
                startTime: new Date('2026-04-25T16:00:00.000Z'),
                endTime: new Date('2026-04-25T17:20:00.000Z'),
            }));
            expect(insert).toHaveBeenCalledTimes(2);
        });

        it('should create MANUAL_ROLL_CALL as ACTIVE without startTime or endTime', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const mockGang = {
                id: mockGangId,
                settings: {
                    defaultAbsentPenalty: 50,
                },
            };
            const mockSession = { id: 'session-manual', status: 'ACTIVE', mode: 'MANUAL_ROLL_CALL' };

            const returning = vi.fn().mockResolvedValue([mockSession]);
            const values = vi.fn().mockReturnValue({ returning });
            const auditValues = vi.fn().mockResolvedValue(undefined);
            const insert = vi.fn()
                .mockReturnValueOnce({ values })
                .mockReturnValueOnce({ values: auditValues });

            (db as any).query = {
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Manual roll call',
                sessionDate: validSessionDate,
                absentPenalty: 100,
                mode: 'MANUAL_ROLL_CALL',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.session.status).toBe('ACTIVE');
            expect(values).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'MANUAL_ROLL_CALL',
                status: 'ACTIVE',
                absentPenalty: 100,
                sessionDate: new Date('2026-04-25T17:00:00.000Z'),
                startTime: new Date('2026-04-25T17:00:00.000Z'),
                endTime: new Date('2026-04-26T16:59:59.999Z'),
            }));
            expect(insert).toHaveBeenCalledTimes(2);
        });

        it('creates supplemental sessions without absent penalty', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const mockGang = {
                id: mockGangId,
                settings: {
                    defaultAbsentPenalty: 500,
                },
            };
            const mockSession = { id: 'session-supplemental', status: 'SCHEDULED', countingPolicy: 'SUPPLEMENTAL' };

            const returning = vi.fn().mockResolvedValue([mockSession]);
            const values = vi.fn().mockReturnValue({ returning });
            const auditValues = vi.fn().mockResolvedValue(undefined);
            const insert = vi.fn()
                .mockReturnValueOnce({ values })
                .mockReturnValueOnce({ values: auditValues });

            (db as any).query = {
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Extra late-night run',
                sessionDate: validSessionDate,
                startTime: validStartTime,
                endTime: validEndTime,
                absentPenalty: 999,
                countingPolicy: 'SUPPLEMENTAL',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            expect(values).toHaveBeenCalledWith(expect.objectContaining({
                countingPolicy: 'SUPPLEMENTAL',
                absentPenalty: 0,
            }));
            expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
                details: expect.stringContaining('"countingPolicy":"SUPPLEMENTAL"'),
            }));
        });

        it('creates Discord code verification sessions without exposing the raw code in audit details', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const mockGang = {
                id: mockGangId,
                settings: {
                    defaultAbsentPenalty: 500,
                },
            };
            const mockSession = { id: 'session-code', status: 'SCHEDULED', verificationMode: 'CODE' };

            const returning = vi.fn().mockResolvedValue([mockSession]);
            const values = vi.fn().mockReturnValue({ returning });
            const auditValues = vi.fn().mockResolvedValue(undefined);
            const insert = vi.fn()
                .mockReturnValueOnce({ values })
                .mockReturnValueOnce({ values: auditValues });

            (db as any).query = {
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Code proof round',
                sessionDate: validSessionDate,
                startTime: validStartTime,
                endTime: validEndTime,
                verificationMode: 'CODE',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            expect(values).toHaveBeenCalledWith(expect.objectContaining({
                verificationMode: 'CODE',
                verificationCode: expect.stringMatching(/^\d{4}$/),
            }));
            expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
                details: expect.stringContaining('"verificationMode":"CODE"'),
                newValue: expect.stringContaining('"verificationCode":"SET"'),
            }));
        });

        it('rejects code verification for manual roll-call sessions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const req = createRequest('POST', {
                sessionName: 'Manual code round',
                sessionDate: validSessionDate,
                mode: 'MANUAL_ROLL_CALL',
                verificationMode: 'CODE',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(400);
            await expect(res.json()).resolves.toMatchObject({
                error: 'Attendance verification mode is only available for Discord self check-in rounds',
            });
            expect(requireGangAccess).not.toHaveBeenCalled();
        });

        it('keeps scheduled Discord self check-in datetimes exactly as submitted ISO instants', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });

            const mockGang = { id: mockGangId, settings: { defaultAbsentPenalty: 0 } };
            const mockSession = { id: 'session-scheduled-timezone', status: 'SCHEDULED' };

            const returning = vi.fn().mockResolvedValue([mockSession]);
            const values = vi.fn().mockReturnValue({ returning });
            const auditValues = vi.fn().mockResolvedValue(undefined);
            const insert = vi.fn()
                .mockReturnValueOnce({ values })
                .mockReturnValueOnce({ values: auditValues });

            (db as any).query = {
                gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Scheduled boundary',
                sessionDate: '2026-05-08T17:00:00.000Z',
                startTime: '2026-05-09T13:30:00.000Z',
                endTime: '2026-05-09T14:30:00.000Z',
                mode: 'DISCORD_SELF_CHECKIN',
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            expect(values).toHaveBeenCalledWith(expect.objectContaining({
                mode: 'DISCORD_SELF_CHECKIN',
                status: 'SCHEDULED',
                sessionDate: new Date('2026-05-08T17:00:00.000Z'),
                startTime: new Date('2026-05-09T13:30:00.000Z'),
                endTime: new Date('2026-05-09T14:30:00.000Z'),
            }));
            expect(insert).toHaveBeenCalledTimes(2);
        });

        it('should rate limit session creation before gang lookup and writes', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId, name: 'Officer' } });
            (enforceRouteRateLimit as any).mockResolvedValue(new Response(
                JSON.stringify({ error: 'Too Many Requests' }),
                { status: 429, headers: { 'Content-Type': 'application/json' } }
            ));

            const findFirst = vi.fn();
            const insert = vi.fn();
            (db as any).query = {
                gangs: { findFirst },
            };
            (db as any).insert = insert;

            const req = createRequest('POST', {
                sessionName: 'Officer Session',
                sessionDate: validSessionDate,
                startTime: validStartTime,
                endTime: validEndTime,
            });
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(429);
            await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ATTENDANCE_OFFICER' });
            expect(findFirst).not.toHaveBeenCalled();
            expect(insert).not.toHaveBeenCalled();
        });

        it('should create a session successfully', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });

            const mockGang = { id: mockGangId };
            const mockSession = { id: 'session-123', status: 'SCHEDULED' };

            const mockQuery = {
                query: {
                    gangs: { findFirst: vi.fn().mockResolvedValue(mockGang) },
                },
                insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([mockSession]) })
            };

            (db as any).query = mockQuery.query;
            (db as any).insert = mockQuery.insert;

            const body = {
                sessionName: 'War Prep',
                sessionDate: validSessionDate,
                startTime: validStartTime,
                endTime: validEndTime,
            };

            const req = createRequest('POST', body);
            const res = await POST(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(200);
            const json = await res.json();
            expect(json.success).toBe(true);
            expect(json.session.status).toBe('SCHEDULED');
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'ATTENDANCE_OFFICER' });
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

            const mockSessions = [
                { id: '1', sessionName: 'Session 1', verificationCode: '1234' },
                { id: '2', sessionName: 'Session 2', verificationCode: null },
            ];
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
            expect(json[0].verificationCode).toBeUndefined();
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'MEMBER' });
        });

        it('should reject users without gang membership before listing sessions', async () => {
            (getServerSession as any).mockResolvedValue({ user: { discordId: mockUserId } });
            (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
            const findMany = vi.fn();
            (db as any).query = {
                attendanceSessions: { findMany },
            };

            const req = createRequest('GET');
            const res = await GET(req, { params: { gangId: mockGangId } });

            expect(res.status).toBe(403);
            expect(requireGangAccess).toHaveBeenCalledWith({ gangId: mockGangId, minimumRole: 'MEMBER' });
            expect(findMany).not.toHaveBeenCalled();
        });
    });
});
