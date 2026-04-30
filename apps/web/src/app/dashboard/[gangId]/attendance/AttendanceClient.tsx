'use client';

import { useState, useMemo, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import Link from 'next/link';
import { getAttendanceBucketCounts } from '@gang/database/attendance';
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
    Archive,
    BarChart3,
    AlertTriangle
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

interface SessionInsight {
    id: string;
    sessionName: string;
    sessionDate: Date;
    attendanceRate: number;
    absenceRate: number;
    present: number;
    absent: number;
    leave: number;
    total: number;
}

interface AttendanceAnalytics {
    activeCount: number;
    historyCount: number;
    cancelledCount: number;
    averageAttendanceRate: number;
    overallAbsenceRate: number;
    worstSession: SessionInsight | null;
    sessionInsights: SessionInsight[];
}

interface Props {
    sessions: Session[];
    gangId: string;
    analytics: AttendanceAnalytics;
    canManageAttendance: boolean;
}

const ITEMS_PER_PAGE = 6;

type TabType = 'active' | 'closed';

export function AttendanceClient({ sessions, gangId, analytics, canManageAttendance }: Props) {
    useAutoRefresh(15);
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
            {canManageAttendance && (
                <div className="grid grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="flex items-center gap-2 mb-2 text-fg-tertiary text-[11px] font-bold uppercase tracking-widest">
                            <PlayCircle className="w-4 h-4 text-fg-success" />
                            เปิดอยู่
                        </div>
                        <div className="text-2xl font-black text-fg-primary tabular-nums">{analytics.activeCount}</div>
                    </div>
                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="flex items-center gap-2 mb-2 text-fg-tertiary text-[11px] font-bold uppercase tracking-widest">
                            <Archive className="w-4 h-4 text-fg-secondary" />
                            ประวัติ
                        </div>
                        <div className="text-2xl font-black text-fg-primary tabular-nums">{analytics.historyCount}</div>
                        <div className="text-[10px] text-fg-tertiary mt-1">ยกเลิก {analytics.cancelledCount} รอบ</div>
                    </div>
                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="flex items-center gap-2 mb-2 text-fg-tertiary text-[11px] font-bold uppercase tracking-widest">
                            <BarChart3 className="w-4 h-4 text-fg-info" />
                            เฉลี่ยเข้าร่วม
                        </div>
                        <div className="text-2xl font-black text-fg-info tabular-nums">{analytics.averageAttendanceRate}%</div>
                    </div>
                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="flex items-center gap-2 mb-2 text-fg-tertiary text-[11px] font-bold uppercase tracking-widest">
                            <XCircle className="w-4 h-4 text-fg-danger" />
                            อัตราขาด
                        </div>
                        <div className="text-2xl font-black text-fg-danger tabular-nums">{analytics.overallAbsenceRate}%</div>
                    </div>
                </div>
            )}

            {canManageAttendance && (analytics.sessionInsights.length > 0 || analytics.worstSession) && (
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
                    <div className="xl:col-span-2 bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-fg-info" />
                            <h3 className="text-sm font-bold text-fg-primary tracking-wide">แนวโน้ม 5 รอบล่าสุด</h3>
                        </div>
                        <div className="grid gap-3 p-4 md:hidden">
                            {analytics.sessionInsights.map((insight) => (
                                <div key={insight.id} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-fg-primary">{insight.sessionName}</p>
                                            <p className="mt-1 text-xs text-fg-tertiary">
                                                {new Date(insight.sessionDate).toLocaleDateString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <span className="shrink-0 rounded-token-md border border-status-success/20 bg-status-success-subtle px-2.5 py-1 text-xs font-black text-fg-success">
                                            {insight.attendanceRate}%
                                        </span>
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                                        <div className="rounded-token-lg bg-status-success-subtle px-2 py-2 text-xs font-bold text-fg-success">{insight.present} มา</div>
                                        <div className="rounded-token-lg bg-status-danger-subtle px-2 py-2 text-xs font-bold text-fg-danger">{insight.absent} ขาด</div>
                                        <div className="rounded-token-lg bg-status-info-subtle px-2 py-2 text-xs font-bold text-fg-info">{insight.leave} ลา</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-[680px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอบเช็คชื่อ</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-center">เข้า</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-center">ขาด</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">สรุป</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {analytics.sessionInsights.map((insight) => (
                                        <tr key={insight.id} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-5 py-3">
                                                <div className="text-sm font-semibold text-fg-primary truncate">{insight.sessionName}</div>
                                                <div className="text-xs text-fg-tertiary">
                                                    {new Date(insight.sessionDate).toLocaleDateString('th-TH', {
                                                        timeZone: 'Asia/Bangkok',
                                                        year: 'numeric',
                                                        month: 'short',
                                                        day: 'numeric',
                                                    })}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex rounded-token-md border border-status-success/20 bg-status-success-subtle px-2.5 py-1 text-xs font-semibold text-fg-success">
                                                    {insight.attendanceRate}%
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <span className="inline-flex rounded-token-md border border-status-danger/20 bg-status-danger-subtle px-2.5 py-1 text-xs font-semibold text-fg-danger">
                                                    {insight.absenceRate}%
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className="inline-flex rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-xs font-semibold text-fg-secondary">
                                                    {insight.present} มา • {insight.absent} ขาด • {insight.leave} ลา
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-border-subtle flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-fg-warning" />
                            <h3 className="text-sm font-bold text-fg-primary tracking-wide">รอบที่ต้องจับตา</h3>
                        </div>
                        <div className="p-5">
                            {analytics.worstSession ? (
                                <div className="space-y-3">
                                    <div>
                                        <div className="text-base font-bold text-fg-primary">{analytics.worstSession.sessionName}</div>
                                        <div className="text-xs text-fg-tertiary">
                                            {new Date(analytics.worstSession.sessionDate).toLocaleDateString('th-TH', {
                                                timeZone: 'Asia/Bangkok',
                                                year: 'numeric',
                                                month: 'short',
                                                day: 'numeric',
                                            })}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="rounded-token-xl border border-status-danger/20 bg-status-danger-subtle p-3">
                                            <div className="text-[10px] text-fg-danger font-bold uppercase tracking-widest">ขาด</div>
                                            <div className="text-2xl font-black text-fg-danger tabular-nums">{analytics.worstSession.absenceRate}%</div>
                                        </div>
                                        <div className="rounded-token-xl border border-status-info/20 bg-status-info-subtle p-3">
                                            <div className="text-[10px] text-fg-info font-bold uppercase tracking-widest">เข้าร่วม</div>
                                            <div className="text-2xl font-black text-fg-info tabular-nums">{analytics.worstSession.attendanceRate}%</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-fg-secondary leading-relaxed">
                                        มา {analytics.worstSession.present} คน
                                        <br />
                                        ขาด {analytics.worstSession.absent} คน
                                        <br />
                                        ลา {analytics.worstSession.leave} คน
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-fg-tertiary">ยังไม่มีข้อมูลรอบที่ปิดแล้ว</div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Command bar */}
            <div className="mb-6 rounded-token-2xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Attendance queue</p>
                        <p className="mt-0.5 text-xs text-fg-tertiary">
                            เลือกรอบที่กำลังเปิดอยู่ หรือย้อนดูประวัติรอบที่ปิดแล้ว
                        </p>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                        <div className="flex gap-2 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-muted p-1 shadow-inner">
                    <button
                        onClick={() => handleTabChange('active')}
                                className={`flex min-w-fit items-center gap-2 rounded-token-lg px-4 py-2 text-sm font-semibold tracking-wide transition-all ${activeTab === 'active'
                            ? 'bg-status-success-subtle text-fg-success shadow-token-sm ring-1 ring-status-success/20'
                            : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
                            }`}
                    >
                        <PlayCircle className="w-4 h-4" />
                        เปิดอยู่
                        {activeSessions.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-token-md text-[10px] tabular-nums font-bold tracking-tight ${activeTab === 'active' ? 'bg-status-success-subtle text-fg-success' : 'bg-bg-muted text-fg-tertiary'
                                }`}>
                                {activeSessions.length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => handleTabChange('closed')}
                                className={`flex min-w-fit items-center gap-2 rounded-token-lg px-4 py-2 text-sm font-semibold tracking-wide transition-all ${activeTab === 'closed'
                            ? 'bg-bg-muted text-fg-primary shadow-token-sm ring-1 ring-border-subtle'
                            : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
                            }`}
                    >
                        <Archive className="w-4 h-4" />
                        ประวัติ
                        {closedSessions.length > 0 && (
                            <span className={`px-2 py-0.5 rounded-token-md text-[10px] tabular-nums font-bold tracking-tight ${activeTab === 'closed' ? 'bg-bg-subtle text-fg-secondary' : 'bg-bg-muted text-fg-tertiary'
                                }`}>
                                {closedSessions.length}
                            </span>
                        )}
                    </button>
                        </div>

                        {canManageAttendance && (
                            <Link
                                href={`/dashboard/${gangId}/attendance/create`}
                                data-testid="attendance-create-link"
                                className="inline-flex w-full items-center justify-center gap-2 rounded-token-xl bg-status-success px-5 py-2.5 font-semibold text-fg-inverse shadow-token-sm transition-all hover:-translate-y-0.5 hover:brightness-110 sm:w-auto"
                            >
                                <Plus className="w-4 h-4" />
                                <span>สร้างรอบเช็คชื่อ</span>
                            </Link>
                        )}
                    </div>
                </div>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
                {currentSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-bg-muted border border-border-subtle rounded-token-2xl shadow-token-sm">
                        <div className="w-16 h-16 bg-bg-subtle rounded-token-full flex items-center justify-center mb-5 ring-1 ring-border-subtle">
                            <CalendarClock className="w-8 h-8 text-fg-tertiary" />
                        </div>
                        <h3 className="text-base font-semibold text-fg-primary mb-2 tracking-wide font-heading">
                            {activeTab === 'active' ? 'ไม่มีรอบที่เปิดอยู่' : 'ยังไม่มีประวัติเช็คชื่อ'}
                        </h3>
                        <p className="text-sm text-fg-tertiary font-medium">
                            {activeTab === 'active'
                                ? (canManageAttendance ? 'กดปุ่มสร้างรอบใหม่เพื่อเริ่มต้น' : 'เมื่อมีรอบเปิดอยู่ คุณสามารถกดเข้าไปดูรายละเอียดและส่งคำขอลาได้จากที่นี่')
                                : 'รอบเช็คชื่อที่ปิดแล้วหรือยกเลิกแล้วจะแสดงที่นี่'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid gap-3 md:hidden">
                            {paginatedSessions.map((session) => {
                                const { present, absent, leave } = getAttendanceBucketCounts(session.records);
                                const total = present + absent + leave;
                                const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

                                return (
                                    <Link
                                        key={session.id}
                                        href={`/dashboard/${gangId}/attendance/${session.id}`}
                                        data-testid={`attendance-session-card-${session.id}`}
                                        className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm transition-colors hover:bg-bg-muted"
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-black text-fg-primary">{session.sessionName}</p>
                                                <p className="mt-1 text-xs font-medium text-fg-tertiary">
                                                    {new Date(session.sessionDate).toLocaleDateString('th-TH', {
                                                        timeZone: 'Asia/Bangkok',
                                                        weekday: 'short',
                                                        day: 'numeric',
                                                        month: 'short',
                                                        year: 'numeric',
                                                    })}
                                                </p>
                                            </div>
                                            <span className={`shrink-0 rounded-token-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${session.status === 'ACTIVE'
                                                ? 'bg-status-success-subtle text-fg-success border-status-success/20'
                                                : session.status === 'SCHEDULED'
                                                    ? 'bg-status-info-subtle text-fg-info border-status-info/20'
                                                    : session.status === 'CANCELLED'
                                                        ? 'bg-status-danger-subtle text-fg-danger border-status-danger/20'
                                                        : 'bg-bg-muted text-fg-tertiary border-border-subtle'
                                                }`}>
                                                {session.status === 'ACTIVE' ? 'กำลังเช็ค' :
                                                    session.status === 'SCHEDULED' ? 'รอเปิด' :
                                                        session.status === 'CANCELLED' ? 'ยกเลิก' : 'เสร็จสิ้น'}
                                            </span>
                                        </div>
                                        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                                            <div className="rounded-token-lg bg-status-success-subtle px-2 py-2">
                                                <p className="text-[10px] font-bold text-fg-success">มา</p>
                                                <p className="text-sm font-black tabular-nums text-fg-success">{present}</p>
                                            </div>
                                            <div className="rounded-token-lg bg-status-danger-subtle px-2 py-2">
                                                <p className="text-[10px] font-bold text-fg-danger">ขาด</p>
                                                <p className="text-sm font-black tabular-nums text-fg-danger">{absent}</p>
                                            </div>
                                            <div className="rounded-token-lg bg-status-info-subtle px-2 py-2">
                                                <p className="text-[10px] font-bold text-fg-info">ลา</p>
                                                <p className="text-sm font-black tabular-nums text-fg-info">{leave}</p>
                                            </div>
                                            <div className="rounded-token-lg bg-bg-muted px-2 py-2">
                                                <p className="text-[10px] font-bold text-fg-tertiary">อัตรา</p>
                                                <p className="text-sm font-black tabular-nums text-fg-primary">{attendanceRate === null ? '-' : `${attendanceRate}%`}</p>
                                            </div>
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                        {activeTab === 'closed' ? (
                            <div className="hidden overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm md:block">
                                <div className="overflow-x-auto">
                                    <table className="min-w-[820px] w-full text-left">
                                        <thead className="bg-bg-muted border-b border-border-subtle">
                                            <tr>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอบเช็คชื่อ</th>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">วันที่</th>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สถานะ</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-tertiary">มา</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ขาด</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ลา</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-fg-tertiary">อัตราเข้า</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายละเอียด</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {paginatedSessions.map((session) => {
                                                const { present, absent, leave } = getAttendanceBucketCounts(session.records);
                                                const total = present + absent + leave;
                                                const attendanceRate = total > 0 ? Math.round((present / total) * 100) : null;

                                                return (
                                                    <tr
                                                        key={session.id}
                                                        className="group transition-colors hover:bg-bg-muted"
                                                    >
                                                        <td className="px-4 py-3 align-middle">
                                                            <Link
                                                                href={`/dashboard/${gangId}/attendance/${session.id}`}
                                                                data-testid={`attendance-session-card-${session.id}`}
                                                                className="flex items-center gap-3 text-sm font-bold text-fg-primary transition-colors group-hover:text-accent-bright"
                                                            >
                                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border ${session.status === 'CANCELLED'
                                                                    ? 'bg-status-danger-subtle text-fg-danger border-status-danger/20'
                                                                    : 'bg-bg-elevated text-fg-secondary border-border-subtle'
                                                                    }`}>
                                                                    <Calendar className="w-4 h-4" />
                                                                </span>
                                                                <span className="min-w-0 truncate">{session.sessionName}</span>
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-xs font-medium text-fg-secondary whitespace-nowrap">
                                                            {new Date(session.sessionDate).toLocaleDateString('th-TH', {
                                                                timeZone: 'Asia/Bangkok',
                                                                weekday: 'short',
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric',
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-3 align-middle">
                                                            <span className={`inline-flex items-center rounded-token-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${session.status === 'CANCELLED'
                                                                ? 'bg-status-danger-subtle text-fg-danger border-status-danger/20'
                                                                : 'bg-bg-muted text-fg-tertiary border-border-subtle'
                                                                }`}>
                                                                {session.status === 'CANCELLED' ? 'ยกเลิก' : 'เสร็จสิ้น'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-center">
                                                            <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-fg-success tabular-nums">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                {present}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-center">
                                                            <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-fg-danger tabular-nums">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                {absent}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-center">
                                                            <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-fg-info tabular-nums">
                                                                <FileText className="w-3.5 h-3.5" />
                                                                {leave}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-right text-sm font-black text-fg-primary tabular-nums">
                                                            {attendanceRate === null ? '-' : `${attendanceRate}%`}
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-right">
                                                            <Link
                                                                href={`/dashboard/${gangId}/attendance/${session.id}`}
                                                                className="inline-flex items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-1.5 text-xs font-bold text-fg-secondary transition-colors hover:border-border-accent hover:text-accent-bright"
                                                            >
                                                                เปิดดู
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <div className="hidden overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm md:block">
                                <div className="overflow-x-auto">
                                    <table className="min-w-[980px] w-full text-left">
                                        <thead className="bg-bg-muted border-b border-border-subtle">
                                            <tr>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอบเช็คชื่อ</th>
                                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สถานะ</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-tertiary">มา</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ขาด</th>
                                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ลา</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-fg-tertiary">วันที่</th>
                                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายละเอียด</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border-subtle">
                                            {paginatedSessions.map((session) => {
                                                const { present, absent, leave } = getAttendanceBucketCounts(session.records);

                                                return (
                                                    <tr key={session.id} className="group transition-colors hover:bg-bg-muted">
                                                        <td className="px-4 py-3 align-middle">
                                                            <Link
                                                                href={`/dashboard/${gangId}/attendance/${session.id}`}
                                                                data-testid={`attendance-session-card-${session.id}`}
                                                                className="flex items-center gap-3 text-sm font-bold text-fg-primary transition-colors group-hover:text-accent-bright"
                                                            >
                                                                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-token-lg border ${session.status === 'ACTIVE'
                                                                    ? 'bg-status-success-subtle text-fg-success border-status-success/20'
                                                                    : session.status === 'SCHEDULED'
                                                                        ? 'bg-status-info-subtle text-fg-info border-status-info/20'
                                                                        : session.status === 'CANCELLED'
                                                                            ? 'bg-status-danger-subtle text-fg-danger border-status-danger/20'
                                                                            : 'bg-bg-muted text-fg-secondary border-border-subtle'
                                                                    }`}>
                                                                    <Calendar className="w-4 h-4" />
                                                                </span>
                                                                <span className="min-w-0 truncate">{session.sessionName}</span>
                                                            </Link>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle">
                                                            <span className={`inline-flex items-center rounded-token-md border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${session.status === 'ACTIVE'
                                                                ? 'bg-status-success-subtle text-fg-success border-status-success/20 animate-pulse'
                                                                : session.status === 'SCHEDULED'
                                                                    ? 'bg-status-info-subtle text-fg-info border-status-info/20'
                                                                    : session.status === 'CANCELLED'
                                                                        ? 'bg-status-danger-subtle text-fg-danger border-status-danger/20'
                                                                        : 'bg-bg-muted text-fg-tertiary border-border-subtle'
                                                                }`}>
                                                                {session.status === 'ACTIVE' ? 'กำลังเช็ค' :
                                                                    session.status === 'SCHEDULED' ? 'รอเปิด' :
                                                                        session.status === 'CANCELLED' ? 'ยกเลิก' : 'เสร็จสิ้น'}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-center">
                                                            <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-fg-success tabular-nums">
                                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                                {present}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-center">
                                                            <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-fg-danger tabular-nums">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                                {absent}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-center">
                                                            <span className="inline-flex items-center justify-center gap-1.5 text-sm font-bold text-fg-info tabular-nums">
                                                                <FileText className="w-3.5 h-3.5" />
                                                                {leave}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-right text-xs font-medium text-fg-secondary whitespace-nowrap">
                                                            {new Date(session.sessionDate).toLocaleDateString('th-TH', {
                                                                timeZone: 'Asia/Bangkok',
                                                                weekday: 'short',
                                                                day: 'numeric',
                                                                month: 'short',
                                                                year: 'numeric',
                                                            })}
                                                        </td>
                                                        <td className="px-4 py-3 align-middle text-right">
                                                            <Link
                                                                href={`/dashboard/${gangId}/attendance/${session.id}`}
                                                                className="inline-flex items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-1.5 text-xs font-bold text-fg-secondary transition-colors hover:border-border-accent hover:text-accent-bright"
                                                            >
                                                                เปิดดู
                                                            </Link>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 mt-8">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-token-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-1 bg-bg-subtle p-1 rounded-token-xl border border-border-subtle shadow-token-sm">
                                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`w-8 h-8 rounded-token-lg text-sm font-semibold transition-all ${page === currentPage
                                                ? 'bg-bg-muted text-fg-primary shadow-token-sm ring-1 ring-border-subtle'
                                                : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
                                                }`}
                                        >
                                            {page}
                                        </button>
                                    ))}
                                </div>

                                <button
                                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                    disabled={currentPage === totalPages}
                                    className="p-2 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-token-sm"
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
