export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE';
export type FinalAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE';
export type AttendanceActionStatus = FinalAttendanceStatus | 'RESET';
export type LeaveType = 'FULL' | 'LATE';

export interface ApprovedLeavePreview {
    note: string;
    type: LeaveType;
    statusLabel: string;
}

export interface AttendanceSessionLike {
    startTime: Date | string;
    endTime: Date | string;
    status?: string | null;
}

export interface LeaveRequestLike {
    memberId: string;
    type: LeaveType | string;
    startDate: Date | string;
    endDate: Date | string;
    status?: string | null;
}

export interface AttendanceRecordLike {
    status?: string | null;
}

function toDate(value: Date | string) {
    return value instanceof Date ? new Date(value) : new Date(value);
}

export function normalizeAttendanceStatus(status?: string | null) {
    if (!status) return null;
    if (status === 'LATE') return 'PRESENT';
    return status;
}

export function isPresentLikeStatus(status?: string | null) {
    return normalizeAttendanceStatus(status) === 'PRESENT';
}

export function getAttendanceStatusLabel(status?: string | null) {
    const normalizedStatus = normalizeAttendanceStatus(status);

    if (!normalizedStatus) return 'ยังไม่ระบุ';
    if (normalizedStatus === 'PRESENT') return 'มา';
    if (normalizedStatus === 'ABSENT') return 'ขาด';
    if (normalizedStatus === 'LEAVE') return 'ลา';
    return normalizedStatus;
}

export function partitionAttendanceRecords<T extends AttendanceRecordLike>(records: T[]) {
    const present: T[] = [];
    const absent: T[] = [];
    const leave: T[] = [];

    for (const record of records) {
        const normalizedStatus = normalizeAttendanceStatus(record.status);

        if (normalizedStatus === 'PRESENT') {
            present.push(record);
            continue;
        }

        if (normalizedStatus === 'ABSENT') {
            absent.push(record);
            continue;
        }

        if (normalizedStatus === 'LEAVE') {
            leave.push(record);
        }
    }

    return { present, absent, leave };
}

export function getAttendanceBucketCounts<T extends AttendanceRecordLike>(records: T[]) {
    const { present, absent, leave } = partitionAttendanceRecords(records);

    return {
        present: present.length,
        absent: absent.length,
        leave: leave.length,
        total: present.length + absent.length + leave.length,
    };
}

export function isApprovedLeaveApplicableToSession(attendanceSession: AttendanceSessionLike, leave: Pick<LeaveRequestLike, 'type' | 'startDate' | 'endDate'>) {
    const sessionStart = toDate(attendanceSession.startTime);
    const sessionEnd = toDate(attendanceSession.endTime);
    const leaveStart = toDate(leave.startDate);
    const leaveEnd = toDate(leave.endDate);

    if (leave.type === 'FULL') {
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(23, 59, 59, 999);
        return sessionStart >= leaveStart && sessionStart <= leaveEnd;
    }

    if (leave.type === 'LATE') {
        return sessionStart < leaveStart && sessionEnd <= leaveStart;
    }

    return false;
}

export function findApplicableApprovedLeave<T extends LeaveRequestLike>(params: {
    attendanceSession: AttendanceSessionLike;
    leaves: T[];
    memberId: string;
}) {
    const { attendanceSession, leaves, memberId } = params;

    return leaves.find((leave) => {
        if (leave.memberId !== memberId) return false;
        if (leave.status && leave.status !== 'APPROVED') return false;
        return isApprovedLeaveApplicableToSession(attendanceSession, leave);
    }) || null;
}

export function resolveUncheckedAttendanceStatus(params: {
    attendanceSession: AttendanceSessionLike;
    memberId: string;
    approvedLeaves: LeaveRequestLike[];
}) {
    const activeLeave = findApplicableApprovedLeave({
        attendanceSession: params.attendanceSession,
        leaves: params.approvedLeaves,
        memberId: params.memberId,
    });
    return activeLeave ? 'LEAVE' : 'ABSENT';
}

export function getApprovedLeavePreview(params: {
    attendanceSession: AttendanceSessionLike;
    leave: Pick<LeaveRequestLike, 'type' | 'startDate' | 'endDate'>;
    now?: Date;
}): ApprovedLeavePreview | null {
    const { attendanceSession, leave } = params;
    const now = params.now ? new Date(params.now) : new Date();
    const sessionStart = toDate(attendanceSession.startTime);
    const sessionEnd = toDate(attendanceSession.endTime);
    const leaveStart = toDate(leave.startDate);
    const leaveEnd = toDate(leave.endDate);

    if (leave.type === 'FULL') {
        leaveStart.setHours(0, 0, 0, 0);
        leaveEnd.setHours(23, 59, 59, 999);

        if (sessionStart >= leaveStart && sessionStart <= leaveEnd) {
            return {
                note: 'ลาที่อนุมัติแล้ว',
                type: 'FULL',
                statusLabel: 'ลา',
            };
        }
    }

    if (leave.type === 'LATE' && sessionStart < leaveStart && sessionEnd > leaveStart && now <= leaveStart) {
        return {
            note: `แจ้งเข้าช้าถึง ${leaveStart.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })} น.`,
            type: 'LATE',
            statusLabel: 'แจ้งเข้าช้า',
        };
    }

    return null;
}
