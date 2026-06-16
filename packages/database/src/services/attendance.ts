export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE' | 'LATE';
export type FinalAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE';
export type AttendanceActionStatus = FinalAttendanceStatus | 'RESET';
export type LeaveType = 'FULL' | 'LATE';
export type AttendanceSessionMode = 'DISCORD_SELF_CHECKIN' | 'MANUAL_ROLL_CALL';
export type AttendanceCountingPolicy = 'REQUIRED' | 'SUPPLEMENTAL';
export type AttendanceVerificationMode = 'NONE' | 'CODE' | 'PHOTO';

export const DEFAULT_ATTENDANCE_SESSION_MODE: AttendanceSessionMode = 'DISCORD_SELF_CHECKIN';
export const DEFAULT_ATTENDANCE_COUNTING_POLICY: AttendanceCountingPolicy = 'REQUIRED';
export const DEFAULT_ATTENDANCE_VERIFICATION_MODE: AttendanceVerificationMode = 'NONE';

export function normalizeAttendanceSessionMode(mode?: string | null): AttendanceSessionMode {
    return mode === 'MANUAL_ROLL_CALL' ? 'MANUAL_ROLL_CALL' : DEFAULT_ATTENDANCE_SESSION_MODE;
}

export function isManualRollCallSession(mode?: string | null) {
    return normalizeAttendanceSessionMode(mode) === 'MANUAL_ROLL_CALL';
}

export function normalizeAttendanceCountingPolicy(policy?: string | null): AttendanceCountingPolicy {
    return policy === 'SUPPLEMENTAL' ? 'SUPPLEMENTAL' : DEFAULT_ATTENDANCE_COUNTING_POLICY;
}

export function isSupplementalAttendanceSession(policy?: string | null) {
    return normalizeAttendanceCountingPolicy(policy) === 'SUPPLEMENTAL';
}

export function getAttendanceCountingPolicyLabel(policy?: string | null) {
    return isSupplementalAttendanceSession(policy) ? 'รอบเสริม' : 'รอบบังคับ';
}

export function normalizeAttendanceVerificationMode(mode?: string | null): AttendanceVerificationMode {
    if (mode === 'CODE') return 'CODE';
    if (mode === 'PHOTO') return 'PHOTO';
    return DEFAULT_ATTENDANCE_VERIFICATION_MODE;
}

export function requiresAttendanceCode(mode?: string | null) {
    return normalizeAttendanceVerificationMode(mode) === 'CODE';
}

export function getAttendanceVerificationModeLabel(mode?: string | null) {
    const normalized = normalizeAttendanceVerificationMode(mode);
    if (normalized === 'CODE') return 'กรอกรหัส';
    if (normalized === 'PHOTO') return 'แนบรูป';
    return 'กดเช็คชื่อ';
}

export function getAttendanceSessionModeLabel(mode?: string | null) {
    return isManualRollCallSession(mode) ? 'เช็คโดยเจ้าหน้าที่' : 'เช็คผ่าน Discord';
}

export interface ApprovedLeavePreview {
    note: string;
    type: LeaveType;
    statusLabel: string;
}

export interface AttendanceSessionLike {
    startTime: Date | string;
    endTime: Date | string;
    status?: string | null;
    countingPolicy?: string | null;
    verificationMode?: string | null;
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

function formatDateKey(value: Date, timeZone: 'Asia/Bangkok' | 'UTC' = 'Asia/Bangkok') {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(value);
}

function isUtcFullDayRange(start: Date, end: Date) {
    return start.getUTCHours() === 0
        && start.getUTCMinutes() === 0
        && start.getUTCSeconds() === 0
        && start.getUTCMilliseconds() === 0
        && end.getUTCHours() === 23
        && end.getUTCMinutes() === 59
        && end.getUTCSeconds() === 59;
}

function getFullLeaveDateRange(start: Date, end: Date) {
    const leaveTimeZone = isUtcFullDayRange(start, end) ? 'UTC' : 'Asia/Bangkok';

    return {
        startKey: formatDateKey(start, leaveTimeZone),
        endKey: formatDateKey(end, leaveTimeZone),
    };
}

function isFullLeaveOverlappingSession(attendanceSession: AttendanceSessionLike, leave: Pick<LeaveRequestLike, 'startDate' | 'endDate'>) {
    const sessionStart = toDate(attendanceSession.startTime);
    const sessionEnd = toDate(attendanceSession.endTime);
    const leaveStart = toDate(leave.startDate);
    const leaveEnd = toDate(leave.endDate);
    const sessionStartKey = formatDateKey(sessionStart);
    const sessionEndKey = formatDateKey(sessionEnd);
    const leaveRange = getFullLeaveDateRange(leaveStart, leaveEnd);

    return sessionStartKey <= leaveRange.endKey && sessionEndKey >= leaveRange.startKey;
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

export function getAttendanceDisplayCounts<T extends AttendanceRecordLike>(
    records: T[],
    options: {
        includeOpenRoster?: boolean;
        previewLeaveCount?: number;
        uncheckedCount?: number;
    } = {}
) {
    const buckets = getAttendanceBucketCounts(records);
    const previewLeave = options.includeOpenRoster ? Math.max(0, options.previewLeaveCount ?? 0) : 0;
    const unchecked = options.includeOpenRoster ? Math.max(0, options.uncheckedCount ?? 0) : 0;

    return {
        present: buckets.present,
        absent: buckets.absent,
        leave: buckets.leave + previewLeave,
        unchecked,
        total: buckets.total + previewLeave + unchecked,
    };
}

export function isApprovedLeaveApplicableToSession(attendanceSession: AttendanceSessionLike, leave: Pick<LeaveRequestLike, 'type' | 'startDate' | 'endDate'>) {
    const sessionStart = toDate(attendanceSession.startTime);
    const sessionEnd = toDate(attendanceSession.endTime);
    const leaveStart = toDate(leave.startDate);

    if (leave.type === 'FULL') {
        return isFullLeaveOverlappingSession(attendanceSession, leave);
    }

    const leaveEnd = toDate(leave.endDate);
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

    if (leave.type === 'FULL') {
        if (isFullLeaveOverlappingSession(attendanceSession, leave)) {
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
