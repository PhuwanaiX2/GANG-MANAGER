export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { and, eq, desc, sql } from 'drizzle-orm';
import { CalendarCheck, History } from 'lucide-react';
import { db, attendanceSessions, members } from '@gang/database';
import { getGangPermissionFlags, isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { OpsPageHeader, OpsSubNav } from '@/components/ui';
import { AttendanceClient } from '../AttendanceClient';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function AttendanceHistoryPage(props: Props) {
    const params = await props.params;
    const { gangId } = params;

    const attendanceEnabled = await isFeatureEnabled('attendance');
    if (!attendanceEnabled) {
        return <FeatureDisabledBanner featureName="ระบบเช็คชื่อ" />;
    }

    const access = await requireGangAccess({ gangId }).catch((error) => {
        if (isGangAccessError(error)) {
            redirect(error.status === 401 ? '/' : '/dashboard');
        }
        throw error;
    });
    const permissions = getGangPermissionFlags(access.member.gangRole);
    const canManageAttendance = permissions.isOwner || permissions.isAdmin || permissions.isAttendanceOfficer;
    const currentMember = access.member;

    if (!canManageAttendance && currentMember?.gangId !== gangId) {
        redirect(`/dashboard/${gangId}/attendance`);
    }

    const [sessions, activeMemberRows] = await Promise.all([
        db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: [desc(attendanceSessions.sessionDate), desc(attendanceSessions.createdAt)],
            with: {
                records: true,
            },
        }),
        db.select({ count: sql<number>`count(*)` })
            .from(members)
            .where(and(eq(members.gangId, gangId), eq(members.isActive, true), eq(members.status, 'APPROVED'))),
    ]);
    const activeMemberCount = activeMemberRows[0]?.count || 0;

    return (
        <div className="space-y-5">
            <OpsPageHeader
                eyebrow="Attendance History"
                title="ประวัติการเช็คชื่อ"
                description="ค้นหารอบเก่า ดูผลสรุป และเปิดเข้าไปตรวจประวัติการแก้ไขเฉพาะเคสที่จำเป็น"
                icon={History}
                tone="info"
            />

            <OpsSubNav
                ariaLabel="Attendance sections"
                items={[
                    {
                        id: 'active-rounds',
                        label: 'รอบเช็คชื่อ',
                        description: 'รอบที่เปิดอยู่และงานที่ต้องทำตอนนี้',
                        icon: CalendarCheck,
                        href: `/dashboard/${gangId}/attendance`,
                        tone: 'success',
                    },
                    {
                        id: 'history',
                        label: 'ประวัติ',
                        description: 'รอบที่ปิดแล้วและผลย้อนหลัง',
                        icon: History,
                        href: `/dashboard/${gangId}/attendance/history`,
                        active: true,
                        badge: sessions.filter((item) => item.status === 'CLOSED').length,
                        tone: 'info',
                    },
                ]}
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
