import { attendanceRecords } from '@gang/database';
import { and, eq } from 'drizzle-orm';

type AttendanceRecordSnapshot = {
    id: string;
    status?: string | null;
    penaltyAmount?: number | null;
};

type AttendanceRecordWriteValues = {
    status: string;
    checkedInAt: Date | null;
    penaltyAmount: number;
    notes?: string | null;
};

type AttendanceRecordInsertValues = AttendanceRecordWriteValues & {
    id: string;
    sessionId: string;
    memberId: string;
};

export class AttendanceRecordConflictError extends Error {
    constructor(message = 'Attendance record changed. Please refresh and retry.') {
        super(message);
        this.name = 'AttendanceRecordConflictError';
    }
}

export async function updateAttendanceRecordWithOCC(
    tx: any,
    existingRecord: AttendanceRecordSnapshot,
    values: AttendanceRecordWriteValues
) {
    const updateQuery = tx.update(attendanceRecords)
        .set(values)
        .where(and(
            eq(attendanceRecords.id, existingRecord.id),
            eq(attendanceRecords.status, existingRecord.status || ''),
            eq(attendanceRecords.penaltyAmount, existingRecord.penaltyAmount || 0)
        ));

    if (typeof updateQuery?.returning === 'function') {
        const result = await updateQuery.returning({ updatedId: attendanceRecords.id });
        if (result.length === 0) {
            throw new AttendanceRecordConflictError();
        }
        return;
    }

    await updateQuery;
}

export async function insertAttendanceRecordWithConflictGuard(
    tx: any,
    values: AttendanceRecordInsertValues
) {
    const insertQuery = tx.insert(attendanceRecords).values(values);

    if (typeof insertQuery?.onConflictDoNothing === 'function') {
        const result = await insertQuery
            .onConflictDoNothing({
                target: [attendanceRecords.sessionId, attendanceRecords.memberId],
            })
            .returning({ insertedId: attendanceRecords.id });

        if (result.length === 0) {
            throw new AttendanceRecordConflictError();
        }
        return;
    }

    await insertQuery;
}
