import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, attendanceSessions } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { Clock } from 'lucide-react';
import { AttendanceClient } from './AttendanceClient';
import { getGangPermissions } from '@/lib/permissions';

interface Props {
    params: { gangId: string };
}

export default async function AttendancePage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Check Permissions (ADMIN or OWNER)
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-gray-400 max-w-md">
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
        <>
            <div className="mb-8">
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">เช็คชื่อ</h1>
                <p className="text-gray-400 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    จัดการรอบเช็คชื่อและการเข้างาน
                </p>
            </div>

            <AttendanceClient sessions={sessions} gangId={gangId} />
        </>
    );
}
