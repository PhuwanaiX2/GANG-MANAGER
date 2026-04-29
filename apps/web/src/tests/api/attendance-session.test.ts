import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
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
    buildRateLimitSubject: vi.fn(() => 'attendance-session:test'),
}));
vi.mock('nanoid', () => ({ nanoid: () => 'generated-id' }));
vi.mock('@gang/database', () => {
    const attendanceSessions = {
        id: 'attendanceSessions.id',
        gangId: 'attendanceSessions.gangId',
        status: 'attendanceSessions.status',
    };
    const attendanceRecords = {
        id: 'attendanceRecords.id',
        sessionId: 'attendanceRecords.sessionId',
        memberId: 'attendanceRecords.memberId',
    };
    const members = {
        id: 'members.id',
        gangId: 'members.gangId',
        discordId: 'members.discordId',
        isActive: 'members.isActive',
        status: 'members.status',
        balance: 'members.balance',
    };
    const gangs = {
        id: 'gangs.id',
        subscriptionTier: 'gangs.subscriptionTier',
        balance: 'gangs.balance',
    };
    const transactions = { id: 'transactions.id' };
    const leaveRequests = { id: 'leaveRequests.id' };
    const auditLogs = { id: 'auditLogs.id' };
    const normalizeAttendanceStatus = (status?: string | null) => status === 'LATE' ? 'PRESENT' : status || null;
    const partitionAttendanceRecords = (records: Array<{ status?: string | null }>) => ({
        present: records.filter((record) => normalizeAttendanceStatus(record.status) === 'PRESENT'),
        absent: records.filter((record) => normalizeAttendanceStatus(record.status) === 'ABSENT'),
        leave: records.filter((record) => normalizeAttendanceStatus(record.status) === 'LEAVE'),
    });
    const getAttendanceBucketCounts = (records: Array<{ status?: string | null }>) => {
        const buckets = partitionAttendanceRecords(records);
        return {
            present: buckets.present.length,
            absent: buckets.absent.length,
            leave: buckets.leave.length,
            total: buckets.present.length + buckets.absent.length + buckets.leave.length,
        };
    };
    const resolveUncheckedAttendanceStatus = ({ attendanceSession, memberId, approvedLeaves }: any) => {
        const sessionStart = new Date(attendanceSession.startTime);
        const sessionEnd = new Date(attendanceSession.endTime);
        const activeLeave = approvedLeaves.find((leave: any) => {
            if (leave.memberId !== memberId) return false;

            const leaveStart = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);

            if (leave.type === 'FULL') {
                leaveStart.setHours(0, 0, 0, 0);
                leaveEnd.setHours(23, 59, 59, 999);
                return sessionStart >= leaveStart && sessionStart <= leaveEnd;
            }

            if (leave.type === 'LATE') {
                return sessionStart < leaveStart && sessionEnd <= leaveStart;
            }

            return false;
        });

        return activeLeave ? 'LEAVE' : 'ABSENT';
    };

    return {
        db: {
            query: {},
            insert: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            transaction: vi.fn(),
        },
        attendanceSessions,
        attendanceRecords,
        members,
        transactions,
        leaveRequests,
        gangs,
        auditLogs,
        canAccessFeature: vi.fn(),
        resolveEffectiveSubscriptionTier: vi.fn((tier: string) => tier),
        normalizeAttendanceStatus,
        partitionAttendanceRecords,
        getAttendanceBucketCounts,
        resolveUncheckedAttendanceStatus,
    };
});

import { getServerSession } from 'next-auth';
import { GangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logWarn } from '@/lib/logger';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import {
    db,
    canAccessFeature,
    attendanceSessions,
    attendanceRecords,
    members,
} from '@gang/database';
import { DELETE, PATCH } from '@/app/api/gangs/[gangId]/attendance/[sessionId]/route';

