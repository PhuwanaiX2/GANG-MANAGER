'use client';

import { useState, useMemo, useCallback, useEffect, useTransition } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import Link from 'next/link';
import { getAttendanceBucketCounts } from '@gang/database/attendance';
import {
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
    mode?: string | null;
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
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setActiveTab(initialTab);
        setCurrentPage(1);
    }, [initialTab]);

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
        startTransition(() => {
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        });
    }, [router, pathname, startTransition]);

    return (
        <div className="animate-fade-in-up">
            <div className="mb-5 rounded-token-2xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Attendance queue</p>
                                {isPending ? (
                                    <span className="inline-flex items-center gap-1 rounded-token-full border border-status-warning/25 bg-status-warning-subtle px-2 py-0.5 text-[10px] font-bold text-fg-warning">
                                        <span className="h-1.5 w-1.5 rounded-token-full bg-status-warning animate-pulse" />
                                        กำลังสลับ
                                    </span>
                                ) : null}
                            </div>
                            <p className="mt-1 text-sm font-black text-fg-primary">
                                {activeTab === 'active' ? 'รอบที่เปิดอยู่' : 'ประวัติเช็คชื่อ'}
                            </p>
                        </div>
                        <div className="flex gap-2 overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-muted p-1 shadow-inner">
                            <button
                                onClick={() => handleTabChange('active')}
                                className={`flex min-h-11 min-w-fit items-center gap-2 rounded-token-lg px-4 py-2 text-sm font-bold tracking-wide transition-all ${activeTab === 'active'
                                    ? 'bg-status-success-subtle text-fg-success shadow-token-sm ring-1 ring-status-success/20'
                                    : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-elevated'
                                    }`}
                            >
                                <PlayCircle className="w-4 h-4" />
                                เปิดอยู่
                                <span className={`rounded-token-md px-2 py-0.5 text-[10px] font-black tabular-nums tracking-tight ${activeTab === 'active' ? 'bg-bg-subtle text-fg-success' : 'bg-bg-elevated text-fg-tertiary'}`}>
                                    {activeSessions.length}
                                </span>
                            </button>
                            <button
                                onClick={() => handleTabChange('closed')}
                                className={`flex min-h-11 min-w-fit items-center gap-2 rounded-token-lg px-4 py-2 text-sm font-bold tracking-wide transition-all ${activeTab === 'closed'
                                    ? 'bg-bg-subtle text-fg-primary shadow-token-sm ring-1 ring-border-subtle'
                                    : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-elevated'
                                    }`}
                            >
                                <Archive className="w-4 h-4" />
                                ประวัติ
                                <span className={`rounded-token-md px-2 py-0.5 text-[10px] font-black tabular-nums tracking-tight ${activeTab === 'closed' ? 'bg-bg-muted text-fg-primary' : 'bg-bg-elevated text-fg-tertiary'}`}>
                                    {closedSessions.length}
                                </span>
                            </button>
                        </div>
                    </div>

                    {canManageAttendance && (
                        <div className="flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-5 sm:overflow-visible sm:pb-0">
                            <div className="min-w-[122px] rounded-token-xl border border-status-success/15 bg-status-success-subtle/70 px-3 py-2 sm:min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-fg-success">เปิดอยู่</div>
                                <div className="mt-1 text-base font-black text-fg-primary tabular-nums">{analytics.activeCount}</div>
                            </div>
                            <div className="min-w-[122px] rounded-token-xl border border-border-subtle bg-bg-muted px-3 py-2 sm:min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประวัติ</div>
                                <div className="mt-1 text-base font-black text-fg-primary tabular-nums">{analytics.historyCount}</div>
                            </div>
                            <div className="min-w-[122px] rounded-token-xl border border-status-danger/15 bg-status-danger-subtle/60 px-3 py-2 sm:min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-fg-danger">ยกเลิก</div>
                                <div className="mt-1 text-base font-black text-fg-primary tabular-nums">{analytics.cancelledCount}</div>
                            </div>
                            <div className="min-w-[122px] rounded-token-xl border border-status-info/15 bg-status-info-subtle/60 px-3 py-2 sm:min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-fg-info">เฉลี่ยเข้าร่วม</div>
                                <div className="mt-1 text-base font-black text-fg-primary tabular-nums">{analytics.averageAttendanceRate}%</div>
                            </div>
                            <div className="min-w-[122px] rounded-token-xl border border-status-warning/15 bg-status-warning-subtle/60 px-3 py-2 sm:min-w-0">
                                <div className="text-[10px] font-black uppercase tracking-widest text-fg-warning">อัตราขาด</div>
                                <div className="mt-1 text-base font-black text-fg-primary tabular-nums">{analytics.overallAbsenceRate}%</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sessions List */}
            <div className="space-y-4">
                {currentSessions.length === 0 ? (
                    <div className="flex items-center gap-4 rounded-token-2xl border border-border-subtle bg-bg-muted p-5 text-left shadow-token-sm md:flex-col md:justify-center md:py-16 md:text-center">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-token-full bg-bg-subtle ring-1 ring-border-subtle md:h-16 md:w-16">
                            <CalendarClock className="h-6 w-6 text-fg-tertiary md:h-8 md:w-8" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base font-semibold text-fg-primary tracking-wide font-heading">
                                {activeTab === 'active' ? 'ไม่มีรอบที่เปิดอยู่' : 'ยังไม่มีประวัติเช็คชื่อ'}
                            </h3>
                            <p className="mt-1 text-xs font-medium leading-5 text-fg-tertiary sm:text-sm">
                                {activeTab === 'active'
                                    ? (canManageAttendance ? 'กดปุ่มสร้างรอบใหม่เพื่อเริ่มต้น' : 'เมื่อมีรอบเปิดอยู่ คุณสามารถกดเข้าไปดูรายละเอียดและส่งคำขอลาได้จากที่นี่')
                                    : 'รอบเช็คชื่อที่ปิดแล้วหรือยกเลิกแล้วจะแสดงที่นี่'}
                            </p>
                        </div>
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

            {canManageAttendance && activeTab === 'closed' && (analytics.sessionInsights.length > 0 || analytics.worstSession) && (
                <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_280px]">
                    {analytics.sessionInsights.length > 0 && (
                        <section className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                            <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
                                <div className="flex min-w-0 items-center gap-2">
                                    <BarChart3 className="h-4 w-4 shrink-0 text-fg-info" />
                                    <div className="min-w-0">
                                        <h3 className="text-sm font-black text-fg-primary">แนวโน้ม 5 รอบล่าสุด</h3>
                                        <p className="text-xs text-fg-tertiary">อยู่ท้ายประวัติ เพื่อไม่แย่งงานหลักด้านบน</p>
                                    </div>
                                </div>
                            </div>
                            <div className="divide-y divide-border-subtle">
                                {analytics.sessionInsights.map((insight) => (
                                    <Link
                                        key={insight.id}
                                        href={`/dashboard/${gangId}/attendance/${insight.id}`}
                                        className="grid gap-2 px-4 py-3 transition-colors hover:bg-bg-muted sm:grid-cols-[1fr_auto] sm:items-center"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-bold text-fg-primary">{insight.sessionName}</p>
                                            <p className="mt-0.5 text-xs text-fg-tertiary">
                                                {new Date(insight.sessionDate).toLocaleDateString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-4 gap-2 text-center sm:min-w-[360px]">
                                            <span className="rounded-token-lg bg-status-success-subtle px-2 py-1.5 text-xs font-black text-fg-success tabular-nums">{insight.attendanceRate}%</span>
                                            <span className="rounded-token-lg bg-status-danger-subtle px-2 py-1.5 text-xs font-black text-fg-danger tabular-nums">{insight.absenceRate}%</span>
                                            <span className="rounded-token-lg bg-bg-muted px-2 py-1.5 text-xs font-bold text-fg-secondary tabular-nums">{insight.present} มา</span>
                                            <span className="rounded-token-lg bg-bg-muted px-2 py-1.5 text-xs font-bold text-fg-secondary tabular-nums">{insight.leave} ลา</span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </section>
                    )}

                    {analytics.worstSession && (
                        <section className="rounded-token-2xl border border-status-warning/20 bg-status-warning-subtle/40 p-4 shadow-token-sm">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-fg-warning" />
                                <h3 className="text-sm font-black text-fg-primary">รอบที่ต้องจับตา</h3>
                            </div>
                            <Link
                                href={`/dashboard/${gangId}/attendance/${analytics.worstSession.id}`}
                                className="mt-3 block rounded-token-xl border border-status-warning/20 bg-bg-subtle p-3 transition-colors hover:bg-bg-muted"
                            >
                                <p className="truncate text-sm font-bold text-fg-primary">{analytics.worstSession.sessionName}</p>
                                <p className="mt-1 text-xs text-fg-tertiary">
                                    {new Date(analytics.worstSession.sessionDate).toLocaleDateString('th-TH', {
                                        timeZone: 'Asia/Bangkok',
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </p>
                                <div className="mt-3 grid grid-cols-2 gap-2">
                                    <div className="rounded-token-lg bg-status-danger-subtle px-2.5 py-2">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-fg-danger">ขาด</div>
                                        <div className="text-lg font-black text-fg-danger tabular-nums">{analytics.worstSession.absenceRate}%</div>
                                    </div>
                                    <div className="rounded-token-lg bg-status-info-subtle px-2.5 py-2">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-fg-info">เข้าร่วม</div>
                                        <div className="text-lg font-black text-fg-info tabular-nums">{analytics.worstSession.attendanceRate}%</div>
                                    </div>
                                </div>
                            </Link>
                        </section>
                    )}
                </div>
            )}
        </div>
    );
}
