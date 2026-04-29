export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, attendanceSessions, getAttendanceBucketCounts } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { Activity, Clock, History, TrendingUp } from 'lucide-react';

import { AttendanceClient } from './AttendanceClient';
import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function AttendancePage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Global feature flag check
    const attendanceEnabled = await isFeatureEnabled('attendance');
    if (!attendanceEnabled) {
        return <FeatureDisabledBanner featureName="ระบบเช็คชื่อ" />;
    }

    const { access, permissions } = await getGangAccessContextForDiscordId({ gangId, discordId: session.user.discordId });
    const canManageAttendance = permissions.isOwner || permissions.isAdmin || permissions.isAttendanceOfficer;
    const currentMember = access?.member ?? null;

    if (!canManageAttendance && currentMember?.gangId !== gangId) {
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

    // Get data in parallel
    const [sessions] = await Promise.all([
        db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: desc(attendanceSessions.sessionDate),
            with: {
                records: true,
            },
        })
    ]);

    const historySessions = sessions.filter((attendanceSession) => attendanceSession.status === 'CLOSED' || attendanceSession.status === 'CANCELLED');
    const closedSessions = sessions.filter((attendanceSession) => attendanceSession.status === 'CLOSED');
    const sessionInsights = closedSessions
        .map((attendanceSession) => {
            const { present, absent, leave, total } = getAttendanceBucketCounts(attendanceSession.records);
            const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0;
            const absenceRate = total > 0 ? Math.round((absent / total) * 100) : 0;

            return {
                id: attendanceSession.id,
                sessionName: attendanceSession.sessionName,
                sessionDate: attendanceSession.sessionDate,
                attendanceRate,
                absenceRate,
                present,
                absent,
                leave,
                total,
            };
        })
        .slice(0, 5);

    const totals = closedSessions.reduce((acc, attendanceSession) => {
        const counts = getAttendanceBucketCounts(attendanceSession.records);
        acc.present += counts.present;
        acc.absent += counts.absent;
        acc.leave += counts.leave;
        acc.total += counts.total;
        return acc;
    }, { present: 0, absent: 0, leave: 0, total: 0 });

    const averageAttendanceRate = sessionInsights.length > 0
        ? Math.round(sessionInsights.reduce((sum, insight) => sum + insight.attendanceRate, 0) / sessionInsights.length)
        : 0;

    const overallAbsenceRate = totals.total > 0
        ? Math.round((totals.absent / totals.total) * 100)
        : 0;

    const worstSession = sessionInsights.reduce<typeof sessionInsights[number] | null>((worst, insight) => {
        if (!worst || insight.absenceRate > worst.absenceRate) {
            return insight;
        }

        return worst;
    }, null);

    const analytics = {
        activeCount: sessions.filter((attendanceSession) => attendanceSession.status === 'ACTIVE' || attendanceSession.status === 'SCHEDULED').length,
        historyCount: historySessions.length,
        cancelledCount: historySessions.filter((attendanceSession) => attendanceSession.status === 'CANCELLED').length,
        averageAttendanceRate,
        overallAbsenceRate,
        worstSession,
        sessionInsights,
    };

    return (
        <div className="space-y-6">
            <div className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-md animate-fade-in">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-token-full bg-status-warning-subtle blur-3xl" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-status-warning to-transparent opacity-50" />
                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-warning-subtle border border-status-warning mb-3 shadow-token-sm">
                            <span className="w-1.5 h-1.5 rounded-token-full bg-status-warning animate-pulse" />
                            <span className="text-fg-warning text-[10px] font-black tracking-widest uppercase">Attendance Ops</span>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2.5 rounded-token-xl bg-status-warning-subtle border border-status-warning shadow-token-sm">
                                <Clock className="w-6 h-6 text-fg-warning" />
                            </div>
                            <div>
                                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary font-heading">เช็คชื่อ</h1>
                                <p className="mt-2 text-sm leading-relaxed text-fg-secondary">
                                    {canManageAttendance
                                        ? 'จัดการรอบเวลา ตรวจสถานะรอบล่าสุด และอ่านแนวโน้มการเข้างานของสมาชิก'
                                        : 'ดูรอบเช็คชื่อที่เปิดอยู่ และเข้าไปแจ้งลา/แจ้งเข้าช้าของรอบนั้นได้จากหน้า session'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 shadow-inner">
                            <Activity className="mb-2 h-4 w-4 text-fg-warning" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Active</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{analytics.activeCount}</p>
                        </div>
                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 shadow-inner">
                            <History className="mb-2 h-4 w-4 text-fg-tertiary" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">History</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{analytics.historyCount}</p>
                        </div>
                        <div className="rounded-token-xl border border-status-success bg-status-success-subtle px-4 py-3 shadow-inner">
                            <TrendingUp className="mb-2 h-4 w-4 text-fg-success" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-success">Avg</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{analytics.averageAttendanceRate}%</p>
                        </div>
                    </div>
                </div>
            </div>

            <AttendanceClient sessions={sessions} gangId={gangId} analytics={analytics} canManageAttendance={canManageAttendance} />
        </div>
    );
}
