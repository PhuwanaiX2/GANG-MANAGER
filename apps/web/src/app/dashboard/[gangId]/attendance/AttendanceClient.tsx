'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import Link from 'next/link';
import {
    Plus,
    Calendar,
    CheckCircle2,
    XCircle,
    FileText,
    CalendarClock,
    ChevronLeft,
    ChevronRight,
    PlayCircle,
    Archive
} from 'lucide-react';

interface AttendanceRecord {
    id: string;
    status: string;
}

interface Session {
    id: string;
    sessionName: string;
    sessionDate: Date;
    startTime: Date;
    endTime: Date;
    status: string;
    records: AttendanceRecord[];
}

interface Props {
    sessions: Session[];
    gangId: string;
}

const ITEMS_PER_PAGE = 6;

type TabType = 'active' | 'closed';

export function AttendanceClient({ sessions, gangId }: Props) {
    useAutoRefresh(30);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const initialTab = useMemo<TabType>(() => {
        const tab = searchParams.get('tab');
        if (tab === 'closed') return 'closed';
        return 'active';
    }, [searchParams]);

    const [activeTab, setActiveTab] = useState<TabType>(initialTab);
    const [currentPage, setCurrentPage] = useState(1);

    // Filter sessions by tab
    const activeSessions = sessions.filter(s => s.status === 'ACTIVE' || s.status === 'SCHEDULED');
    const closedSessions = sessions.filter(s => s.status === 'CLOSED' || s.status === 'CANCELLED')
        .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());

    const currentSessions = activeTab === 'active' ? activeSessions : closedSessions;

    // Pagination
    const totalPages = Math.ceil(currentSessions.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedSessions = currentSessions.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Reset page when changing tabs + update URL
    const handleTabChange = useCallback((tab: TabType) => {
        setActiveTab(tab);
        setCurrentPage(1);
        const params = new URLSearchParams();
        params.set('tab', tab);
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    }, [router, pathname]);

    return (
        <div className="animate-fade-in-up">
            {/* Create Button & Tabs Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex gap-2 bg-[#111] p-1 rounded-xl border border-white/5 shadow-sm">
                    <button
                        onClick={() => handleTabChange('active')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all tracking-wide ${activeTab === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 shadow-sm ring-1 ring-emerald-500/20'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                    >
                        <PlayCircle className="w-4 h-4" />
                        เปิดอยู่
                        {activeSessions.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] tabular-nums font-bold tracking-tight ${activeTab === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-zinc-400'
                                }`}>
                                {activeSessions.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('closed')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all tracking-wide ${activeTab === 'closed'
                            ? 'bg-zinc-800 text-zinc-200 shadow-sm ring-1 ring-white/10'
                            : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                            }`}
                    >
                        <Archive className="w-4 h-4" />
                        ประวัติ
                        {closedSessions.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] tabular-nums font-bold tracking-tight ${activeTab === 'closed' ? 'bg-white/10 text-zinc-300' : 'bg-white/5 text-zinc-400'
                                }`}>
                                {closedSessions.length}
                            </span>
                        )}
                    </button>
                </div>

                <Link
                    href={`/dashboard/${gangId}/attendance/create`}
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] transform hover:-translate-y-0.5"
                >
                    <Plus className="w-4 h-4" />
                    <span>สร้างรอบใหม่</span>
                </Link>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
                {currentSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-sm">
                        <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-5 ring-1 ring-white/10">
                            <CalendarClock className="w-8 h-8 text-zinc-500" />
                        </div>
                        <h3 className="text-base font-semibold text-zinc-200 mb-2 tracking-wide font-heading">
                            {activeTab === 'active' ? 'ไม่มีรอบที่เปิดอยู่' : 'ยังไม่มีประวัติเช็คชื่อ'}
                        </h3>
                        <p className="text-sm text-zinc-500 font-medium">
                            {activeTab === 'active' ? 'กดปุ่มสร้างรอบใหม่เพื่อเริ่มต้น' : 'รอบเช็คชื่อที่เสร็จแล้วจะแสดงที่นี่'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4">
                            {paginatedSessions.map((session) => {
                                const present = session.records.filter(r => r.status === 'PRESENT').length;
                                const absent = session.records.filter(r => r.status === 'ABSENT').length;
                                const leave = session.records.filter(r => r.status === 'LEAVE').length;

                                return (
                                    <Link
                                        key={session.id}
                                        href={`/dashboard/${gangId}/attendance/${session.id}`}
                                        className="block bg-[#111] border border-white/5 p-5 rounded-2xl hover:bg-[#151515] transition-all hover:shadow-sm group hover:border-white/10"
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                            <div className="flex items-start gap-4">
                                                <div className={`p-3 rounded-xl border ${session.status === 'ACTIVE'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : session.status === 'SCHEDULED'
                                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                        : session.status === 'CANCELLED'
                                                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                            : 'bg-white/5 text-zinc-400 border-white/5'
                                                    }`}>
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-zinc-200 group-hover:text-white transition-colors tracking-wide text-base">
                                                        {session.sessionName}
                                                    </h3>
                                                    <p className="text-zinc-500 text-[13px] mt-1 font-medium flex items-center gap-2 tracking-wide">
                                                        {new Date(session.sessionDate).toLocaleDateString('th-TH', {
                                                            timeZone: 'Asia/Bangkok',
                                                            weekday: 'short',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                        })}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold tracking-widest uppercase border ${session.status === 'CLOSED'
                                                    ? 'bg-white/5 text-zinc-400 border-white/10'
                                                    : session.status === 'ACTIVE'
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse'
                                                        : session.status === 'CANCELLED'
                                                            ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                                    }`}>
                                                    {session.status === 'CLOSED' ? 'เสร็จสิ้น' :
                                                        session.status === 'ACTIVE' ? 'กำลังเช็ค' :
                                                            session.status === 'CANCELLED' ? 'ยกเลิก' : 'รอเปิด'}
                                                </span>
                                            </div>
                                        </div>

                                        {session.status === 'CLOSED' && (
                                            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/5">
                                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-sm font-bold text-emerald-400 tabular-nums">{present}</span>
                                                        <span className="text-[10px] text-zinc-500 font-medium">มา</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                                    <XCircle className="w-4 h-4 text-rose-400" />
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-sm font-bold text-rose-400 tabular-nums">{absent}</span>
                                                        <span className="text-[10px] text-zinc-500 font-medium">ขาด</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                                    <FileText className="w-4 h-4 text-blue-400" />
                                                    <div className="flex items-baseline gap-1.5">
                                                        <span className="text-sm font-bold text-blue-400 tabular-nums">{leave}</span>
                                                        <span className="text-[10px] text-zinc-500 font-medium">ลา</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-1 bg-[#111] p-1 rounded-xl border border-white/5 shadow-sm">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${page === currentPage
                                                ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
                                                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
