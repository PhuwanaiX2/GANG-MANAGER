export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db, attendanceSessions, getAttendanceBucketCounts } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { Clock, History, Plus } from 'lucide-react';

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
            <div className="flex h-[52vh] flex-col items-center justify-center px-6 text-center animate-fade-in">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-token-xl border border-status-danger bg-status-danger-subtle">
                    <Clock className="h-6 w-6 text-fg-danger" />
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-danger-subtle border border-status-danger mb-3">
                    <span className="h-1.5 w-1.5 rounded-token-full bg-status-danger" />
                    <span className="text-fg-danger text-[10px] font-black tracking-widest uppercase">ไม่มีสิทธิ์</span>
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
        <div className="space-y-4">
            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm animate-fade-in sm:p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 rounded-token-full border border-status-warning/25 bg-status-warning-subtle px-3 py-1">
                            <span className="w-1.5 h-1.5 rounded-token-full bg-status-warning" />
                            <span className="text-fg-warning text-[10px] font-black tracking-widest uppercase">Attendance Ops</span>
                        </div>
                        <div className="mt-3 flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-token-lg border border-status-warning/25 bg-status-warning-subtle">
                                <Clock className="w-5 h-5 text-fg-warning" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">เช็คชื่อ</h1>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-fg-secondary">
                                    {canManageAttendance
                                        ? 'เปิดรอบใหม่จากปุ่มเดียว แล้วใช้ตารางด้านล่างดูรอบที่เปิดอยู่ ประวัติ และตัวเลขสำคัญแบบไม่ต้องไล่กวาดทั้งหน้า'
                                        : 'ดูรอบเช็คชื่อที่เปิดอยู่ แล้วเข้าไปเช็คชื่อหรือแจ้งลา/เข้าช้าจากรอบนั้นได้ทันที'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:justify-end">
                        {canManageAttendance ? (
                            <Link
                                href={`/dashboard/${gangId}/attendance/create`}
                                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg bg-status-warning px-4 py-2 text-sm font-black text-fg-inverse shadow-token-sm transition-[filter,background-color] hover:brightness-105"
                            >
                                <Plus className="h-4 w-4" />
                                สร้างรอบเช็คชื่อใหม่
                            </Link>
                        ) : null}
                        <Link
                            href={`/dashboard/${gangId}/attendance?tab=closed#attendance-list`}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-4 py-2 text-sm font-bold text-fg-primary shadow-token-sm transition-colors hover:bg-bg-elevated"
                        >
                            <History className="h-4 w-4" />
                            ประวัติ
                        </Link>
                    </div>
                </div>
            </div>

            <div id="attendance-list" className="scroll-mt-6">
                <AttendanceClient sessions={sessions} gangId={gangId} analytics={analytics} canManageAttendance={canManageAttendance} />
            </div>
        </div>
    );
}
