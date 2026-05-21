export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { and, eq, desc, inArray, sql } from 'drizzle-orm';
import { CalendarCheck, History, Plus } from 'lucide-react';
import { db, attendanceSessions, members } from '@gang/database';
import { getGangPermissionFlags, isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { OpsPageHeader, OpsSubNav } from '@/components/ui';
import { AttendanceClient } from './AttendanceClient';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function AttendancePage(props: Props) {
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
        return (
            <div className="flex h-[52vh] flex-col items-center justify-center px-6 text-center animate-fade-in">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-token-xl border border-status-danger bg-status-danger-subtle">
                    <CalendarCheck className="h-6 w-6 text-fg-danger" />
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

    const [sessions, activeMemberRows, closedSessionRows] = await Promise.all([
        db.query.attendanceSessions.findMany({
            where: and(
                eq(attendanceSessions.gangId, gangId),
                inArray(attendanceSessions.status, ['ACTIVE', 'SCHEDULED'])
            ),
            orderBy: [desc(attendanceSessions.sessionDate), desc(attendanceSessions.createdAt)],
            with: {
                records: true,
            },
            limit: 10,
        }),
        db.select({ count: sql<number>`count(*)` })
            .from(members)
            .where(and(eq(members.gangId, gangId), eq(members.isActive, true), eq(members.status, 'APPROVED'))),
        db.select({ count: sql<number>`count(*)` })
            .from(attendanceSessions)
            .where(and(eq(attendanceSessions.gangId, gangId), eq(attendanceSessions.status, 'CLOSED'))),
    ]);
    const activeMemberCount = activeMemberRows[0]?.count || 0;
    const historyCount = closedSessionRows[0]?.count || 0;

    return (
        <div className="space-y-5">
            <OpsPageHeader
                eyebrow="Attendance Ops"
                title="เช็คชื่อ"
                description="จัดการรอบเช็คชื่อ ดูสถานะปัจจุบัน และตรวจสอบประวัติย้อนหลังจากจุดเดียว"
                icon={CalendarCheck}
                tone="success"
                actions={canManageAttendance ? (
                    <Link
                        href={`/dashboard/${gangId}/attendance/create`}
                        data-testid="attendance-create-link"
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-token-xl border border-status-success bg-status-success px-5 py-3 text-sm font-black text-fg-inverse shadow-token-sm transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-105"
                    >
                        <Plus className="h-4 w-4" />
                        สร้างรอบเช็คชื่อใหม่
                    </Link>
                ) : null}
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
                        active: true,
                        tone: 'success',
                    },
                    {
                        id: 'history',
                        label: 'ประวัติ',
                        description: 'รอบที่ปิดแล้วและผลย้อนหลัง',
                        icon: History,
                        href: `/dashboard/${gangId}/attendance/history`,
                        badge: historyCount,
                        tone: 'info',
                    },
                ]}
            />

            <div id="attendance-list" className="scroll-mt-6">
                <AttendanceClient
                    sessions={sessions}
                    gangId={gangId}
                    canManageAttendance={canManageAttendance}
                    activeMemberCount={activeMemberCount}
                    historyCount={historyCount}
                />
            </div>
        </div>
    );
}
