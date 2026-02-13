'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
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
    const closedSessions = sessions.filter(s => s.status === 'CLOSED')
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
        <>
            {/* Create Button */}
            <div className="mb-6">
                <Link
                    href={`/dashboard/${gangId}/attendance/create`}
                    className="inline-flex items-center gap-2 bg-discord-primary hover:bg-[#4752C4] text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-lg shadow-discord-primary/20 transform hover:-translate-y-0.5"
                >
                    <Plus className="w-5 h-5" />
                    <span>สร้างรอบใหม่</span>
                </Link>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => handleTabChange('active')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${activeTab === 'active'
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                        }`}
                >
                    <PlayCircle className="w-4 h-4" />
                    เปิดอยู่
                    {activeSessions.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'active' ? 'bg-green-500/30' : 'bg-white/10'
                            }`}>
                            {activeSessions.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => handleTabChange('closed')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all ${activeTab === 'closed'
                        ? 'bg-gray-500/20 text-gray-300 border border-gray-500/30'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5'
                        }`}
                >
                    <Archive className="w-4 h-4" />
                    ประวัติ
                    {closedSessions.length > 0 && (
                        <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === 'closed' ? 'bg-gray-500/30' : 'bg-white/10'
                            }`}>
                            {closedSessions.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
                {currentSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-[#151515] border border-dashed border-white/10 rounded-3xl">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
                            <CalendarClock className="w-10 h-10 text-gray-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">
                            {activeTab === 'active' ? 'ไม่มีรอบที่เปิดอยู่' : 'ยังไม่มีประวัติเช็คชื่อ'}
                        </h3>
                        <p className="text-gray-400">
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
                                        className="block bg-[#151515] border border-white/5 p-5 rounded-2xl hover:border-discord-primary/50 transition-all hover:shadow-xl group"
                                    >
                                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2.5 rounded-xl ${session.status === 'ACTIVE'
                                                    ? 'bg-green-500/10 text-green-500'
                                                    : session.status === 'SCHEDULED'
                                                        ? 'bg-blue-500/10 text-blue-500'
                                                        : 'bg-white/5 text-gray-400'
                                                    }`}>
                                                    <Calendar className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-white group-hover:text-discord-primary transition-colors">
                                                        {session.sessionName}
                                                    </h3>
                                                    <p className="text-gray-400 text-sm mt-0.5">
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
                                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${session.status === 'CLOSED'
                                                ? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                : session.status === 'ACTIVE'
                                                    ? 'bg-green-500/10 text-green-500 border-green-500/20 animate-pulse'
                                                    : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                                }`}>
                                                {session.status === 'CLOSED' ? 'เสร็จสิ้น' :
                                                    session.status === 'ACTIVE' ? 'กำลังเช็ค' : 'รอเปิด'}
                                            </span>
                                        </div>

                                        {session.status === 'CLOSED' && (
                                            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/5">
                                                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-green-500/5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                                                    <span className="text-sm font-medium text-white">{present}</span>
                                                    <span className="text-xs text-green-400">มา</span>
                                                </div>
                                                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-red-500/5">
                                                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                                                    <span className="text-sm font-medium text-white">{absent}</span>
                                                    <span className="text-xs text-red-400">ขาด</span>
                                                </div>
                                                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-blue-500/5">
                                                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                                                    <span className="text-sm font-medium text-white">{leave}</span>
                                                    <span className="text-xs text-blue-400">ลา</span>
                                                </div>
                                            </div>
                                        )}
                                    </Link>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === currentPage
                                            ? 'bg-discord-primary text-white'
                                            : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30'
                                            }`}
                                    >
                                        {page}
                                    </button>
                                ))}

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
