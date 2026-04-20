import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/permissions');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
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
    };
});

import { getServerSession } from 'next-auth';
import { getGangPermissions } from '@/lib/permissions';
import {
    db,
    canAccessFeature,
    attendanceRecords,
    members,
} from '@gang/database';
import { PATCH } from '@/app/api/gangs/[gangId]/attendance/[sessionId]/route';

describe('PATCH /api/gangs/[gangId]/attendance/[sessionId]', () => {
    const gangId = 'gang-123';
    const sessionId = 'session-123';
    const userDiscordId = 'user-123';
    const actorMemberId = 'actor-member-1';

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api', {
        method: 'PATCH',
        body: JSON.stringify(body),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({
            user: { discordId: userDiscordId, name: 'Admin User' },
        });
        (getGangPermissions as any).mockResolvedValue({ isAdmin: true, isOwner: false, isAttendanceOfficer: false });
        (canAccessFeature as any).mockReturnValue(true);
    });

    it('allows ATTENDANCE_OFFICER to pass the attendance update permission gate', async () => {
        (getGangPermissions as any).mockResolvedValue({ isAdmin: false, isOwner: false, isAttendanceOfficer: true });

        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                    allowLate: true,
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
    });

    it('allows updating CLOSED sessions and creates a negative penalty delta when reducing a penalty', async () => {
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
                    allowLate: true,
                    latePenalty: 50,
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

        const res = await PATCH(createRequest({ memberId: targetMember.id, attendanceStatus: 'LATE' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(200);
        expect((db as any).transaction).toHaveBeenCalledTimes(1);
        expect(txInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            gangId,
            memberId: targetMember.id,
            type: 'PENALTY',
            amount: -50,
            category: 'ATTENDANCE',
            createdById: actorMemberId,
        }));
        expect(auditInsertValues).toHaveBeenCalledWith(expect.objectContaining({
            targetId: existingRecord.id,
            details: expect.stringContaining('"penaltyDelta":-50'),
            newValue: expect.stringContaining('"penaltyAmount":50'),
        }));
    });

    it('rejects RESET for CLOSED sessions', async () => {
        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'CLOSED',
                    allowLate: true,
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
                    allowLate: true,
                    latePenalty: 25,
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

    it('rejects marking LATE when the session does not allow late attendance', async () => {
        (db as any).query = {
            attendanceSessions: {
                findFirst: vi.fn().mockResolvedValue({
                    id: sessionId,
                    gangId,
                    status: 'ACTIVE',
                    allowLate: false,
                }),
            },
            members: {
                findFirst: vi.fn().mockResolvedValue({ id: 'member-3', name: 'Charlie' }),
            },
            attendanceRecords: {
                findFirst: vi.fn().mockResolvedValue(null),
            },
        };
        (db as any).transaction = vi.fn();

        const res = await PATCH(createRequest({ memberId: 'member-3', attendanceStatus: 'LATE' }), {
            params: { gangId, sessionId },
        });

        expect(res.status).toBe(400);
        const json = await res.json();
        expect(json.error).toContain('ไม่ได้เปิดให้บันทึกมาสาย');
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
                    allowLate: true,
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
});
