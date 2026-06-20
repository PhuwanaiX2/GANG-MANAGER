import { getServerSession } from 'next-auth';
import nextDynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { eq, and, desc } from 'drizzle-orm';
import {
    auditLogs,
    attendanceSessions,
    canAccessFeature,
    db,
    gangs,
    getApprovedLeavePreview,
    getAttendanceCountingPolicyLabel,
    getAttendanceSessionModeLabel,
    getAttendanceStatusLabel,
    getAttendanceVerificationModeLabel,
    isManualRollCallSession,
    isSupplementalAttendanceSession,
    leaveRequests,
    members,
    resolveEffectiveSubscriptionTier,
} from '@gang/database';
import { Calendar, Clock, History, KeyRound, Monitor, ShieldCheck } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { AutoRefresh } from '@/components/AutoRefresh';

const SessionActions = nextDynamic(() => import('./SessionActions').then((mod) => mod.SessionActions));
const AttendanceSessionDetail = nextDynamic(() => import('./AttendanceSessionDetail').then((mod) => mod.AttendanceSessionDetail));
const AttendanceSessionBackControl = nextDynamic(() => import('./ManualRoundExitGuard').then((mod) => mod.AttendanceSessionBackControl));
const ManualRoundExitGuard = nextDynamic(() => import('./ManualRoundExitGuard').then((mod) => mod.ManualRoundExitGuard));

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
        columns: {
            id: true,
            gangId: true,
            sessionName: true,
            sessionDate: true,
            startTime: true,
            endTime: true,
            status: true,
            mode: true,
            countingPolicy: true,
            verificationMode: true,
            verificationCode: true,
            absentPenalty: true,
        },
        with: {
            records: {
                columns: {
                    id: true,
                    memberId: true,
                    status: true,
                    checkedInAt: true,
                    penaltyAmount: true,
                    notes: true,
                },
                with: {
                    member: {
                        columns: {
                            id: true,
                            name: true,
                            discordAvatar: true,
                            discordUsername: true,
                        },
                    },
                },
            },
        },
    });

    if (!attendanceSession) redirect(`/dashboard/${gangId}/attendance`);

    const isManualSession = isManualRollCallSession(attendanceSession.mode);
    const isSupplementalSession = isSupplementalAttendanceSession(attendanceSession.countingPolicy);
    const isSessionClosed = attendanceSession.status === 'CLOSED';
    const shouldCancelManualOnExit = isManualSession && attendanceSession.status === 'ACTIVE';
    const statusBadge = getStatusBadge(attendanceSession.status);

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const willApplyAbsencePenalty = gang
        ? !isSupplementalSession && canAccessFeature(resolveEffectiveSubscriptionTier(gang.subscriptionTier, gang.subscriptionExpiresAt), 'finance')
        : false;

    const allMembers = canManageAttendance ? await db.query.members.findMany({
        where: and(
            eq(members.gangId, gangId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        columns: {
            id: true,
            name: true,
            discordAvatar: true,
            discordUsername: true,
        },
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
            columns: {
                memberId: true,
                type: true,
                startDate: true,
                endDate: true,
            },
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
        columns: {
            id: true,
            actorName: true,
            action: true,
            targetType: true,
            targetId: true,
            oldValue: true,
            newValue: true,
            details: true,
            createdAt: true,
        },
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

    const getHistoryChangeText = (log: typeof attendanceHistory[number]) => {
        if (log.action === 'ATTENDANCE_UPDATE') {
            const fromStatus = getAttendanceStatusLabel(log.oldValue?.status);
            const toStatus = log.newValue?.status ? getAttendanceStatusLabel(log.newValue.status) : 'ยังไม่เช็ค';
            return `${fromStatus} → ${toStatus}`;
        }

        if (log.action === 'ATTENDANCE_START') return 'เปิดรับเช็คชื่อแล้ว';
        if (log.action === 'ATTENDANCE_CLOSE') return 'สรุปผลและปิดรอบแล้ว';
        if (log.action === 'ATTENDANCE_CANCEL') return 'ยกเลิกรอบและไม่เก็บผล';
        if (log.action === 'ATTENDANCE_CREATE') return 'สร้างรอบไว้เตรียมใช้งาน';

        return 'อัปเดตข้อมูลรอบ';
    };
    const uncheckedCount = attendanceSession.status === 'ACTIVE'
        ? notCheckedIn.filter((member) => !approvedLeavePreviewByMemberId[member.id]).length
        : 0;
    const ModeIcon = getModeIcon(attendanceSession.mode);
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
                                <span data-testid="attendance-counting-policy" className={`flex items-center gap-1.5 rounded-token-md border px-2.5 py-1 text-xs font-black ${isSupplementalSession ? 'border-status-success/40 bg-status-success-subtle text-fg-success' : 'border-status-danger/40 bg-status-danger-subtle text-fg-danger'}`}>
                                    {getAttendanceCountingPolicyLabel(attendanceSession.countingPolicy)}
                                </span>
                                {!isManualSession ? (
                                    <span data-testid="attendance-verification-mode" className="flex items-center gap-1.5 rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-xs font-black text-fg-secondary">
                                        <KeyRound className="h-3.5 w-3.5" />
                                        {getAttendanceVerificationModeLabel(attendanceSession.verificationMode)}
                                    </span>
                                ) : null}
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
                            {canManageAttendance && attendanceSession.verificationMode === 'CODE' && attendanceSession.verificationCode ? (
                                <div className="mt-3 inline-flex min-w-[220px] items-center gap-3 rounded-token-xl border border-status-warning/30 bg-status-warning-subtle px-3.5 py-3 text-fg-warning shadow-token-sm">
                                    <span className="flex h-10 w-10 items-center justify-center rounded-token-lg border border-status-warning/25 bg-bg-base">
                                        <KeyRound className="h-4 w-4" />
                                    </span>
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">รหัสเช็คชื่อ</p>
                                        <p data-testid="attendance-verification-code" className="mt-1 font-mono text-lg font-black tracking-[0.28em] sm:text-xl">
                                            {attendanceSession.verificationCode}
                                        </p>
                                    </div>
                                </div>
                            ) : null}
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
                            countingPolicy={attendanceSession.countingPolicy}
                            uncheckedCount={uncheckedCount}
                        />
                    )}
                </div>
                </div>

                {isManualSession && attendanceSession.status === 'ACTIVE' ? (
                    <div className="mt-4 rounded-token-lg border border-status-warning/20 bg-status-warning-subtle/45 px-4 py-3 text-sm leading-6 text-fg-secondary">
                        ตารางด้านล่างคือจุดเดียวที่ใช้สรุปผลรอบนี้ เจ้าหน้าที่เลือก มา/ขาด/ลา ให้ครบ แล้วค่อยกดยืนยันจบรอบครั้งเดียว
                    </div>
                ) : null}
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
                        countingPolicy={attendanceSession.countingPolicy}
                        absentPenalty={attendanceSession.absentPenalty}
                    />

                    {showHistoryPanel ? (
                        <section className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm" data-testid="attendance-history-panel">
                            <div className="border-b border-border-subtle bg-bg-muted px-4 py-3.5 sm:px-5">
                                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-tertiary">ประวัติรอบนี้</p>
                                <h2 className="mt-1 text-sm font-black tracking-wide text-fg-primary">ประวัติการแก้ไข</h2>
                                <p className="mt-1 text-xs text-fg-tertiary">
                                    {isManualSession ? 'แสดงเฉพาะรายการที่ปิดรอบแล้วและการแก้ย้อนหลัง' : 'ไทม์ไลน์ของการเปิดรอบ สรุปผล และการแก้รายคน'}
                                </p>
                            </div>

                            {isSessionClosed ? (
                                <div className="grid gap-x-6 gap-y-4 border-b border-border-subtle px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
                                    <SessionDetailRow label="สถานะรอบ" value={statusBadge.label} tone="danger" />
                                    <SessionDetailRow label="โหมดเช็คชื่อ" value={getAttendanceSessionModeLabel(attendanceSession.mode)} />
                                    <SessionDetailRow label="ช่วงเวลา" value={`${formatBangkokDate(attendanceSession.startTime)} ${formatBangkokTime(attendanceSession.startTime)} - ${formatBangkokTime(attendanceSession.endTime)}`} meta={`${durationMinutes} นาที`} />
                                    <SessionDetailRow label="การนับผล" value={getAttendanceCountingPolicyLabel(attendanceSession.countingPolicy)} />
                                    <SessionDetailRow label="การยืนยัน" value={isManualSession ? 'เจ้าหน้าที่เช็คเอง' : getAttendanceVerificationModeLabel(attendanceSession.verificationMode)} />
                                    <SessionDetailRow
                                        label="ปิดรอบโดย"
                                        value={closeLog?.actorName || 'ระบบ'}
                                        meta={closeLog
                                            ? new Date(closeLog.createdAt).toLocaleString('th-TH', {
                                                timeZone: 'Asia/Bangkok',
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })
                                            : '-'}
                                    />
                                </div>
                            ) : null}

                            {visibleAttendanceHistory.length === 0 ? (
                                <div className="px-6 py-8 text-sm text-fg-tertiary">ยังไม่มีประวัติสำหรับรอบนี้</div>
                            ) : (
                                <div className="divide-y divide-border-subtle">
                                    {visibleAttendanceHistory.map((log) => (
                                        <div
                                            key={log.id}
                                            data-testid={`attendance-history-entry-${log.action.toLowerCase()}`}
                                            className="grid gap-2 px-4 py-3.5 transition-colors hover:bg-bg-muted/70 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_170px] sm:items-center sm:px-5"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-fg-primary">{getHistoryLabel(log)}</p>
                                                <p className="mt-1 truncate text-xs text-fg-tertiary">{log.actorName}</p>
                                            </div>
                                            <p className="text-xs leading-6 text-fg-secondary sm:text-sm">{getHistoryChangeText(log)}</p>
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
                            )}
                        </section>
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
function SessionDetailRow({
    label,
    value,
    tone = 'default',
    meta,
}: {
    label: string;
    value: string;
    tone?: 'default' | 'danger';
    meta?: string;
}) {
    return (
        <div className="space-y-1.5">
            <p className="text-[11px] font-bold text-fg-tertiary">{label}</p>
            <p className={tone === 'danger' ? 'text-sm font-black text-fg-danger' : 'text-sm font-black text-fg-primary'}>
                {value}
            </p>
            {meta ? <p className="text-[11px] leading-5 text-fg-tertiary">{meta}</p> : null}
        </div>
    );
}
