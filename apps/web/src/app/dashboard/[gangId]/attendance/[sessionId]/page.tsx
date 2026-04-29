export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, attendanceSessions, members, auditLogs, gangs, canAccessFeature, leaveRequests, getApprovedLeavePreview, getAttendanceBucketCounts, getAttendanceStatusLabel, isApprovedLeaveApplicableToSession, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq, and, desc } from 'drizzle-orm';
import Link from 'next/link';
import {
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle2,
    History,
    XCircle,
    FileText,
    Users
} from 'lucide-react';
import { SessionActions } from './SessionActions';
import { AttendanceSessionDetail } from './AttendanceSessionDetail';
import { MemberSessionAttendanceCard } from './MemberSessionAttendanceCard';
import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { AutoRefresh } from '@/components/AutoRefresh';

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
    const currentMember = access?.member
        ? { id: access.member.id, name: access.member.name }
        : null;

    if (!canManageAttendance && !currentMember) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6 animate-fade-in">
                <div className="w-16 h-16 bg-status-danger-subtle rounded-token-full flex items-center justify-center mb-4 border border-status-danger shadow-token-md">
                    <Clock className="w-8 h-8 text-fg-danger" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-danger-subtle border border-status-danger mb-3">
                    <span className="w-1.5 h-1.5 rounded-token-full bg-status-danger animate-pulse" />
                    <span className="text-fg-danger text-[10px] font-black tracking-widest uppercase">Access Denied</span>
                </div>
                <h1 className="text-2xl font-black text-fg-primary mb-2 tracking-tight font-heading">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-tertiary max-w-md text-sm">
                    ไม่พบสิทธิ์ใช้งานหรือข้อมูลสมาชิกสำหรับระบบเช็คชื่อ
                </p>
            </div>
        );
    }

    // Get session with records
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

    const currentMemberLeaveRequests = currentMember ? await db.query.leaveRequests.findMany({
        where: and(
            eq(leaveRequests.gangId, gangId),
            eq(leaveRequests.memberId, currentMember.id)
        ),
        orderBy: (leave, { desc }) => desc(leave.requestedAt),
    }) : [];

    const approvedLeavePreviewByMemberId: Record<string, { note: string; type: 'FULL' | 'LATE'; statusLabel: string }> = {};
    let currentMemberApprovedLeavePreview: { note: string; type: 'FULL' | 'LATE'; statusLabel: string } | null = null;

    if (attendanceSession.status === 'ACTIVE' || currentMember) {
        const approvedLeaves = await db.query.leaveRequests.findMany({
            where: and(
                eq(leaveRequests.gangId, gangId),
                eq(leaveRequests.status, 'APPROVED')
            ),
        });

        if (canManageAttendance && attendanceSession.status === 'ACTIVE') {
            for (const leave of approvedLeaves) {
                const preview = getApprovedLeavePreview({
                    attendanceSession,
                    leave,
                });
                if (!preview) {
                    continue;
                }

                approvedLeavePreviewByMemberId[leave.memberId] = preview;
            }
        }

        if (currentMember) {
            const relevantApprovedLeave = approvedLeaves.find((leave) => leave.memberId === currentMember.id && isApprovedLeaveApplicableToSession(attendanceSession, leave)) || null;
            currentMemberApprovedLeavePreview = relevantApprovedLeave
                ? getApprovedLeavePreview({ attendanceSession, leave: relevantApprovedLeave })
                : null;
        }
    }

    const checkedInMemberIds = new Set(attendanceSession.records.map(r => r.memberId));
    const notCheckedIn = allMembers.filter(m => !checkedInMemberIds.has(m.id));
    const previewLeaveMembers = notCheckedIn.filter(member => approvedLeavePreviewByMemberId[member.id]);
    const closedRecordCounts = getAttendanceBucketCounts(attendanceSession.records);

    const stats = {
        total: allMembers.length,
        present: closedRecordCounts.present,
        absent: closedRecordCounts.absent,
        leave: closedRecordCounts.leave + previewLeaveMembers.length,
    };

    const recentAuditLogs = canManageAttendance ? await db.query.auditLogs.findMany({
        where: eq(auditLogs.gangId, gangId),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 100,
    }) : [];

    const currentMemberAttendanceRecord = currentMember
        ? attendanceSession.records.find((record) => record.memberId === currentMember.id) || null
        : null;

    const relevantMemberLeaveRequest = currentMemberLeaveRequests.find((leave) => leave.status !== 'REJECTED' && isApprovedLeaveApplicableToSession(attendanceSession, leave)) || null;

    const attendanceHistory = recentAuditLogs
        .map((log) => {
            const details = safeParseJson(log.details);
            const oldValue = safeParseJson(log.oldValue);
            const newValue = safeParseJson(log.newValue);

            return {
                ...log,
                details,
                oldValue,
                newValue,
            };
        })
        .filter((log) => {
            if (log.targetType === 'ATTENDANCE_SESSION' && log.targetId === sessionId) {
                return true;
            }

            return log.details?.sessionId === sessionId;
        })
        .slice(0, 12);

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

    const getHistoryStatusLabel = (status?: string | null) => {
        return getAttendanceStatusLabel(status);
    };

    const statusGuidance = attendanceSession.status === 'SCHEDULED'
        ? {
            wrapperClassName: 'bg-status-warning-subtle border-status-warning',
            titleClassName: 'text-fg-warning',
            title: 'รอบนี้ยังรอเวลาเริ่ม',
            description: 'เมื่อถึงเวลา ระบบจะส่งปุ่มเช็คชื่อไป Discord อัตโนมัติ หรือคุณสามารถกด "เปิดรอบตอนนี้" เพื่อเริ่มก่อนเวลาได้ทันที',
        }
        : attendanceSession.status === 'ACTIVE'
            ? {
                wrapperClassName: 'bg-status-success-subtle border-status-success',
                titleClassName: 'text-fg-success',
                title: 'รอบนี้เปิดให้เช็คชื่ออยู่',
                description: 'สมาชิกสามารถกดเช็คชื่อจาก Discord ได้ทันที และคุณยังปรับสถานะรายคนจากตารางด้านล่างได้จนกว่าจะปิดรอบ',
            }
            : attendanceSession.status === 'CANCELLED'
                ? {
                    wrapperClassName: 'bg-status-danger-subtle border-status-danger',
                    titleClassName: 'text-fg-danger',
                    title: 'รอบนี้ถูกยกเลิกแล้ว',
                    description: 'รอบนี้จะไม่ถูกใช้คิดค่าปรับหรือสรุปผลเพิ่มเติม หากต้องการเช็คชื่อใหม่ให้สร้างรอบใหม่แทน',
                }
                : {
                    wrapperClassName: 'bg-bg-subtle border-border-subtle',
                    titleClassName: 'text-fg-primary',
                    title: 'รอบนี้ปิดแล้ว',
                    description: 'สถานะสุดท้ายของสมาชิกถูกบันทึกเรียบร้อยแล้ว คุณยังตรวจสอบประวัติการแก้ไขและผลสรุปของรอบนี้ได้จากหน้านี้',
                };

    return (
        <div className="space-y-6 animate-fade-in-up">
            {canManageAttendance && <AutoRefresh interval={15} />}

            {/* Header */}
            <div className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-md sm:p-6">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-token-full bg-status-warning-subtle blur-3xl" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-status-warning to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-6">
                    <div className="flex items-start gap-4">
                        <Link
                            href={`/dashboard/${gangId}/attendance`}
                            className="p-2.5 bg-bg-muted border border-border-subtle hover:bg-bg-elevated rounded-token-xl text-fg-secondary hover:text-fg-primary transition-all shadow-token-sm group mt-1"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                        </Link>
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <h1 className="text-3xl font-black text-fg-primary tracking-tight font-heading">{attendanceSession.sessionName}</h1>
                                <span data-testid="attendance-session-status" className={`text-[10px] px-2.5 py-1 rounded-token-md font-bold tracking-widest uppercase border ${attendanceSession.status === 'ACTIVE'
                                    ? 'bg-status-success-subtle text-fg-success border-status-success shadow-token-glow-accent animate-pulse'
                                    : attendanceSession.status === 'SCHEDULED'
                                        ? 'bg-status-warning-subtle text-fg-warning border-status-warning'
                                        : attendanceSession.status === 'CANCELLED'
                                            ? 'bg-status-danger-subtle text-fg-danger border-status-danger'
                                            : 'bg-bg-muted text-fg-tertiary border-border-subtle'
                                    }`}>
                                    {attendanceSession.status === 'ACTIVE' ? 'เปิดอยู่' :
                                        attendanceSession.status === 'SCHEDULED' ? 'รอเริ่ม' :
                                            attendanceSession.status === 'CANCELLED' ? 'ยกเลิก' : 'ปิดแล้ว'}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-fg-tertiary font-medium tracking-wide">
                                <span className="flex items-center gap-1.5 bg-bg-muted px-2.5 py-1 rounded-token-md border border-border-subtle">
                                    <Calendar className="w-4 h-4 text-fg-secondary" />

                                    {new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', {
                                        timeZone: 'Asia/Bangkok', weekday: 'short',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                                <span className="flex items-center gap-1.5 bg-bg-muted px-2.5 py-1 rounded-token-md border border-border-subtle tabular-nums">
                                    <Clock className="w-4 h-4 text-fg-secondary" />

                                    {new Date(attendanceSession.startTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(attendanceSession.endTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })}
                                </span>
                            </div>
                        </div>
                    </div>
                    <SessionActions
                        gangId={gangId}
                        sessionId={sessionId}
                        currentStatus={attendanceSession.status}
                        canManageAttendance={canManageAttendance}
                        willApplyAbsencePenalty={willApplyAbsencePenalty}
                    />
                </div>
            </div>

            <div className={`border rounded-token-2xl p-4 sm:p-5 shadow-token-sm ${statusGuidance.wrapperClassName}`}>
                <p className={`text-sm font-semibold mb-1.5 ${statusGuidance.titleClassName}`}>{statusGuidance.title}</p>
                <p className="text-xs text-fg-secondary font-medium leading-relaxed">
                    {canManageAttendance
                        ? statusGuidance.description
                        : attendanceSession.status === 'ACTIVE'
                            ? 'คุณสามารถเช็คชื่อจาก Discord ได้ตามปกติ หรือส่งคำขอลา/แจ้งเข้าช้าสำหรับรอบนี้จากกล่องด้านล่างได้ทันที'
                            : attendanceSession.status === 'SCHEDULED'
                                ? 'หากรู้ล่วงหน้าว่าจะมาไม่ทัน คุณสามารถส่งคำขอลาหรือแจ้งเข้าช้าสำหรับรอบนี้ได้ก่อนเวลาเริ่ม'
                                : attendanceSession.status === 'CANCELLED'
                                    ? 'รอบนี้ยกเลิกแล้ว จึงไม่ต้องส่งคำขอสำหรับ attendance รอบนี้เพิ่มเติม'
                                    : 'รอบนี้ปิดแล้ว คุณยังดูสถานะสุดท้ายของตัวเองและคำขอที่เกี่ยวข้องได้จากหน้านี้'}
                </p>
            </div>

            {currentMember && (
                <MemberSessionAttendanceCard
                    gangId={gangId}
                    sessionStatus={attendanceSession.status}
                    sessionName={attendanceSession.sessionName}
                    sessionStart={attendanceSession.startTime}
                    sessionEnd={attendanceSession.endTime}
                    memberName={currentMember.name}
                    attendanceRecord={currentMemberAttendanceRecord ? {
                        status: currentMemberAttendanceRecord.status,
                        checkedInAt: currentMemberAttendanceRecord.checkedInAt,
                        penaltyAmount: currentMemberAttendanceRecord.penaltyAmount,
                    } : null}
                    leavePreview={currentMemberApprovedLeavePreview}
                    relevantLeaveRequest={relevantMemberLeaveRequest}
                />
            )}

            {canManageAttendance && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-total-card">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-2 rounded-token-lg bg-bg-muted border border-border-subtle">
                                    <Users className="w-4 h-4 text-fg-tertiary" />
                                </div>
                                <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest">ทั้งหมด</span>
                            </div>
                            <p data-testid="attendance-stat-total-value" className="text-3xl font-black text-fg-primary tabular-nums tracking-tight">{stats.total}</p>
                        </div>
                        <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-present-card">
                            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-token-full blur-3xl opacity-70 bg-status-success-subtle" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 rounded-token-lg bg-status-success-subtle border border-status-success">
                                        <CheckCircle2 className="w-4 h-4 text-fg-success" />
                                    </div>
                                    <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">มา</span>
                                </div>
                                <p data-testid="attendance-stat-present-value" className="text-3xl font-black text-fg-success tabular-nums tracking-tight">{stats.present}</p>
                            </div>
                        </div>
                        <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-absent-card">
                            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-token-full blur-3xl opacity-70 bg-status-danger-subtle" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 rounded-token-lg bg-status-danger-subtle border border-status-danger">
                                        <XCircle className="w-4 h-4 text-fg-danger" />
                                    </div>
                                    <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">ขาด</span>
                                </div>
                                <p data-testid="attendance-stat-absent-value" className="text-3xl font-black text-fg-danger tabular-nums tracking-tight">{stats.absent}</p>
                            </div>
                        </div>
                        <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-leave-card">
                            <div className="absolute -top-10 -right-10 w-24 h-24 rounded-token-full blur-3xl opacity-70 bg-status-info-subtle" />
                            <div className="relative">
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="p-2 rounded-token-lg bg-status-info-subtle border border-status-info">
                                        <FileText className="w-4 h-4 text-fg-info" />
                                    </div>
                                    <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">ลา</span>
                                </div>
                                <p data-testid="attendance-stat-leave-value" className="text-3xl font-black text-fg-info tabular-nums tracking-tight">{stats.leave}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm overflow-hidden mt-6">
                        <AttendanceSessionDetail
                            gangId={gangId}
                            sessionId={sessionId}
                            records={attendanceSession.records}
                            notCheckedIn={notCheckedIn}
                            leavePreviewByMemberId={approvedLeavePreviewByMemberId}
                            isSessionActive={attendanceSession.status === 'ACTIVE'}
                            isSessionClosed={attendanceSession.status === 'CLOSED'}
                            canManageAttendance={canManageAttendance}
                        />
                    </div>

                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm overflow-hidden" data-testid="attendance-history-panel">
                        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between gap-4 bg-bg-muted">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-token-xl bg-bg-subtle border border-border-subtle flex items-center justify-center">
                                    <History className="w-4 h-4 text-fg-secondary" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-fg-primary tracking-wide">ประวัติ Attendance</h2>
                                    <p className="text-xs text-fg-tertiary">ดูเหตุการณ์สำคัญและการแก้ไขรายคนของรอบนี้ย้อนหลัง</p>
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="min-w-[780px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เหตุการณ์</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ผู้ดำเนินการ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สถานะ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ค่าปรับ</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">เวลา</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {attendanceHistory.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-sm text-fg-tertiary">ยังไม่มีประวัติสำหรับรอบนี้</td>
                                        </tr>
                                    ) : attendanceHistory.map((log) => (
                                        <tr key={log.id} data-testid={`attendance-history-entry-${log.action.toLowerCase()}`} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-5 py-3 align-middle">
                                                <span className="text-sm font-semibold text-fg-primary">{getHistoryLabel(log)}</span>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <span className="inline-flex rounded-token-md border border-border-subtle bg-bg-muted px-2 py-1 text-[10px] uppercase tracking-widest text-fg-tertiary">
                                                    {log.actorName}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 align-middle">
                                                <span className="inline-flex rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-[11px] text-fg-secondary">
                                                    {getHistoryStatusLabel(log.oldValue?.status)} → {log.newValue?.status ? getHistoryStatusLabel(log.newValue.status) : 'ยังไม่เข้า'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 align-middle text-right">
                                                {typeof log.details?.penaltyDelta === 'number' && log.details.penaltyDelta !== 0 ? (
                                                    <span className={`inline-flex rounded-token-md border px-2.5 py-1 text-[11px] font-semibold ${log.details.penaltyDelta > 0 ? 'bg-status-danger-subtle border-status-danger text-fg-danger' : 'bg-status-success-subtle border-status-success text-fg-success'}`}>
                                                        {log.details.penaltyDelta > 0 ? '+' : ''}{log.details.penaltyDelta}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-fg-tertiary">-</span>
                                                )}
                                            </td>
                                            <td className="px-5 py-3 align-middle text-right text-[11px] text-fg-tertiary tabular-nums whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
