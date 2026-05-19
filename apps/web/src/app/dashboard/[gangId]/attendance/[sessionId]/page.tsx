import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { eq, and, desc } from 'drizzle-orm';
import {
    auditLogs,
    attendanceSessions,
    canAccessFeature,
    db,
    gangs,
    getApprovedLeavePreview,
    getAttendanceDisplayCounts,
    getAttendanceSessionModeLabel,
    getAttendanceStatusLabel,
    isManualRollCallSession,
    leaveRequests,
    members,
    resolveEffectiveSubscriptionTier,
} from '@gang/database';
import { Calendar, CheckCircle2, Clock, FileText, History, Monitor, ShieldCheck, Users, XCircle } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { AutoRefresh } from '@/components/AutoRefresh';
import { SessionActions } from './SessionActions';
import { AttendanceSessionDetail } from './AttendanceSessionDetail';
import { AttendanceSessionBackControl, ManualRoundExitGuard } from './ManualRoundExitGuard';

interface Props {
    params: Promise<{ gangId: string; sessionId: string }>;
}

function safeParseJson(value: string | null) {
    if (!value) {
        return null;
    }

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function formatBangkokDate(value: Date | string) {
    return new Date(value).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

function formatBangkokTime(value: Date | string) {
    return new Date(value).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function getStatusBadge(status: string) {
    if (status === 'ACTIVE') {
        return { label: 'เปิดอยู่', className: 'bg-status-success-subtle text-fg-success border-status-success' };
    }

    if (status === 'SCHEDULED') {
        return { label: 'รอเริ่ม', className: 'bg-status-warning-subtle text-fg-warning border-status-warning' };
    }

    if (status === 'CANCELLED') {
        return { label: 'ยกเลิก', className: 'bg-status-danger-subtle text-fg-danger border-status-danger' };
    }

    return { label: 'ปิดแล้ว', className: 'bg-bg-muted text-fg-tertiary border-border-subtle' };
}

function getModeIcon(mode?: string | null) {
    return isManualRollCallSession(mode) ? Monitor : ShieldCheck;
}

export default async function AttendanceSessionPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId, sessionId } = params;

    const attendanceEnabled = await isFeatureEnabled('attendance');
    if (!attendanceEnabled) {
        return <FeatureDisabledBanner featureName="ระบบเช็คชื่อ" />;
    }

    const { access, permissions } = await getGangAccessContextForDiscordId({ gangId, discordId: session.user.discordId });
    const canManageAttendance = permissions.isOwner || permissions.isAdmin || permissions.isAttendanceOfficer;
    const currentMember = access?.member ? { id: access.member.id, name: access.member.name } : null;

    if (!canManageAttendance && !currentMember) {
        return (
            <div className="flex h-[52vh] flex-col items-center justify-center px-6 text-center animate-fade-in">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-token-xl border border-status-danger bg-status-danger-subtle">
                    <Clock className="h-6 w-6 text-fg-danger" />
                </div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-token-full border border-status-danger bg-status-danger-subtle px-3 py-1">
                    <span className="h-1.5 w-1.5 rounded-token-full bg-status-danger" />
                    <span className="text-[10px] font-bold text-fg-danger">ไม่มีสิทธิ์</span>
                </div>
                <h1 className="mb-2 font-heading text-2xl font-black tracking-tight text-fg-primary">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="max-w-md text-sm text-fg-tertiary">
                    ไม่พบสิทธิ์ใช้งานหรือข้อมูลสมาชิกสำหรับระบบเช็คชื่อ
                </p>
            </div>
        );
    }

    const attendanceSession = await db.query.attendanceSessions.findFirst({
        where: and(
            eq(attendanceSessions.id, sessionId),
            eq(attendanceSessions.gangId, gangId)
        ),
        with: {
            records: {
                with: {
                    member: true,
                },
            },
        },
    });

    if (!attendanceSession) redirect(`/dashboard/${gangId}/attendance`);

    const isManualSession = isManualRollCallSession(attendanceSession.mode);
    const isSessionClosed = attendanceSession.status === 'CLOSED';
    const shouldCancelManualOnExit = isManualSession && attendanceSession.status === 'ACTIVE';
    const statusBadge = getStatusBadge(attendanceSession.status);

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const willApplyAbsencePenalty = gang
        ? canAccessFeature(resolveEffectiveSubscriptionTier(gang.subscriptionTier, gang.subscriptionExpiresAt), 'finance')
        : false;

    const allMembers = canManageAttendance ? await db.query.members.findMany({
        where: and(
            eq(members.gangId, gangId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    }) : [];

    const checkedInMemberIds = new Set(attendanceSession.records.map((record) => record.memberId));
    const liveNotCheckedIn = allMembers.filter((member) => !checkedInMemberIds.has(member.id));
    const notCheckedIn = attendanceSession.status === 'ACTIVE' ? liveNotCheckedIn : [];
    const approvedLeavePreviewByMemberId: Record<string, { note: string; type: 'FULL' | 'LATE'; statusLabel: string }> = {};

    if (canManageAttendance && attendanceSession.status === 'ACTIVE') {
        const approvedLeaves = await db.query.leaveRequests.findMany({
            where: and(
                eq(leaveRequests.gangId, gangId),
                eq(leaveRequests.status, 'APPROVED')
            ),
        });

        for (const leave of approvedLeaves) {
            const preview = getApprovedLeavePreview({
                attendanceSession,
                leave,
            });

            if (preview) {
                approvedLeavePreviewByMemberId[leave.memberId] = preview;
            }
        }
    }

    const recentAuditLogs = canManageAttendance ? await db.query.auditLogs.findMany({
        where: eq(auditLogs.gangId, gangId),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 100,
    }) : [];

    const attendanceHistory = recentAuditLogs
        .map((log) => ({
            ...log,
            details: safeParseJson(log.details),
            oldValue: safeParseJson(log.oldValue),
            newValue: safeParseJson(log.newValue),
        }))
        .filter((log) => {
            if (log.targetType === 'ATTENDANCE_SESSION' && log.targetId === sessionId) {
                return true;
            }

            return log.details?.sessionId === sessionId;
        })
        .slice(0, 12);

    const visibleAttendanceHistory = isSessionClosed
        ? attendanceHistory
        : isManualSession
        ? attendanceHistory.filter((log) => log.action === 'ATTENDANCE_UPDATE' && log.details?.sessionStatus === 'CLOSED')
        : attendanceHistory;
    const showHistoryPanel = isSessionClosed || visibleAttendanceHistory.length > 0 || !isManualSession;
    const closeLog = attendanceHistory.find((log) => log.action === 'ATTENDANCE_CLOSE') ?? null;
    const durationMinutes = Math.max(0, Math.round((new Date(attendanceSession.endTime).getTime() - new Date(attendanceSession.startTime).getTime()) / 60000));

    const getHistoryLabel = (log: typeof attendanceHistory[number]) => {
        if (log.action === 'ATTENDANCE_CREATE') return 'สร้างรอบเช็คชื่อ';
        if (log.action === 'ATTENDANCE_START') return 'เปิดรอบเช็คชื่อ';
        if (log.action === 'ATTENDANCE_CLOSE') return 'ปิดรอบเช็คชื่อ';
        if (log.action === 'ATTENDANCE_CANCEL') return 'ยกเลิกรอบเช็คชื่อ';
        if (log.action === 'ATTENDANCE_UPDATE') {
            if (log.details?.operation === 'RESET') return `รีเซ็ต ${log.details?.memberName || 'สมาชิก'}`;
            return `อัปเดต ${log.details?.memberName || 'สมาชิก'}`;
        }

        return log.action;
    };

    const previewLeaveCount = attendanceSession.status === 'ACTIVE'
        ? notCheckedIn.filter((member) => approvedLeavePreviewByMemberId[member.id]).length
        : 0;
    const uncheckedCount = attendanceSession.status === 'ACTIVE'
        ? notCheckedIn.filter((member) => !approvedLeavePreviewByMemberId[member.id]).length
        : 0;
    const displayCounts = getAttendanceDisplayCounts(attendanceSession.records, {
        includeOpenRoster: attendanceSession.status === 'ACTIVE',
        previewLeaveCount,
        uncheckedCount,
    });
    const counts = displayCounts;
    const totalMembers = displayCounts.total;
    const presentPercent = totalMembers > 0 ? Math.round((counts.present / totalMembers) * 100) : 0;
    const displayUnchecked = counts.unchecked;
    const ModeIcon = getModeIcon(attendanceSession.mode);
    const progressLabel = attendanceSession.status === 'CLOSED' ? 'อัตรามา' : 'ความคืบหน้า';
    const progressValue = attendanceSession.status === 'CLOSED'
        ? `${presentPercent}%`
        : `${totalMembers - displayUnchecked}/${totalMembers}`;
    const shouldAutoRefresh = canManageAttendance && !(isManualSession && attendanceSession.status === 'ACTIVE');

    return (
        <div className="space-y-4 animate-fade-in-up sm:space-y-5">
            <ManualRoundExitGuard gangId={gangId} sessionId={sessionId} enabled={shouldCancelManualOnExit} />
            {shouldAutoRefresh ? <AutoRefresh interval={15} /> : null}

            <div className="ops-surface overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="border-b border-border-subtle bg-bg-muted/80 p-4 sm:p-5">
                <div className="relative z-10 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="flex items-start gap-3 sm:gap-4">
                        <AttendanceSessionBackControl gangId={gangId} sessionId={sessionId} enabled={shouldCancelManualOnExit} />
                        <div className="min-w-0">
                            <div className="mb-2 flex flex-wrap items-center gap-2.5">
                                <h1 className="min-w-0 break-words font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">
                                    {attendanceSession.sessionName}
                                </h1>
                                <span data-testid="attendance-session-status" className={`rounded-token-md border px-2.5 py-1 text-[10px] font-bold ${statusBadge.className}`}>
                                    {statusBadge.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-sm font-medium tracking-wide text-fg-tertiary">
                                <span data-testid="attendance-session-mode" className={`flex items-center gap-1.5 rounded-token-md border px-2.5 py-1 text-xs font-black ${isManualSession ? 'border-status-warning bg-status-warning-subtle text-fg-warning' : 'border-status-success bg-status-success-subtle text-fg-success'}`}>
                                    <ModeIcon className="h-3.5 w-3.5" />
                                    {getAttendanceSessionModeLabel(attendanceSession.mode)}
                                </span>
                                <span className="flex items-center gap-1.5 rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1">
                                    <Calendar className="h-4 w-4 text-fg-secondary" />
                                    {formatBangkokDate(attendanceSession.sessionDate)}
                                </span>
                                {!isManualSession ? (
                                    <span className="flex items-center gap-1.5 rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 tabular-nums">
                                        <Clock className="h-4 w-4 text-fg-secondary" />
                                        {formatBangkokTime(attendanceSession.startTime)} - {formatBangkokTime(attendanceSession.endTime)}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    </div>
                    {isSessionClosed ? null : (
                        <SessionActions
                            gangId={gangId}
                            sessionId={sessionId}
                            currentStatus={attendanceSession.status}
                            canManageAttendance={canManageAttendance}
                            willApplyAbsencePenalty={willApplyAbsencePenalty}
                            sessionMode={attendanceSession.mode}
                            uncheckedCount={uncheckedCount}
                        />
                    )}
                </div>
                </div>

                {isManualSession && attendanceSession.status === 'ACTIVE' ? (
                    <div className="grid gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="rounded-token-xl border border-status-warning/25 bg-status-warning-subtle/45 p-4">
                            <p className="text-sm font-black text-fg-primary">สถิติรอบนี้อัปเดตจากตารางด้านล่าง</p>
                            <p className="mt-1 text-xs leading-relaxed text-fg-secondary">
                                ปุ่ม มา/ขาด/ลา เป็นร่างก่อนบันทึกจริง ระบบจะสรุปตัวเลขในตารางทันที และจะบันทึกลงฐานข้อมูลตอนกด “ยืนยันจบ”
                            </p>
                        </div>
                        <SessionMetric icon={Users} label="สมาชิกในรอบ" value={totalMembers} suffix="คน" />
                    </div>
                ) : (
                    <div className="grid gap-4 p-4 sm:p-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                            <SessionMetric icon={Users} label="ทั้งหมด" value={totalMembers} suffix="คน" />
                            <SessionMetric icon={CheckCircle2} label="มา" value={counts.present} suffix="คน" tone="success" />
                            <SessionMetric icon={XCircle} label="ขาด" value={counts.absent} suffix="คน" tone="danger" />
                            <SessionMetric icon={FileText} label="ลา" value={counts.leave} suffix="คน" tone="info" />
                            <SessionMetric icon={Clock} label={attendanceSession.status === 'CLOSED' ? 'เปอร์เซ็นต์' : 'ยังไม่เช็ค'} value={attendanceSession.status === 'CLOSED' ? presentPercent : displayUnchecked} suffix={attendanceSession.status === 'CLOSED' ? '%' : 'คน'} tone="warning" />
                        </div>

                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-4">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-[10px] font-bold text-fg-tertiary">{progressLabel}</span>
                                <span className="text-sm font-black text-fg-primary tabular-nums">{progressValue}</span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-token-full bg-bg-subtle">
                                <div className="h-full rounded-token-full bg-status-success transition-[width] duration-500" style={{ width: `${Math.min(presentPercent, 100)}%` }} />
                            </div>
                            <p className="mt-2 text-xs leading-relaxed text-fg-tertiary">
                                {attendanceSession.status === 'CLOSED'
                                    ? 'ใช้หน้านี้ตรวจย้อนหลังและแก้ไขเฉพาะรายการที่จำเป็น'
                                    : 'ตารางจะอัปเดตตามการเช็คชื่อจาก Discord และ refresh อัตโนมัติสำหรับเจ้าหน้าที่'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {canManageAttendance ? (
                <div className="space-y-4">
                    <AttendanceSessionDetail
                        gangId={gangId}
                        sessionId={sessionId}
                        records={attendanceSession.records}
                        notCheckedIn={notCheckedIn}
                        leavePreviewByMemberId={approvedLeavePreviewByMemberId}
                        isSessionActive={attendanceSession.status === 'ACTIVE'}
                        isSessionClosed={attendanceSession.status === 'CLOSED'}
                        canManageAttendance={canManageAttendance}
                        sessionMode={attendanceSession.mode}
                        absentPenalty={attendanceSession.absentPenalty}
                    />

                    {showHistoryPanel ? (
                    <aside className="space-y-4" data-testid="attendance-history-panel">
                        {isSessionClosed ? (
                            <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                                <div className="border-b border-border-subtle bg-bg-muted px-4 py-3.5 sm:px-5">
                                    <h2 className="text-sm font-black tracking-wide text-fg-primary">รายละเอียดรอบเช็คชื่อ</h2>
                                </div>
                                <div className="divide-y divide-border-subtle px-4 text-sm sm:px-5">
                                    <SessionDetailRow label="สถานะรอบ" value={statusBadge.label} tone="danger" />
                                    <SessionDetailRow label="โหมดการเช็คชื่อ" value={getAttendanceSessionModeLabel(attendanceSession.mode)} />
                                    <SessionDetailRow label="เริ่มรอบ" value={`${formatBangkokDate(attendanceSession.startTime)} ${formatBangkokTime(attendanceSession.startTime)}`} />
                                    <SessionDetailRow label="ปิดรอบ" value={`${formatBangkokDate(attendanceSession.endTime)} ${formatBangkokTime(attendanceSession.endTime)}`} />
                                    <SessionDetailRow label="ระยะเวลา" value={`${durationMinutes} นาที`} />
                                    <div className="flex items-center justify-between gap-3 py-3">
                                        <span className="text-xs font-bold text-fg-tertiary">สร้างโดย</span>
                                        <div className="text-right">
                                            <p className="text-sm font-black text-fg-primary">{closeLog?.actorName || 'ระบบ'}</p>
                                            <p className="text-[11px] text-fg-tertiary">
                                                {closeLog ? new Date(closeLog.createdAt).toLocaleString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                }) : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                            <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3.5 sm:px-5">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-10 w-10 items-center justify-center rounded-token-xl border border-border-subtle bg-bg-subtle">
                                        <History className="h-4 w-4 text-fg-secondary" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-black tracking-wide text-fg-primary">ประวัติการแก้ไข</h2>
                                        <p className="text-xs text-fg-tertiary">
                                            {isManualSession ? 'แสดงเฉพาะการแก้ผลหลังปิดรอบ' : 'เหตุการณ์สำคัญและการแก้ไขรายคน'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {visibleAttendanceHistory.length === 0 ? (
                                <div className="px-6 py-8 text-sm text-fg-tertiary">ยังไม่มีประวัติสำหรับรอบนี้</div>
                            ) : (
                                <>
                                    <div className="divide-y divide-border-subtle">
                                    {visibleAttendanceHistory.map((log) => (
                                        <div key={log.id} data-testid={`attendance-history-entry-${log.action.toLowerCase()}`} className="grid gap-3 px-4 py-3.5 transition-colors hover:bg-bg-muted/70 sm:grid-cols-[minmax(0,1fr)_minmax(180px,260px)_170px] sm:items-center sm:px-5">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-fg-primary">{getHistoryLabel(log)}</p>
                                                <p className="mt-1 truncate text-xs text-fg-tertiary">{log.actorName}</p>
                                            </div>
                                            <div className="rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2 text-xs font-semibold text-fg-secondary">
                                                {getAttendanceStatusLabel(log.oldValue?.status)} → {log.newValue?.status ? getAttendanceStatusLabel(log.newValue.status) : 'ยังไม่เข้า'}
                                            </div>
                                            <p className="text-[11px] font-semibold text-fg-tertiary tabular-nums sm:text-right">
                                                {new Date(log.createdAt).toLocaleString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                        </div>
                    </aside>
                    ) : null}
                </div>
            ) : (
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-4 text-sm leading-relaxed text-fg-secondary shadow-token-sm">
                    รอบนี้ให้ติดตามสถานะจาก Discord หรือสอบถามเจ้าหน้าที่ประจำแก๊ง หากต้องการแจ้งลาหรือแจ้งเข้าช้าให้ใช้หน้า “การลา”
                </div>
            )}
        </div>
    );
}

function SessionMetric({
    icon: Icon,
    label,
    value,
    suffix,
    tone = 'default',
    testId,
}: {
    icon: typeof Users;
    label: string;
    value: number;
    suffix: string;
    tone?: 'default' | 'success' | 'danger' | 'info' | 'warning';
    testId?: string;
}) {
    const toneClass = {
        default: 'border-border-subtle bg-bg-muted text-fg-secondary',
        success: 'border-status-success/25 bg-status-success-subtle text-fg-success',
        danger: 'border-status-danger/25 bg-status-danger-subtle text-fg-danger',
        info: 'border-status-info/25 bg-status-info-subtle text-fg-info',
        warning: 'border-status-warning/25 bg-status-warning-subtle text-fg-warning',
    }[tone];

    return (
        <div className={`rounded-token-xl border p-3 shadow-token-sm ${toneClass}`}>
            <div className="mb-2 flex items-center gap-2 text-xs font-black">
                <span className="flex h-9 w-9 items-center justify-center rounded-token-lg bg-bg-subtle/80">
                    <Icon className="h-4 w-4" />
                </span>
                {label}
            </div>
            <p data-testid={testId} className="text-2xl font-black text-fg-primary tabular-nums">
                {value}
                <span className="ml-1 text-xs font-bold text-fg-tertiary">{suffix}</span>
            </p>
        </div>
    );
}
function SessionDetailRow({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: string;
    tone?: 'default' | 'danger';
}) {
    return (
        <div className="flex items-center justify-between gap-3 py-3">
            <span className="text-xs font-bold text-fg-tertiary">{label}</span>
            <span className={`text-right text-sm font-black ${tone === 'danger' ? 'text-fg-danger' : 'text-fg-primary'}`}>
                {value}
            </span>
        </div>
    );
}
