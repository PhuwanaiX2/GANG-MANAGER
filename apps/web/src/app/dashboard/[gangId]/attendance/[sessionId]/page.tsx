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
        PRESENT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        ABSENT: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
        LEAVE: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    };

    const statusLabels = {
        PRESENT: 'มา',
        ABSENT: 'ขาด',
        LEAVE: 'ลา',
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
                            <span className={`text-[10px] px-2.5 py-1 rounded-md font-bold tracking-widest uppercase border ${attendanceSession.status === 'ACTIVE'
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
                />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-sm hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                            <Users className="w-4 h-4 text-zinc-400" />
                        </div>
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">ทั้งหมด</span>
                    </div>
                    <p className="text-3xl font-black text-white tabular-nums tracking-tight">{stats.total}</p>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-emerald-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">มา</span>
                        </div>
                        <p className="text-3xl font-black text-emerald-400 tabular-nums tracking-tight">{stats.present}</p>
                    </div>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-rose-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                <XCircle className="w-4 h-4 text-rose-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">ขาด</span>
                        </div>
                        <p className="text-3xl font-black text-rose-400 tabular-nums tracking-tight">{stats.absent}</p>
                    </div>
                </div>
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full blur-3xl opacity-20 bg-blue-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <FileText className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">ลา</span>
                        </div>
                        <p className="text-3xl font-black text-blue-400 tabular-nums tracking-tight">{stats.leave}</p>
                    </div>
                </div>
            </div>

            {/* Records Table */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-sm overflow-hidden mt-6">
                <AttendanceSessionDetail
                    records={attendanceSession.records}
                    notCheckedIn={notCheckedIn}
                    isSessionActive={attendanceSession.status === 'ACTIVE'}
                />
            </div>
        </div>
    );
}
