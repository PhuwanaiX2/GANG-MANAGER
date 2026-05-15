import { describe, expect, it, vi } from 'vitest';

vi.mock('@gang/database', () => ({
    attendanceRecords: {
        id: 'attendanceRecords.id',
        sessionId: 'attendanceRecords.sessionId',
        memberId: 'attendanceRecords.memberId',
        status: 'attendanceRecords.status',
        penaltyAmount: 'attendanceRecords.penaltyAmount',
    },
}));

import {
    AttendanceRecordConflictError,
    insertAttendanceRecordWithConflictGuard,
    updateAttendanceRecordWithOCC,
} from '@/lib/attendanceRecordWrites';

describe('attendance record write helpers', () => {
    it('throws a conflict when optimistic update affects no rows', async () => {
        const returning = vi.fn().mockResolvedValue([]);
        const where = vi.fn(() => ({ returning }));
        const set = vi.fn(() => ({ where }));
        const update = vi.fn(() => ({ set }));

        await expect(updateAttendanceRecordWithOCC(
            { update },
            { id: 'record-1', status: 'PRESENT', penaltyAmount: 0 },
            { status: 'ABSENT', checkedInAt: null, penaltyAmount: 500 }
        )).rejects.toBeInstanceOf(AttendanceRecordConflictError);

        expect(update).toHaveBeenCalledTimes(1);
        expect(returning).toHaveBeenCalledWith({ updatedId: 'attendanceRecords.id' });
    });

    it('throws a conflict when insert is skipped by the unique session/member guard', async () => {
        const returning = vi.fn().mockResolvedValue([]);
        const onConflictDoNothing = vi.fn(() => ({ returning }));
        const values = vi.fn(() => ({ onConflictDoNothing }));
        const insert = vi.fn(() => ({ values }));

        await expect(insertAttendanceRecordWithConflictGuard(
            { insert },
            {
                id: 'record-1',
                sessionId: 'session-1',
                memberId: 'member-1',
                status: 'PRESENT',
                checkedInAt: new Date('2026-05-14T00:00:00.000Z'),
                penaltyAmount: 0,
            }
        )).rejects.toBeInstanceOf(AttendanceRecordConflictError);

        expect(insert).toHaveBeenCalledTimes(1);
        expect(onConflictDoNothing).toHaveBeenCalledWith({
            target: ['attendanceRecords.sessionId', 'attendanceRecords.memberId'],
        });
    });
});
