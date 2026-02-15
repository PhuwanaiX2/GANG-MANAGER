export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, attendanceSessions, attendanceRecords, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import {
    ArrowLeft,
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    XCircle,
    FileText,
    Users,
    DollarSign
} from 'lucide-react';
import { SessionActions } from './SessionActions';
import { AttendanceSessionDetail } from './AttendanceSessionDetail';

interface Props {
    params: { gangId: string; sessionId: string };
}

export default async function AttendanceSessionPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId, sessionId } = params;

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
        absent: attendanceSession.records.filter(r => r.status === 'ABSENT').length,
        leave: attendanceSession.records.filter(r => r.status === 'LEAVE').length,
    };

    const statusColors = {
        PRESENT: 'bg-green-500/10 text-green-400 border-green-500/20',
        ABSENT: 'bg-red-500/10 text-red-400 border-red-500/20',
        LEAVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    const statusLabels = {
        PRESENT: 'มา',
        ABSENT: 'ขาด',
        LEAVE: 'ลา',
    };

    return (
        <>
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <Link
                            href={`/dashboard/${gangId}/attendance`}
                            className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-2xl font-bold text-white">{attendanceSession.sessionName}</h1>
                        <span className={`text-xs px-2 py-1 rounded-full border ${attendanceSession.status === 'ACTIVE'
                            ? 'bg-green-500/10 text-green-400 border-green-500/20'
                            : attendanceSession.status === 'SCHEDULED'
                                ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                                : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}>
                            {attendanceSession.status === 'ACTIVE' ? 'เปิดอยู่' :
                                attendanceSession.status === 'SCHEDULED' ? 'รอเริ่ม' : 'ปิดแล้ว'}
                        </span>
                    </div>
                    <p className="text-gray-400 flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', {
                                timeZone: 'Asia/Bangkok',
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                            })}
                        </span>
                        <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            {new Date(attendanceSession.startTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })} - {new Date(attendanceSession.endTime).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false })}
                        </span>
                    </p>
                </div>
                <SessionActions
                    gangId={gangId}
                    sessionId={sessionId}
                    currentStatus={attendanceSession.status}
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-[#151515] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-gray-400 mb-2">
                        <Users className="w-4 h-4" />
                        <span className="text-xs">ทั้งหมด</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stats.total}</p>
                </div>
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-xs">มา</span>
                    </div>
                    <p className="text-2xl font-bold text-green-400">{stats.present}</p>
                </div>
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <XCircle className="w-4 h-4" />
                        <span className="text-xs">ขาด</span>
                    </div>
                    <p className="text-2xl font-bold text-red-400">{stats.absent}</p>
                </div>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <FileText className="w-4 h-4" />
                        <span className="text-xs">ลา</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-400">{stats.leave}</p>
                </div>
            </div>

            {/* Records Table */}
            <AttendanceSessionDetail
                records={attendanceSession.records}
                notCheckedIn={notCheckedIn}
                isSessionActive={attendanceSession.status === 'ACTIVE'}
            />
        </>
    );
}