describe('PATCH /api/gangs/[gangId]/attendance/[sessionId]', () => {
    const gangId = 'gang-123';
    const sessionId = 'session-123';
    const userDiscordId = 'user-123';
    const actorMemberId = 'actor-member-1';

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    const createDeleteRequest = () => new NextRequest('http://localhost:3000/api', {
        method: 'DELETE',
    });
    const tooManyRequests = () => new Response(
        JSON.stringify({ error: 'Too Many Requests' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
    );

    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({
            user: { discordId: userDiscordId, name: 'Admin User' },
        });
        (requireGangAccess as any).mockResolvedValue({
            gang: { id: gangId },
            member: { discordId: userDiscordId },
            session: { user: { discordId: userDiscordId, name: 'Admin User' } },
        });
        (canAccessFeature as any).mockReturnValue(true);
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    it('allows ATTENDANCE_OFFICER to pass the attendance update permission gate', async () => {
        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Alice' }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue({ id: 'record-1', status: 'PRESENT', penaltyAmount: 0 }),
            },
        };
        (db as any).transaction = vi.fn();

        const res = await PATCH(createRequest({ memberId: 'member-1', attendanceStatus: 'RESET' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(400);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        const json = await res.json();
        expect(json.error).toContain('ไม่สามารถรีเซ็ตหลังปิดรอบได้');
    });

    it('rejects attendance record updates without attendance management access before DB lookup', async () => {
        const findSession = vi.fn();
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
        (db as any).query = {
            attendanceSessions: {
                findFirst: findSession,
            },
        };

        const res = await PATCH(createRequest({ memberId: 'member-1', attendanceStatus: 'PRESENT' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        expect(findSession).not.toHaveBeenCalled();
    });

    it('rate limits attendance record updates before session lookup and writes', async () => {
        const findSession = vi.fn();
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());
        (db as any).query = {
            attendanceSessions: {
                findFirst: findSession,
            },
        };
        (db as any).transaction = vi.fn();
        (db as any).insert = vi.fn();
        (db as any).update = vi.fn();
        (db as any).delete = vi.fn();

        const res = await PATCH(createRequest({ memberId: 'member-1', attendanceStatus: 'PRESENT' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        expect(findSession).not.toHaveBeenCalled();
        expect((db as any).transaction).not.toHaveBeenCalled();
        expect((db as any).insert).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
        expect((db as any).delete).not.toHaveBeenCalled();
    });

    it('rejects session status updates without attendance management access before DB lookup', async () => {
        const findSession = vi.fn();
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
        (db as any).query = {
            attendanceSessions: {
                findFirst: findSession,
            },
        };

        const res = await PATCH(createRequest({ status: 'ACTIVE' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        expect(findSession).not.toHaveBeenCalled();
    });

    it('rate limits session status updates before session lookup and writes', async () => {
        const findSession = vi.fn();
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());
        (db as any).query = {
            attendanceSessions: {
                findFirst: findSession,
            },
        };
        (db as any).insert = vi.fn();
        (db as any).update = vi.fn();

        const res = await PATCH(createRequest({ status: 'ACTIVE' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        expect(findSession).not.toHaveBeenCalled();
        expect((db as any).insert).not.toHaveBeenCalled();
        expect((db as any).update).not.toHaveBeenCalled();
    });

    it('returns success without re-posting when another process already started the scheduled session', async () => {
        const returning = vi.fn().mockResolvedValue([]);

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'SCHEDULED',
                    sessionName: 'War Room',
                    sessionDate: new Date('2025-01-01T00:00:00.000Z'),
                    startTime: new Date('2025-01-01T10:00:00.000Z'),
                    endTime: new Date('2025-01-01T11:00:00.000Z'),
                    closedAt: null,
                    records: [],
                }),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ settings: { attendanceChannelId: 'channel-1' } }),
            },
        };

        (db as any).update = vi.fn((table) => {
            if (table === attendanceSessions) {
                return {
                    set: vi.fn().mockReturnValue({
                        where: vi.fn().mockReturnValue({
                            returning,
                        }),
                    }),
                };
            }

            throw new Error('Unexpected table update');
        });

        const res = await PATCH(createRequest({ status: 'ACTIVE' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true, alreadyStarted: true });
        expect(returning).toHaveBeenCalledTimes(1);
    });

    it('marks same-day approved FULL leave as LEAVE when closing a session from the web', async () => {
        const insertedRecords: any[] = [];
        const attendanceSessionUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const auditValues = vi.fn().mockResolvedValue(undefined);

        (canAccessFeature as any).mockReturnValue(false);
        delete process.env.DISCORD_BOT_TOKEN;

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'ACTIVE',
                    sessionName: 'War Room',
                    sessionDate: new Date('2025-01-01T00:00:00.000Z'),
                    startTime: new Date('2025-01-01T12:00:00.000Z'),
                    endTime: new Date('2025-01-01T13:00:00.000Z'),
                    absentPenalty: 100,
                    records: [],
                    closedAt: null,
                }),
            },
            members: {
                findMany: vi.fn().mockResolvedValue([{ id: 'member-leave', name: 'Leave User' }]),
                findFirst: vi.fn().mockResolvedValue({ id: actorMemberId }),
            },
            leaveRequests: {
                findMany: vi.fn().mockResolvedValue([{
                    memberId: 'member-leave',
                    type: 'FULL',
                    status: 'APPROVED',
                    startDate: new Date('2025-01-01T00:00:00.000Z'),
                    endDate: new Date('2025-01-01T00:00:00.000Z'),
                }]),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ subscriptionTier: 'FREE' }),
            },
            attendanceRecords: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };

        (db as any).insert = vi.fn((_table: any) => ({
            values: vi.fn(async (payload: any) => {
                if (Array.isArray(payload)) {
                    insertedRecords.push(...payload);
                    return undefined;
                }

                return auditValues(payload);
            }),
        }));

        (db as any).update = vi.fn((table: any) => {
            if (table === attendanceSessions) {
                return {
                    set: vi.fn().mockReturnValue({
                        where: attendanceSessionUpdateWhere,
                    }),
                };
            }

            throw new Error('Unexpected table update');
        });

        const res = await PATCH(createRequest({ status: 'CLOSED' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        expect(insertedRecords).toHaveLength(1);
        expect(insertedRecords[0]).toEqual(expect.objectContaining({
            memberId: 'member-leave',
            status: 'LEAVE',
            penaltyAmount: 0,
        }));
        expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
            action: 'ATTENDANCE_CLOSE',
            targetId: sessionId,
        }));
        expect(attendanceSessionUpdateWhere).toHaveBeenCalled();
    });

    it('keeps closing the session when the Discord close update returns non-ok', async () => {
        const attendanceSessionUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const auditValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => 'discord down',
        });

        const originalFetch = global.fetch;
        const originalBotToken = process.env.DISCORD_BOT_TOKEN;

        global.fetch = fetchMock as any;
        process.env.DISCORD_BOT_TOKEN = 'test-token';
        (canAccessFeature as any).mockReturnValue(false);

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'ACTIVE',
                    sessionName: 'War Room',
                    sessionDate: new Date('2025-01-01T00:00:00.000Z'),
                    startTime: new Date('2025-01-01T12:00:00.000Z'),
                    endTime: new Date('2025-01-01T13:00:00.000Z'),
                    absentPenalty: 100,
                    records: [],
                    closedAt: null,
                    discordChannelId: 'channel-1',
                    discordMessageId: 'message-1',
                }),
            },
            members: {
                findMany: vi.fn().mockResolvedValue([]),
                findFirst: vi.fn().mockResolvedValue({ id: actorMemberId }),
            },
            gangs: {
                findFirst: vi.fn()
                    .mockResolvedValueOnce({ subscriptionTier: 'FREE' })
                    .mockResolvedValueOnce({ discordGuildId: null, settings: { attendanceChannelId: 'channel-1' } }),
            },
            attendanceRecords: {
                findMany: vi.fn().mockResolvedValue([]),
            },
        };

        (db as any).insert = vi.fn().mockReturnValue({ values: auditValues });
        (db as any).update = vi.fn((table: any) => {
            if (table === attendanceSessions) {
                return {
                    set: vi.fn().mockReturnValue({
                        where: attendanceSessionUpdateWhere,
                    }),
                };
            }

            throw new Error('Unexpected table update');
        });

        try {
            const res = await PATCH(createRequest({ status: 'CLOSED' }), {
                params: { gangId, sessionId },
            });

            expect(res.status).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(logWarn).toHaveBeenCalledWith(
                'api.attendance.session.close.discord_update_failed',
                expect.objectContaining({
                    gangId,
                    sessionId,
                    channelId: 'channel-1',
                    messageId: 'message-1',
                    statusCode: 500,
                    responseBody: 'discord down',
                })
            );
            expect(attendanceSessionUpdateWhere).toHaveBeenCalled();
        } finally {
            global.fetch = originalFetch;
            if (originalBotToken === undefined) {
                delete process.env.DISCORD_BOT_TOKEN;
            } else {
                process.env.DISCORD_BOT_TOKEN = originalBotToken;
            }
        }
    });

    it('allows updating CLOSED sessions and creates a negative penalty delta when clearing an absence penalty', async () => {
        const targetMember = { id: 'member-1', name: 'Alice' };
        const existingRecord = {
            id: 'record-1',
            status: 'ABSENT',
            checkedInAt: null,
            penaltyAmount: 100,
        };

        const attendanceRecordUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const memberUpdateReturning = vi.fn().mockResolvedValue([{ updatedId: targetMember.id }]);
        const txInsertValues = vi.fn().mockResolvedValue(undefined);

        const tx = {
            query: {
                members: {
                    findFirst: vi.fn().mockResolvedValue({ balance: 200 }),
                },
                gangs: {
                    findFirst: vi.fn().mockResolvedValue({ balance: 1000 }),
                },
            },
            update: vi.fn((table) => {
                if (table === attendanceRecords) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: attendanceRecordUpdateWhere,
                        }),
                    };
                }

                if (table === members) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                returning: memberUpdateReturning,
                            }),
                        }),
                    };
                }

                throw new Error('Unexpected table update');
            }),
            insert: vi.fn().mockReturnValue({
                values: txInsertValues,
            }),
        };

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                    absentPenalty: 100,
                    sessionName: 'War Room',
                }),
            },
            members: {
                findFirst: vi
                    .fn()
                    .mockResolvedValueOnce(targetMember)
                    .mockResolvedValueOnce({ id: actorMemberId }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue(existingRecord),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ subscriptionTier: 'PREMIUM' }),
            },
        };

        const auditInsertValues = vi.fn().mockResolvedValue(undefined);
        (db as any).insert = vi.fn().mockReturnValue({ values: auditInsertValues });
        (db as any).transaction = vi.fn(async (callback: any) => callback(tx));

        const res = await PATCH(createRequest({ memberId: targetMember.id, attendanceStatus: 'PRESENT' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        expect((db as any).transaction).toHaveBeenCalledTimes(1);
        expect(txInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId,
            memberId: targetMember.id,
            type: 'PENALTY',
            amount: -100,
            category: 'ATTENDANCE',
            createdById: actorMemberId,
        }));
        expect(auditInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            targetId: existingRecord.id,
            details: expect.stringContaining('"penaltyDelta":-100'),
            newValue: expect.stringContaining('"penaltyAmount":0'),
        }));
    });

    it('rejects RESET for CLOSED sessions', async () => {
        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: 'member-1', name: 'Alice' }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue({ id: 'record-1', status: 'PRESENT', penaltyAmount: 0 }),
            },
        };
        (db as any).transaction = vi.fn();

        const res = await PATCH(createRequest({ memberId: 'member-1', attendanceStatus: 'RESET' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('ไม่สามารถรีเซ็ตหลังปิดรอบได้');
        expect((db as any).transaction).not.toHaveBeenCalled();
    });

    it('creates a positive penalty delta when changing a CLOSED record to ABSENT', async () => {
        const targetMember = { id: 'member-2', name: 'Bob' };
        const existingRecord = {
            id: 'record-2',
            status: 'PRESENT',
            checkedInAt: new Date('2025-01-01T10:00:00.000Z'),
            penaltyAmount: 0,
        };

        const txInsertValues = vi.fn().mockResolvedValue(undefined);
        const memberUpdateReturning = vi.fn().mockResolvedValue([{ updatedId: targetMember.id }]);

        const tx = {
            query: {
                members: {
                    findFirst: vi.fn().mockResolvedValue({ balance: 500 }),
                },
                gangs: {
                    findFirst: vi.fn().mockResolvedValue({ balance: 2500 }),
                },
            },
            update: vi.fn((table) => {
                if (table === attendanceRecords) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue(undefined),
                        }),
                    };
                }

                if (table === members) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                returning: memberUpdateReturning,
                            }),
                        }),
                    };
                }

                throw new Error('Unexpected table update');
            }),
            insert: vi.fn().mockReturnValue({ values: txInsertValues }),
        };

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                    absentPenalty: 100,
                    sessionName: 'War Room',
                }),
            },
            members: {
                findFirst: vi
                    .fn()
                    .mockResolvedValueOnce(targetMember)
                    .mockResolvedValueOnce({ id: actorMemberId }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue(existingRecord),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({ subscriptionTier: 'PREMIUM' }),
            },
        };

        (db as any).insert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
        (db as any).transaction = vi.fn(async (callback: any) => callback(tx));

        const res = await PATCH(createRequest({ memberId: targetMember.id, attendanceStatus: 'ABSENT' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        expect(txInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            memberId: targetMember.id,
            type: 'PENALTY',
            amount: 100,
            category: 'ATTENDANCE',
            createdById: actorMemberId,
        }));
    });

    it('patches the existing summary message for CLOSED edits even when summary and attendance share the same channel', async () => {
        const targetMember = { id: 'member-5', name: 'Echo', discordAvatar: null, discordUsername: 'echo' };
        const existingRecord = {
            id: 'record-5',
            status: 'PRESENT',
            checkedInAt: new Date('2025-01-01T10:00:00.000Z'),
            penaltyAmount: 0,
        };
        const auditValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ([{ id: 'channel-1', name: 'สรุปเช็คชื่อ', type: 0 }]),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({ id: 'summary-1' }),
            });

        const originalFetch = global.fetch;
        const originalBotToken = process.env.DISCORD_BOT_TOKEN;
        global.fetch = fetchMock as any;
        process.env.DISCORD_BOT_TOKEN = 'test-token';

        const tx = {
            update: vi.fn((table) => {
                if (table === attendanceRecords) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockResolvedValue(undefined),
                        }),
                    };
                }

                throw new Error('Unexpected table update');
            }),
        };

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                    absentPenalty: 100,
                    sessionName: 'War Room',
                    sessionDate: new Date('2025-01-01T00:00:00.000Z'),
                    discordChannelId: 'channel-1',
                    discordMessageId: 'summary-1',
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue(targetMember),
                findMany: vi.fn().mockResolvedValue([targetMember]),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue(existingRecord),
                findMany: vi.fn().mockResolvedValue([{
                    ...existingRecord,
                    status: 'LEAVE',
                    penaltyAmount: 0,
                    member: { name: targetMember.name },
                }]),
            },
            gangs: {
                findFirst: vi.fn()
                    .mockResolvedValueOnce({ subscriptionTier: 'PREMIUM' })
                    .mockResolvedValueOnce({ discordGuildId: 'guild-1', settings: { attendanceChannelId: 'channel-1' } }),
            },
        };
        (db as any).insert = vi.fn().mockReturnValue({ values: auditValues });
        (db as any).transaction = vi.fn(async (callback: any) => callback(tx));

        try {
            const res = await PATCH(createRequest({ memberId: targetMember.id, attendanceStatus: 'LEAVE' }), {
                params: { gangId, sessionId },
            });

            expect(res.status).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(2);
            expect(fetchMock.mock.calls[1][0]).toContain('/channels/channel-1/messages/summary-1');
            expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'PATCH' }));
        } finally {
            global.fetch = originalFetch;
            if (originalBotToken === undefined) {
                delete process.env.DISCORD_BOT_TOKEN;
            } else {
                process.env.DISCORD_BOT_TOKEN = originalBotToken;
            }
        }
    });

    it('rejects unsupported LATE attendance updates', async () => {
        (db as any).transaction = vi.fn();

        const res = await PATCH(createRequest({ memberId: 'member-3', attendanceStatus: 'LATE' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('ข้อมูลการอัปเดตเช็คชื่อไม่ถูกต้อง');
        expect((db as any).transaction).not.toHaveBeenCalled();
    });

    it('allows RESET during ACTIVE sessions by deleting the existing attendance record and writing an audit log', async () => {
        const deleteWhere = vi.fn().mockResolvedValue(undefined);
        const auditValues = vi.fn().mockResolvedValue(undefined);

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'ACTIVE',
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: 'member-4', name: 'Delta' }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'record-4',
                    status: 'PRESENT',
                    checkedInAt: new Date('2025-01-01T10:00:00.000Z'),
                    penaltyAmount: 0,
                }),
            },
        };
        (db as any).delete = vi.fn().mockReturnValue({ where: deleteWhere });
        (db as any).insert = vi.fn().mockReturnValue({ values: auditValues });

        const res = await PATCH(createRequest({ memberId: 'member-4', attendanceStatus: 'RESET' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        expect((db as any).delete).toHaveBeenCalled();
        expect(deleteWhere).toHaveBeenCalled();
        expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
            action: 'ATTENDANCE_UPDATE',
            targetId: 'record-4',
            details: expect.stringContaining('"operation":"RESET"'),
        }));
    });

    it('patches the active Discord attendance message after an ACTIVE reset', async () => {
        const deleteWhere = vi.fn().mockResolvedValue(undefined);
        const auditValues = vi.fn().mockResolvedValue(undefined);
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        const originalFetch = global.fetch;
        const originalBotToken = process.env.DISCORD_BOT_TOKEN;

        global.fetch = fetchMock as any;
        process.env.DISCORD_BOT_TOKEN = 'test-token';

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'ACTIVE',
                    sessionName: 'War Room',
                    sessionDate: new Date('2025-01-01T00:00:00.000Z'),
                    startTime: new Date('2025-01-01T12:00:00.000Z'),
                    endTime: new Date('2025-01-01T13:00:00.000Z'),
                    discordChannelId: 'attendance-channel-1',
                    discordMessageId: 'attendance-message-1',
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: 'member-4', name: 'Delta' }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue({
                    id: 'record-4',
                    status: 'PRESENT',
                    checkedInAt: new Date('2025-01-01T10:00:00.000Z'),
                    penaltyAmount: 0,
                }),
                findMany: vi.fn().mockResolvedValue([{
                    id: 'record-5',
                    status: 'PRESENT',
                    checkedInAt: new Date('2025-01-01T10:05:00.000Z'),
                    penaltyAmount: 0,
                    member: { name: 'Echo' },
                }]),
            },
        };
        (db as any).delete = vi.fn().mockReturnValue({ where: deleteWhere });
        (db as any).insert = vi.fn().mockReturnValue({ values: auditValues });

        try {
            const res = await PATCH(createRequest({ memberId: 'member-4', attendanceStatus: 'RESET' }), {
                params: { gangId, sessionId },
            });

            expect(res.status).toBe(200);
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(fetchMock.mock.calls[0][0]).toContain('/channels/attendance-channel-1/messages/attendance-message-1');
            expect(fetchMock.mock.calls[0][1]).toEqual(expect.objectContaining({ method: 'PATCH' }));
            const body = JSON.parse(fetchMock.mock.calls[0][1].body);
            expect(body.embeds[0].fields).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    name: '📊 สรุปล่าสุด',
                    value: expect.stringContaining('มา: **1**'),
                }),
            ]));
        } finally {
            global.fetch = originalFetch;
            if (originalBotToken === undefined) {
                delete process.env.DISCORD_BOT_TOKEN;
            } else {
                process.env.DISCORD_BOT_TOKEN = originalBotToken;
            }
        }
    });

    it('rejects deleting attendance sessions without owner access before DB delete', async () => {
        const deleteMock = vi.fn();
        (requireGangAccess as any).mockRejectedValue(new GangAccessError('Forbidden', 403));
        (db as any).delete = deleteMock;

        const res = await DELETE(createDeleteRequest(), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(403);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(deleteMock).not.toHaveBeenCalled();
    });

    it('rate limits deleting attendance sessions before DB delete', async () => {
        const deleteMock = vi.fn();
        (enforceRouteRateLimit as any).mockResolvedValue(tooManyRequests());
        (db as any).delete = deleteMock;

        const res = await DELETE(createDeleteRequest(), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(429);
        await expect(res.json()).resolves.toMatchObject({ error: 'Too Many Requests' });
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(deleteMock).not.toHaveBeenCalled();
    });

    it('deletes attendance sessions for owners', async () => {
        const deleteWhere = vi.fn().mockResolvedValue(undefined);
        const deleteMock = vi.fn().mockReturnValue({ where: deleteWhere });
        (db as any).delete = deleteMock;

        const res = await DELETE(createDeleteRequest(), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        expect(requireGangAccess).toHaveBeenCalledWith({ gangId, minimumRole: 'OWNER' });
        expect(deleteMock).toHaveBeenCalledWith(attendanceSessions);
        expect(deleteWhere).toHaveBeenCalled();
    });
});
