export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, attendanceSessions } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { Clock } from 'lucide-react';
import { AttendanceClient } from './AttendanceClient';
import { getGangPermissions } from '@/lib/permissions';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';

interface Props {
    params: { gangId: string };
}

export default async function AttendancePage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Global feature flag check
    const attendanceEnabled = await isFeatureEnabled('attendance');
    if (!attendanceEnabled) {
        return <FeatureDisabledBanner featureName="ระบบเช็คชื่อ" />;
    }

    // Check Permissions (ADMIN or OWNER)
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4 ring-1 ring-red-500/20">
                    <Clock className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 tracking-wide font-heading">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-zinc-400 max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner) หรือ รองหัวหน้า (Admin) เท่านั้น
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

    return (
        <div className="space-y-6">
            <div className="border-b border-white/5 pb-6">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
                        <Clock className="w-6 h-6 text-amber-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white font-heading">เช็คชื่อ</h1>
                        <p className="text-sm text-zinc-500 font-medium">จัดการรอบเวลาและตรวจสอบการเข้างานของสมาชิก</p>
                    </div>
                </div>
            </div>

            <AttendanceClient sessions={sessions} gangId={gangId} />
        </div>
    );
}
