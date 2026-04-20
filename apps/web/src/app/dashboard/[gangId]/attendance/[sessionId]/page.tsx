export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, attendanceSessions, members, auditLogs } from '@gang/database';
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
import { getGangPermissions } from '@/lib/permissions';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';

interface Props {
    params: { gangId: string; sessionId: string };
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

export default async function AttendanceSessionPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId, sessionId } = params;

    const attendanceEnabled = await isFeatureEnabled('attendance');
    if (!attendanceEnabled) {
        return <FeatureDisabledBanner featureName="ระบบเช็คชื่อ" />;
    }

    const permissions = await getGangPermissions(gangId, session.user.discordId);
    const canManageAttendance = permissions.isOwner || permissions.isAdmin || permissions.isAttendanceOfficer;
    if (!canManageAttendance) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 ring-1 ring-red-500/20">
                    <Clock className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 tracking-wide font-heading">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-zinc-400 max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner), รองหัวหน้า (Admin) หรือ เจ้าหน้าที่เช็คชื่อ เท่านั้น
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

    // Get all active members
    const allMembers = await db.query.members.findMany({
        where: and(
            eq(members.gangId, gangId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    });

    // Calculate stats
    const checkedInMemberIds = new Set(attendanceSession.records.map(r => r.memberId));
    const notCheckedIn = allMembers.filter(m => !checkedInMemberIds.has(m.id));

    const stats = {
        total: allMembers.length,
        present: attendanceSession.records.filter(r => r.status === 'PRESENT').length,
        late: attendanceSession.records.filter(r => r.status === 'LATE').length,
        absent: attendanceSession.records.filter(r => r.status === 'ABSENT').length,
        leave: attendanceSession.records.filter(r => r.status === 'LEAVE').length,
    };

    const recentAuditLogs = await db.query.auditLogs.findMany({
        where: eq(auditLogs.gangId, gangId),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 100,
    });

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

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-white/5">
                <div className="flex items-start gap-4">
                    <Link
                        href={`/dashboard/${gangId}/attendance`}
                        className="p-2.5 bg-[#111] border border-white/5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white transition-all shadow-sm group mt-1"
                    >
                        <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
                    </Link>
                    <div>
                        <div className="flex items-center gap-3 mb-3">
                            <h1 className="text-2xl font-bold text-white tracking-wide font-heading">{attendanceSession.sessionName}</h1>
                            <span data-testid="attendance-session-status" className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-widest uppercase border ${attendanceSession.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] animate-pulse'
                                : attendanceSession.status === 'SCHEDULED'
                                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                    : attendanceSession.status === 'CANCELLED'
                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                        : 'bg-white/5 text-zinc-400 border-white/10'
                                }`}>
                                {attendanceSession.status === 'ACTIVE' ? 'เปิดอยู่' :
                                    attendanceSession.status === 'SCHEDULED' ? 'รอเริ่ม' :
                                        attendanceSession.status === 'CANCELLED' ? 'ยกเลิก' : 'ปิดแล้ว'}
                            </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500 font-medium tracking-wide">
                            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                                <Calendar className="w-4 h-4 text-zinc-400" />
                                {new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', {
                                    timeZone: 'Asia/Bangkok', weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                })}
                            </span>
                            <span className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-md border border-white/5 tabular-nums">
                                <Clock className="w-4 h-4 text-zinc-400" />
                                {new Date(attendanceSession.startTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(attendanceSession.endTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })}
                            </span>
                        </div>
                    </div>
                </div>
                <SessionActions
                    gangId={gangId}
                    sessionId={sessionId}
                    currentStatus={attendanceSession.status}
                    canManageAttendance={canManageAttendance}
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-sm hover:border-white/10 transition-colors" data-testid="attendance-stat-total-card">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                            <Users className="w-4 h-4 text-zinc-400" />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">ทั้งหมด</span>
                    </div>
                    <p data-testid="attendance-stat-total-value" className="text-3xl font-black text-white tabular-nums tracking-tight">{stats.total}</p>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors" data-testid="attendance-stat-present-card">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-emerald-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">มา</span>
                        </div>
                        <p data-testid="attendance-stat-present-value" className="text-3xl font-black text-emerald-400 tabular-nums tracking-tight">{stats.present}</p>
                    </div>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors" data-testid="attendance-stat-late-card">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-amber-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Clock className="w-4 h-4 text-amber-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">สาย</span>
                        </div>
                        <p data-testid="attendance-stat-late-value" className="text-3xl font-black text-amber-400 tabular-nums tracking-tight">{stats.late}</p>
                    </div>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors" data-testid="attendance-stat-absent-card">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-rose-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                <XCircle className="w-4 h-4 text-rose-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">ขาด</span>
                        </div>
                        <p data-testid="attendance-stat-absent-value" className="text-3xl font-black text-rose-400 tabular-nums tracking-tight">{stats.absent}</p>
                    </div>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors" data-testid="attendance-stat-leave-card">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-blue-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <FileText className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">ลา</span>
                        </div>
                        <p data-testid="attendance-stat-leave-value" className="text-3xl font-black text-blue-400 tabular-nums tracking-tight">{stats.leave}</p>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-sm overflow-hidden mt-6">
                <AttendanceSessionDetail
                    gangId={gangId}
                    sessionId={sessionId}
                    records={attendanceSession.records}
                    notCheckedIn={notCheckedIn}
                    isSessionActive={attendanceSession.status === 'ACTIVE'}
                    isSessionClosed={attendanceSession.status === 'CLOSED'}
                    allowLate={attendanceSession.allowLate}
                    canManageAttendance={canManageAttendance}
                />
            </div>

            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-sm overflow-hidden" data-testid="attendance-history-panel">
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                            <History className="w-4 h-4 text-zinc-300" />
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white tracking-wide">ประวัติ Attendance</h2>
                            <p className="text-xs text-zinc-500">ดู lifecycle และ manual edits ของรอบนี้ย้อนหลัง</p>
                        </div>
                    </div>
                </div>

                <div className="divide-y divide-white/5">
                    {attendanceHistory.length === 0 ? (
                        <div className="px-6 py-8 text-sm text-zinc-500">ยังไม่มีประวัติสำหรับรอบนี้</div>
                    ) : attendanceHistory.map((log) => (
                        <div key={log.id} data-testid={`attendance-history-entry-${log.action.toLowerCase()}`} className="px-6 py-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-white">{getHistoryLabel(log)}</span>
                                    <span className="text-[10px] px-2 py-1 rounded-md border border-white/10 bg-white/5 text-zinc-400 tracking-widest uppercase">
                                        {log.actorName}
                                    </span>
                                </div>

                                {log.action === 'ATTENDANCE_UPDATE' ? (
                                    <p className="text-xs text-zinc-400">
                                        {log.oldValue?.status || 'NONE'} → {log.newValue?.status || 'RESET'}
                                        {typeof log.details?.penaltyDelta === 'number' && log.details.penaltyDelta !== 0
                                            ? ` • penalty Δ ${log.details.penaltyDelta > 0 ? '+' : ''}${log.details.penaltyDelta}`
                                            : ''}
                                    </p>
                                ) : (
                                    <p className="text-xs text-zinc-400">
                                        {log.oldValue?.status || '-'} → {log.newValue?.status || '-'}
                                    </p>
                                )}
                            </div>

                            <div className="text-xs text-zinc-500 md:text-right">
                                {new Date(log.createdAt).toLocaleString('th-TH', {
                                    timeZone: 'Asia/Bangkok',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
