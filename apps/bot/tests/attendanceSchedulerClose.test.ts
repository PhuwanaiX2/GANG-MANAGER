import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockDb,
    mockCanAccessFeature,
    mockResolveUncheckedAttendanceStatus,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockDb: {
        query: {
            attendanceRecords: {
                findMany: vi.fn(),
            },
            members: {
                findMany: vi.fn(),
            },
            gangs: {
                findFirst: vi.fn(),
            },
            leaveRequests: {
                findMany: vi.fn(),
            },
        },
        insert: vi.fn(),
        update: vi.fn(),
        transaction: vi.fn(),
    },
    mockCanAccessFeature: vi.fn(),
    mockResolveUncheckedAttendanceStatus: vi.fn(),
    mockEq: vi.fn((left, right) => ({ op: 'eq', left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => ({ op: 'and', conditions })),
}));

vi.mock('@gang/database', () => ({
    db: mockDb,
    attendanceSessions: {
        id: 'attendanceSessions.id',
        gangId: 'attendanceSessions.gangId',
    },
    attendanceRecords: {
        id: 'attendanceRecords.id',
        sessionId: 'attendanceRecords.sessionId',
        penaltyAmount: 'attendanceRecords.penaltyAmount',
    },
    members: {
        id: 'members.id',
        gangId: 'members.gangId',
        isActive: 'members.isActive',
        status: 'members.status',
        balance: 'members.balance',
    },
    gangs: {
        id: 'gangs.id',
        balance: 'gangs.balance',
    },
    gangSettings: {},
    transactions: {},
    auditLogs: {},
    leaveRequests: {
        gangId: 'leaveRequests.gangId',
        status: 'leaveRequests.status',
        startDate: 'leaveRequests.startDate',
    },
    canAccessFeature: mockCanAccessFeature,
    resolveEffectiveSubscriptionTier: vi.fn((tier: string) => tier),
    isManualRollCallSession: vi.fn((mode?: string | null) => mode === 'MANUAL_ROLL_CALL'),
    partitionAttendanceRecords: vi.fn(() => ({ present: [], absent: [], leave: [] })),
    resolveUncheckedAttendanceStatus: mockResolveUncheckedAttendanceStatus,
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
    lte: vi.fn((left, right) => ({ op: 'lte', left, right })),
    sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

vi.mock('../src/index', () => ({
    client: {
        guilds: {
            cache: new Map(),
        },
    },
}));

vi.mock('../src/utils/logger', () => ({
    logError: vi.fn(),
    logInfo: vi.fn(),
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'generated-id'),
}));

import { closeSessionAndReport } from '../src/services/attendanceScheduler';
import { attendanceRecords, attendanceSessions, members } from '@gang/database';

describe('closeSessionAndReport', () => {
    const session = {
        id: 'session-1',
        gangId: 'gang-1',
        sessionName: 'Manual close',
        sessionDate: new Date('2026-05-09T00:00:00.000Z'),
        startTime: new Date('2026-05-09T13:00:00.000Z'),
        endTime: new Date('2026-05-09T14:00:00.000Z'),
        absentPenalty: 150,
        subscriptionTier: 'PREMIUM',
        status: 'ACTIVE',
        closedAt: null,
        mode: 'MANUAL_ROLL_CALL',
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockCanAccessFeature.mockReturnValue(true);
        mockResolveUncheckedAttendanceStatus.mockReturnValue('ABSENT');
    });

    it('stores new absent records with penaltyAmount 0, then claims the penalty record before charging the member', async () => {
        const insertedRecords: any[] = [];
        const recordPenaltyReturning = vi.fn().mockResolvedValue([{ updatedId: 'record-1' }]);
        const memberUpdateReturning = vi.fn().mockResolvedValue([{ updatedId: 'member-1' }]);
        const txInsertValues = vi.fn().mockResolvedValue(undefined);
        const sessionUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const auditValues = vi.fn().mockResolvedValue(undefined);

        mockDb.query.attendanceRecords.findMany
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{
                id: 'record-1',
                memberId: 'member-1',
                status: 'ABSENT',
                penaltyAmount: 0,
                member: { id: 'member-1', name: 'Alice' },
            }]);
        mockDb.query.members.findMany.mockResolvedValue([{ id: 'member-1', name: 'Alice' }]);
        mockDb.query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'PREMIUM', balance: 9000 });
        mockDb.query.leaveRequests.findMany.mockResolvedValue([]);
        mockDb.insert.mockImplementation((table: any) => ({
            values: vi.fn(async (payload: any) => {
                if (table === attendanceRecords && Array.isArray(payload)) {
                    insertedRecords.push(...payload);
                    return undefined;
                }

                return auditValues(payload);
            }),
        }));
        mockDb.update.mockImplementation((table: any) => {
            if (table === attendanceSessions) {
                return {
                    set: vi.fn().mockReturnValue({
                        where: sessionUpdateWhere,
                    }),
                };
            }

            throw new Error('Unexpected top-level update');
        });
        mockDb.transaction.mockImplementation(async (callback: any) => callback({
            query: {
                members: {
                    findFirst: vi.fn().mockResolvedValue({ balance: 300 }),
                },
                gangs: {
                    findFirst: vi.fn().mockResolvedValue({ balance: 9000 }),
                },
            },
            update: vi.fn((table: any) => {
                if (table === attendanceRecords) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                returning: recordPenaltyReturning,
                            }),
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

                throw new Error('Unexpected tx update');
            }),
            insert: vi.fn().mockReturnValue({ values: txInsertValues }),
        }));

        await closeSessionAndReport(session);

        expect(insertedRecords).toEqual([
            expect.objectContaining({
                memberId: 'member-1',
                status: 'ABSENT',
                penaltyAmount: 0,
            }),
        ]);
        expect(recordPenaltyReturning).toHaveBeenCalledTimes(1);
        expect(memberUpdateReturning).toHaveBeenCalledTimes(1);
        expect(txInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId: 'gang-1',
            memberId: 'member-1',
            type: 'PENALTY',
            amount: 150,
            category: 'ATTENDANCE',
            createdById: 'SYSTEM',
        }));
        expect(sessionUpdateWhere).toHaveBeenCalled();
        expect(auditValues).toHaveBeenCalledWith(expect.objectContaining({
            action: 'ATTENDANCE_CLOSE',
            targetId: 'session-1',
        }));
    });

    it('does not charge the member when another worker already claimed the absent penalty', async () => {
        const recordPenaltyReturning = vi.fn().mockResolvedValue([]);
        const memberBalanceLookup = vi.fn();
        const memberUpdateReturning = vi.fn();
        const txInsertValues = vi.fn();
        const sessionUpdateWhere = vi.fn().mockResolvedValue(undefined);

        mockDb.query.attendanceRecords.findMany
            .mockResolvedValueOnce([{ id: 'record-1', memberId: 'member-1', status: 'ABSENT' }])
            .mockResolvedValueOnce([{
                id: 'record-1',
                memberId: 'member-1',
                status: 'ABSENT',
                penaltyAmount: 0,
                member: { id: 'member-1', name: 'Alice' },
            }]);
        mockDb.query.members.findMany.mockResolvedValue([{ id: 'member-1', name: 'Alice' }]);
        mockDb.query.gangs.findFirst.mockResolvedValue({ subscriptionTier: 'PREMIUM', balance: 9000 });
        mockDb.insert.mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
        mockDb.update.mockImplementation((table: any) => {
            if (table === attendanceSessions) {
                return {
                    set: vi.fn().mockReturnValue({
                        where: sessionUpdateWhere,
                    }),
                };
            }

            throw new Error('Unexpected top-level update');
        });
        mockDb.transaction.mockImplementation(async (callback: any) => callback({
            query: {
                members: {
                    findFirst: memberBalanceLookup,
                },
                gangs: {
                    findFirst: vi.fn(),
                },
            },
            update: vi.fn((table: any) => {
                if (table === attendanceRecords) {
                    return {
                        set: vi.fn().mockReturnValue({
                            where: vi.fn().mockReturnValue({
                                returning: recordPenaltyReturning,
                            }),
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

                throw new Error('Unexpected tx update');
            }),
            insert: vi.fn().mockReturnValue({ values: txInsertValues }),
        }));

        await closeSessionAndReport(session);

        expect(recordPenaltyReturning).toHaveBeenCalledTimes(1);
        expect(memberBalanceLookup).not.toHaveBeenCalled();
        expect(memberUpdateReturning).not.toHaveBeenCalled();
        expect(txInsertValues).not.toHaveBeenCalled();
        expect(sessionUpdateWhere).toHaveBeenCalled();
    });
});
