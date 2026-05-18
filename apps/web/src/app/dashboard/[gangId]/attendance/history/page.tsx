export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { History } from 'lucide-react';
import { authOptions } from '@/lib/auth';
import { db, attendanceSessions, members } from '@gang/database';
import { getGangAccessContextForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { OpsPageHeader } from '@/components/ui';
import { AttendanceClient } from '../AttendanceClient';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function AttendanceHistoryPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const attendanceEnabled = await isFeatureEnabled('attendance');
    if (!attendanceEnabled) {
        return <FeatureDisabledBanner featureName="ระบบเช็คชื่อ" />;
    }

    const { access, permissions } = await getGangAccessContextForDiscordId({ gangId, discordId: session.user.discordId });
    const canManageAttendance = permissions.isOwner || permissions.isAdmin || permissions.isAttendanceOfficer;
    const currentMember = access?.member ?? null;

    if (!canManageAttendance && currentMember?.gangId !== gangId) {
        redirect(`/dashboard/${gangId}/attendance`);
    }

    const [sessions, activeMembers] = await Promise.all([
        db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: [desc(attendanceSessions.sessionDate), desc(attendanceSessions.createdAt)],
            with: {
                records: true,
            },
        }),
        db.query.members.findMany({
            where: eq(members.gangId, gangId),
            columns: { id: true, isActive: true, status: true },
        }),
    ]);
    const activeMemberCount = activeMembers.filter((member) => member.isActive && member.status === 'APPROVED').length;

    return (
        <div className="space-y-5">
            <OpsPageHeader
                eyebrow="Attendance History"
                title="ประวัติการเช็คชื่อ"
                description="ค้นหารอบเก่า ดูผลสรุป และเปิดเข้าไปตรวจ Log หรือแก้ย้อนหลังเฉพาะเคสที่จำเป็น"
                icon={History}
                tone="info"
            />

            <AttendanceClient
                sessions={sessions}
                gangId={gangId}
                canManageAttendance={canManageAttendance}
                activeMemberCount={activeMemberCount}
                initialView="closed"
                historyOnly
            />
        </div>
    );
}
