'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getAttendanceBucketCounts } from '@gang/database/attendance';
import {
    ArrowRight,
    Calendar,
    CalendarCheck,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Download,
    FileText,
    History,
    Monitor,
    Search,
    ShieldCheck,
    Users,
    XCircle,
} from 'lucide-react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

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
    createdAt?: Date | string | null;
    status: string;
    mode?: string | null;
    records: AttendanceRecord[];
}

interface Props {
    sessions: Session[];
    gangId: string;
    canManageAttendance: boolean;
    activeMemberCount: number;
    initialView?: ViewType;
    historyOnly?: boolean;
    historyCount?: number;
}

const HISTORY_PAGE_SIZE = 10;
type ViewType = 'home' | 'closed';
type HistoryModeFilter = 'ALL' | 'DISCORD' | 'MANUAL';
type HistoryStatusFilter = 'ALL' | 'CLOSED';

function formatDate(value: Date | string) {
    return new Date(value).toLocaleDateString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
}

function formatTime(value: Date | string) {
    return new Date(value).toLocaleTimeString('th-TH', {
        timeZone: 'Asia/Bangkok',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

function getStatusLabel(status: string) {
    if (status === 'ACTIVE') return 'เปิดอยู่';
    if (status === 'SCHEDULED') return 'รอเริ่ม';
    if (status === 'CANCELLED') return 'ยกเลิก';
    return 'ปิดแล้ว';
}

function getStatusClass(status: string) {
    if (status === 'ACTIVE') return 'border-status-success/25 bg-status-success-subtle text-fg-success';
    if (status === 'SCHEDULED') return 'border-status-warning/25 bg-status-warning-subtle text-fg-warning';
    if (status === 'CANCELLED') return 'border-status-danger/25 bg-status-danger-subtle text-fg-danger';
    return 'border-border-subtle bg-bg-muted text-fg-tertiary';
}

function getModeLabel(mode?: string | null) {
    return mode === 'MANUAL_ROLL_CALL' ? 'เช็คโดยเจ้าหน้าที่' : 'เช็คผ่าน Discord';
}

function getModeIcon(mode?: string | null) {
    return mode === 'MANUAL_ROLL_CALL' ? Monitor : ShieldCheck;
}

function getSessionCounts(session?: Session | null) {
    if (!session) {
        return { present: 0, absent: 0, leave: 0, total: 0, percent: 0 };
    }

    const counts = getAttendanceBucketCounts(session.records);
    const total = counts.present + counts.absent + counts.leave;
    const percent = total > 0 ? Math.round((counts.present / total) * 100) : 0;

    return { ...counts, total, percent };
}

function compareSessionsNewestFirst(a: Session, b: Session) {
    const dateDelta = new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime();
    if (dateDelta !== 0) return dateDelta;

    return new Date(b.createdAt || b.startTime).getTime() - new Date(a.createdAt || a.startTime).getTime();
}

export function AttendanceClient({ sessions, gangId, canManageAttendance, activeMemberCount, initialView: initialViewOverride, historyOnly = false, historyCount }: Props) {
    const hasLiveSessions = sessions.some((session) => session.status === 'ACTIVE' || session.status === 'SCHEDULED');
    useAutoRefresh(15, !historyOnly && hasLiveSessions);
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const initialView = useMemo<ViewType>(() => initialViewOverride ?? (searchParams.get('tab') === 'closed' ? 'closed' : 'home'), [initialViewOverride, searchParams]);
    const [view, setView] = useState<ViewType>(initialView);
    const [currentPage, setCurrentPage] = useState(1);
    const [historySearchTerm, setHistorySearchTerm] = useState('');
    const [historyModeFilter, setHistoryModeFilter] = useState<HistoryModeFilter>('ALL');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('ALL');
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        setView(initialView);
        setCurrentPage(1);
    }, [initialView]);

    const activeSessions = useMemo(() => sessions
        .filter((session) => session.status === 'ACTIVE' || session.status === 'SCHEDULED')
        .sort((a, b) => {
            if (a.status !== b.status) return a.status === 'ACTIVE' ? -1 : 1;
            return compareSessionsNewestFirst(a, b);
        }), [sessions]);

    const historySessions = useMemo(() => sessions
        .filter((session) => session.status === 'CLOSED')
        .sort(compareSessionsNewestFirst), [sessions]);

    const filteredHistorySessions = useMemo(() => {
        const query = historySearchTerm.trim().toLowerCase();

        return historySessions.filter((session) => {
            const matchesQuery = !query || [
                session.sessionName,
                formatDate(session.sessionDate),
                formatTime(session.startTime),
                formatTime(session.endTime),
            ].some((value) => value.toLowerCase().includes(query));
            const matchesMode = historyModeFilter === 'ALL'
                || (historyModeFilter === 'MANUAL' && session.mode === 'MANUAL_ROLL_CALL')
                || (historyModeFilter === 'DISCORD' && session.mode !== 'MANUAL_ROLL_CALL');
            const matchesStatus = historyStatusFilter === 'ALL' || session.status === historyStatusFilter;

            return matchesQuery && matchesMode && matchesStatus;
        });
    }, [historyModeFilter, historySearchTerm, historySessions, historyStatusFilter]);

    const historyTotals = useMemo(() => historySessions.reduce(
        (acc, session) => {
            const counts = getSessionCounts(session);
            acc.rounds += 1;
            acc.present += counts.present;
            acc.absent += counts.absent;
            acc.leave += counts.leave;
            return acc;
        },
        { rounds: 0, present: 0, absent: 0, leave: 0 }
    ), [historySessions]);

    const primarySession = activeSessions[0] ?? null;
    const primaryCounts = getSessionCounts(primarySession);
    const primaryDisplayTotal = activeMemberCount || primaryCounts.total;
    const primaryPercent = primaryDisplayTotal > 0 ? Math.round((primaryCounts.present / primaryDisplayTotal) * 100) : primaryCounts.percent;
    const totalHistoryPages = Math.ceil(filteredHistorySessions.length / HISTORY_PAGE_SIZE);
    const historyStartIndex = (currentPage - 1) * HISTORY_PAGE_SIZE;
    const paginatedHistory = filteredHistorySessions.slice(historyStartIndex, historyStartIndex + HISTORY_PAGE_SIZE);

    useEffect(() => {
        setCurrentPage(1);
    }, [historyModeFilter, historySearchTerm, historyStatusFilter]);

    const goToView = useCallback((nextView: ViewType) => {
        if (historyOnly && nextView === 'home') {
            startTransition(() => {
                router.push(`/dashboard/${gangId}/attendance`);
            });
            return;
        }
        setView(nextView);
        setCurrentPage(1);
        const params = new URLSearchParams();
        if (nextView === 'closed') params.set('tab', 'closed');
        startTransition(() => {
            router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
        });
    }, [gangId, historyOnly, pathname, router, startTransition]);

    const exportHistoryCsv = useCallback(() => {
        const rows = filteredHistorySessions.map((session) => {
            const counts = getSessionCounts(session);
            return {
                name: session.sessionName,
                mode: getModeLabel(session.mode),
                status: getStatusLabel(session.status),
                date: formatDate(session.sessionDate),
                start: formatTime(session.startTime),
                end: formatTime(session.endTime),
                total: counts.total,
                present: counts.present,
                absent: counts.absent,
                leave: counts.leave,
            };
        });
        const headers = ['รอบ', 'โหมด', 'สถานะ', 'วันที่', 'เริ่ม', 'สิ้นสุด', 'รวม', 'มา', 'ขาด', 'ลา'];
        const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;
        const csv = [
            headers.map(escapeCell).join(','),
            ...rows.map((row) => [
                row.name,
                row.mode,
                row.status,
                row.date,
                row.start,
                row.end,
                row.total,
                row.present,
                row.absent,
                row.leave,
            ].map(escapeCell).join(',')),
        ].join('\r\n');

        const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `attendance-history-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    }, [filteredHistorySessions]);

    if (view === 'closed') {
        return (
            <div className="space-y-4 animate-fade-in-up">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-heading text-2xl font-black tracking-tight text-fg-primary sm:text-3xl">{historyOnly ? 'รายการประวัติ' : 'ประวัติการเช็คชื่อทั้งหมด'}</h2>
                            {isPending ? <span className="rounded-token-full bg-bg-muted px-2 py-1 text-[10px] font-black text-fg-tertiary">กำลังโหลด</span> : null}
                        </div>
                        <p className="mt-1 max-w-2xl text-sm leading-6 text-fg-secondary">ดูประวัติการเช็คชื่อที่จบแล้ว/ยกเลิกแล้ว สามารถเปิดดูรายละเอียดและแก้ไขย้อนหลังได้</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <button
                            type="button"
                            onClick={exportHistoryCsv}
                            disabled={filteredHistorySessions.length === 0}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-subtle px-4 text-sm font-bold text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                        >
                            <Download className="h-4 w-4" />
                            ส่งออกข้อมูล
                        </button>
                        <button
                            type="button"
                            onClick={() => goToView('home')}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-token-lg border border-border-subtle bg-bg-muted px-4 text-sm font-bold text-fg-secondary transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                        >
                            <ChevronLeft className="h-4 w-4" />
                            กลับหน้าเช็คชื่อ
                        </button>
                    </div>
                </div>

                <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <HistorySummaryCard icon={Calendar} label="รอบทั้งหมด" value={historyTotals.rounds} suffix="รอบ" />
                    <HistorySummaryCard icon={CheckCircle2} label="มา" value={historyTotals.present} suffix="ครั้ง" tone="success" />
                    <HistorySummaryCard icon={XCircle} label="ขาด" value={historyTotals.absent} suffix="ครั้ง" tone="danger" />
                    <HistorySummaryCard icon={FileText} label="ลา" value={historyTotals.leave} suffix="ครั้ง" tone="info" />
                </section>

                <section className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-xs">
                    <div className="border-b border-border-subtle bg-bg-muted p-3.5 sm:p-4">
                        <div className="grid gap-2.5 lg:grid-cols-[minmax(220px,1fr)_180px_210px] xl:grid-cols-[minmax(320px,1fr)_190px_230px_auto]">
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-tertiary" />
                                <input
                                    value={historySearchTerm}
                                    onChange={(event) => setHistorySearchTerm(event.target.value)}
                                    placeholder="ค้นหาชื่อรอบ หรือช่วงเวลา"
                                    className="min-h-11 w-full rounded-token-lg border border-border-subtle bg-bg-subtle py-2 pl-9 pr-3 text-sm text-fg-primary outline-none transition-colors placeholder:text-fg-tertiary focus:border-border-strong"
                                />
                            </label>
                            <select
                                value={historyStatusFilter}
                                onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}
                                className="min-h-11 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 text-sm font-semibold text-fg-secondary outline-none transition-colors focus:border-border-strong"
                            >
                                <option value="ALL">สถานะทั้งหมด</option>
                                <option value="CLOSED">ปิดแล้ว</option>
                            </select>
                            <select
                                value={historyModeFilter}
                                onChange={(event) => setHistoryModeFilter(event.target.value as HistoryModeFilter)}
                                className="min-h-11 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 text-sm font-semibold text-fg-secondary outline-none transition-colors focus:border-border-strong"
                            >
                                <option value="ALL">โหมดการเช็คชื่อทั้งหมด</option>
                                <option value="DISCORD">เช็คผ่าน Discord</option>
                                <option value="MANUAL">เช็คโดยเจ้าหน้าที่</option>
                            </select>
                            <div className="inline-flex min-h-11 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle px-3 text-xs font-bold text-fg-tertiary">
                                พบ {filteredHistorySessions.length} รอบ
                            </div>
                        </div>
                    </div>

                    <HistoryTable
                        sessions={paginatedHistory}
                        gangId={gangId}
                        emptyText="ไม่พบประวัติตามเงื่อนไขที่เลือก"
                    />

                    {totalHistoryPages > 1 ? (
                        <div className="flex flex-col gap-3 border-t border-border-subtle bg-bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                            <span className="text-xs font-medium text-fg-tertiary">
                                แสดง {historyStartIndex + 1}-{Math.min(historyStartIndex + HISTORY_PAGE_SIZE, filteredHistorySessions.length)} จากทั้งหมด {filteredHistorySessions.length} รอบ
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-tertiary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </button>
                                <span className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-bold text-fg-secondary">
                                    {currentPage} / {totalHistoryPages}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setCurrentPage((prev) => Math.min(totalHistoryPages, prev + 1))}
                                    disabled={currentPage === totalHistoryPages}
                                    className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-tertiary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary disabled:cursor-not-allowed disabled:opacity-45"
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>
        );
    }

    return (
        <div className="space-y-5 animate-fade-in-up">
            <section className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <DashboardStatCard
                    icon={CalendarCheck}
                    tone="success"
                    label="รอบที่เปิดอยู่"
                    value={activeSessions.length}
                    suffix="รอบ"
                    action={primarySession ? 'ดูรายละเอียด' : 'ยังไม่มีรอบเปิดอยู่'}
                    href={primarySession ? `/dashboard/${gangId}/attendance/${primarySession.id}` : undefined}
                    mutedAction={!primarySession}
                />
                <DashboardStatCard
                    icon={History}
                    tone="info"
                    label="รอบที่ปิดแล้ว"
                    value={historyCount ?? historySessions.length}
                    suffix="รอบ"
                    action="ดูประวัติทั้งหมด"
                    href={`/dashboard/${gangId}/attendance/history`}
                />
                <DashboardStatCard
                    icon={Users}
                    tone="warning"
                    label="สมาชิกทั้งหมด"
                    value={activeMemberCount}
                    suffix="คน"
                    action="ในเิรฟเวอร"
                    mutedAction
                />
                <DashboardStatCard
                    icon={Clock3}
                    tone="danger"
                    label="เช็คชื่อวันนี้"
                    value={primarySession ? primaryPercent : 0}
                    suffix="%"
                    action={primarySession ? `มาแล้ว ${primaryCounts.present} / ${activeMemberCount || primaryCounts.total} คน` : 'ยังไม่มีรอบวันนี้'}
                    href={primarySession ? `/dashboard/${gangId}/attendance/${primarySession.id}` : undefined}
                    mutedAction={!primarySession}
                />
            </section>

            <section>
                <div className="ops-surface overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-xs">
                    <div className="border-b border-border-subtle bg-bg-muted px-4 py-3.5 sm:px-5">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-black tracking-wide text-fg-primary">รอบเช็คชื่อที่เปิดอยู่</h2>
                            {primarySession ? (
                                <span className="inline-flex items-center gap-1.5 rounded-token-full border border-status-success/25 bg-status-success-subtle px-2.5 py-1 text-[11px] font-bold text-fg-success">
                                    <span className="h-1.5 w-1.5 rounded-token-full bg-status-success" />
                                    กำลังดำเนินการ
                                </span>
                            ) : null}
                        </div>
                    </div>

                    {activeSessions.length > 0 ? (
                        <div className="grid gap-3 p-4 sm:p-5">
                            {activeSessions.map((activeSession) => {
                                const counts = getSessionCounts(activeSession);
                                const displayTotal = activeMemberCount || counts.total;
                                const percent = displayTotal > 0 ? Math.round((counts.present / displayTotal) * 100) : counts.percent;
                                const ModeIcon = getModeIcon(activeSession.mode);

                                return (
                                    <article key={activeSession.id} className="ops-card rounded-token-2xl bg-bg-muted p-4">
                                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                            <div className="flex min-w-0 gap-4">
                                                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-token-full border border-status-success/25 bg-status-success text-fg-inverse shadow-token-md">
                                                    <ModeIcon className="h-7 w-7" />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h3 className="font-heading text-lg font-black tracking-tight text-fg-primary sm:text-xl">
                                                            {activeSession.sessionName}
                                                        </h3>
                                                        <span className={`rounded-token-md border px-2.5 py-1 text-[10px] font-black ${getStatusClass(activeSession.status)}`}>
                                                            {getStatusLabel(activeSession.status)}
                                                        </span>
                                                    </div>
                                                    <p className="mt-1 text-sm font-semibold text-fg-tertiary">
                                                        {getModeLabel(activeSession.mode)}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link
                                                href={`/dashboard/${gangId}/attendance/${activeSession.id}`}
                                                data-testid={`attendance-session-card-${activeSession.id}`}
                                                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl bg-status-success px-4 text-sm font-bold text-fg-inverse shadow-token-xs transition-transform hover:-translate-y-0.5"
                                            >
                                                เข้าหน้ารอบนี้
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </div>

                                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                                            <ActiveSessionMetric icon={Clock3} label="เวลาทำการ" value={`${formatTime(activeSession.startTime)} - ${formatTime(activeSession.endTime)}`} />
                                            <ActiveSessionMetric icon={Users} label="เช็คชื่อแล้ว" value={`${counts.present} / ${displayTotal} คน`} />
                                            <ActiveSessionMetric icon={CheckCircle2} label="เปอร์เซ็นต์" value={`${percent}%`} />
                                        </div>

                                        <div className="mt-4 h-2 overflow-hidden rounded-token-full bg-bg-subtle">
                                            <div className="h-full rounded-token-full bg-status-success transition-[width] duration-500" style={{ width: `${Math.min(percent, 100)}%` }} />
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div>
                                <span className="inline-flex rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-1 text-xs font-bold text-fg-tertiary">
                                    ไม่มีรอบเปิดอยู่
                                </span>
                                <h3 className="mt-4 font-heading text-xl font-black text-fg-primary">ยังไม่มีรอบเช็คชื่อที่กำลังดำเนินการ</h3>
                                <p className="mt-2 text-sm leading-6 text-fg-secondary">
                                    {canManageAttendance ? 'สร้างรอบใหม่เพื่อเริ่มเช็คชื่อ หรือดูประวัติรอบที่ปิดแล้วด้านล่าง' : 'เมื่อแอดมินเปิดรอบเช็คชื่อ คุณจะเห็นสถานะรอบล่าสุดที่นี่'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

function DashboardStatCard({
    icon: Icon,
    tone,
    label,
    value,
    suffix,
    action,
    href,
    onClick,
    mutedAction = false,
}: {
    icon: typeof CalendarCheck;
    tone: 'success' | 'info' | 'warning' | 'danger';
    label: string;
    value: number | string;
    suffix: string;
    action: string;
    href?: string;
    onClick?: () => void;
    mutedAction?: boolean;
}) {
    const toneClass = {
        success: 'border-status-success/20 bg-status-success-subtle text-fg-success',
        info: 'border-status-info/20 bg-status-info-subtle text-fg-info',
        warning: 'border-status-warning/20 bg-status-warning-subtle text-fg-warning',
        danger: 'border-status-danger/20 bg-status-danger-subtle text-fg-danger',
    }[tone];

    const content = (
        <div className="h-full rounded-token-2xl border border-border-subtle bg-bg-subtle p-3 shadow-token-xs transition-transform hover:-translate-y-0.5 sm:p-4">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-token-xl border sm:h-12 sm:w-12 ${toneClass}`}>
                <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <p className="text-xs font-bold text-fg-secondary sm:text-sm">{label}</p>
            <p className="mt-1 text-2xl font-black text-fg-primary tabular-nums">
                {value}
                <span className="ml-1 text-sm font-bold text-fg-tertiary">{suffix}</span>
            </p>
            <p className={`mt-3 inline-flex items-center gap-1 text-xs font-black sm:text-sm ${mutedAction ? 'text-fg-tertiary' : tone === 'danger' ? 'text-fg-danger' : 'text-fg-success'}`}>
                {action}
                {!mutedAction ? <ArrowRight className="h-4 w-4" /> : null}
            </p>
        </div>
    );

    if (href) {
        return <Link href={href} className="block h-full">{content}</Link>;
    }

    if (onClick) {
        return <button type="button" onClick={onClick} className="block h-full text-left">{content}</button>;
    }

    return content;
}

function ActiveSessionMetric({
    icon: Icon,
    label,
    value,
}: {
    icon: typeof CalendarCheck;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-[11px] font-bold text-fg-tertiary">
                <Icon className="h-3.5 w-3.5" />
                {label}
            </div>
            <p className="text-sm font-black text-fg-primary tabular-nums">{value}</p>
        </div>
    );
}

function HistorySummaryCard({
    icon: Icon,
    label,
    value,
    suffix,
    tone = 'default',
}: {
    icon: typeof Calendar;
    label: string;
    value: number;
    suffix: string;
    tone?: 'default' | 'success' | 'danger' | 'info' | 'warning';
}) {
    const toneClass = {
        default: 'border-border-subtle bg-bg-muted text-fg-secondary',
        success: 'border-status-success/20 bg-status-success-subtle text-fg-success',
        danger: 'border-status-danger/20 bg-status-danger-subtle text-fg-danger',
        info: 'border-status-info/20 bg-status-info-subtle text-fg-info',
        warning: 'border-status-warning/20 bg-status-warning-subtle text-fg-warning',
    }[tone];

    return (
        <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-xs">
            <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-token-xl border ${toneClass}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                    <p className="text-[11px] font-bold text-fg-tertiary">{label}</p>
                    <p className="mt-1 text-2xl font-black text-fg-primary tabular-nums">
                        {value.toLocaleString()}
                    </p>
                    <p className="text-xs font-bold text-fg-tertiary">{suffix}</p>
                </div>
            </div>
        </div>
    );
}

function HistoryTable({
    sessions,
    gangId,
    emptyText,
    compact = false,
}: {
    sessions: Session[];
    gangId: string;
    emptyText: string;
    compact?: boolean;
}) {
    if (sessions.length === 0) {
        return (
            <div className="m-4 rounded-token-2xl border border-dashed border-border-subtle bg-bg-muted p-6 text-center text-sm font-semibold text-fg-tertiary">
                {emptyText}
            </div>
        );
    }

    return (
        <>
            <div className="grid gap-3 p-3 sm:p-4 md:hidden">
                {sessions.map((session) => {
                    const counts = getSessionCounts(session);
                    const ModeIcon = getModeIcon(session.mode);

                    return (
                        <div key={session.id} className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-xs">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <Link href={`/dashboard/${gangId}/attendance/${session.id}`} className="font-black text-fg-primary hover:text-accent-bright">
                                        {session.sessionName}
                                    </Link>
                                    <p className="mt-1 text-xs font-semibold text-fg-tertiary">{formatDate(session.sessionDate)}</p>
                                </div>
                                <span className={`shrink-0 rounded-token-full border px-2.5 py-1 text-[10px] font-black ${getStatusClass(session.status)}`}>
                                    {getStatusLabel(session.status)}
                                </span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-xs font-bold text-fg-secondary">
                                    <ModeIcon className="h-3.5 w-3.5" />
                                    {getModeLabel(session.mode)}
                                </span>
                                <span className="rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-xs font-bold text-fg-secondary tabular-nums">
                                    {formatTime(session.startTime)} - {formatTime(session.endTime)}
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                                <HistoryMiniMetric label="มา" value={counts.present} tone="success" />
                                <HistoryMiniMetric label="ขาด" value={counts.absent} tone="danger" />
                                <HistoryMiniMetric label="ลา" value={counts.leave} tone="info" />
                                <HistoryMiniMetric label="รวม" value={counts.total} />
                            </div>
                            <Link
                                href={`/dashboard/${gangId}/attendance/${session.id}`}
                                data-testid={compact ? undefined : `attendance-session-card-${session.id}`}
                                className="mt-3 inline-flex min-h-10 w-full items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted px-3 text-xs font-black text-fg-secondary transition-colors hover:bg-bg-elevated hover:text-fg-primary"
                            >
                                เปิดดู
                            </Link>
                        </div>
                    );
                })}
            </div>

            <div className="hidden overflow-x-auto md:block">
                <table className="min-w-[860px] w-full text-left">
                    <thead className="border-b border-border-subtle bg-bg-muted">
                        <tr className="text-xs font-bold text-fg-tertiary">
                            <th className="px-5 py-3.5">รอบการเช็คชื่อ</th>
                            <th className="px-4 py-3.5">ประเภท</th>
                            <th className="px-4 py-3.5">เวลา</th>
                            <th className="px-4 py-3.5">ผลสรุป</th>
                            <th className="px-4 py-3.5 text-center">อัตรามา</th>
                            <th className="px-5 py-3.5 text-right">จัดการ</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {sessions.map((session) => {
                            const counts = getSessionCounts(session);
                            const ModeIcon = getModeIcon(session.mode);
                            const presentRate = counts.total > 0 ? Math.round((counts.present / counts.total) * 100) : 0;

                            return (
                                <tr key={session.id} className="transition-colors hover:bg-bg-muted/70">
                                    <td className="px-5 py-3">
                                        <Link href={`/dashboard/${gangId}/attendance/${session.id}`} className="flex items-center gap-3 font-bold text-fg-primary hover:text-accent-bright">
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-token-xl border border-border-subtle bg-bg-muted">
                                                <Calendar className="h-4 w-4 text-fg-tertiary" />
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-black">{session.sessionName}</span>
                                                <span className="block text-[10px] font-semibold text-fg-tertiary">{formatDate(session.sessionDate)}</span>
                                            </span>
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-col gap-2">
                                            <span className="inline-flex w-fit items-center gap-1.5 rounded-token-md border border-border-subtle bg-bg-muted px-2.5 py-1 text-xs font-bold text-fg-secondary">
                                                <ModeIcon className="h-3.5 w-3.5" />
                                                {getModeLabel(session.mode)}
                                            </span>
                                            <span className={`inline-flex w-fit rounded-token-full border px-2.5 py-1 text-[10px] font-black ${getStatusClass(session.status)}`}>
                                                {getStatusLabel(session.status)}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-semibold text-fg-secondary tabular-nums">
                                        <span>{formatTime(session.startTime)} - {formatTime(session.endTime)}</span>
                                        <span className="block text-fg-tertiary">{formatDate(session.sessionDate)}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1.5">
                                            <HistoryResultPill label="มา" value={counts.present} tone="success" />
                                            <HistoryResultPill label="ขาด" value={counts.absent} tone="danger" />
                                            <HistoryResultPill label="ลา" value={counts.leave} tone="info" />
                                            <HistoryResultPill label="รวม" value={counts.total} />
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="mx-auto w-24">
                                            <div className="flex items-center justify-between text-[11px] font-black text-fg-secondary">
                                                <span>{presentRate}%</span>
                                                <span className="text-fg-tertiary">{counts.present}/{counts.total}</span>
                                            </div>
                                            <div className="mt-1 h-2 overflow-hidden rounded-token-full bg-bg-muted">
                                                <div className="h-full rounded-token-full bg-status-success" style={{ width: `${Math.min(presentRate, 100)}%` }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <Link
                                            href={`/dashboard/${gangId}/attendance/${session.id}`}
                                            data-testid={compact ? undefined : `attendance-session-card-${session.id}`}
                                            className="inline-flex h-9 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle px-3 text-xs font-black text-fg-secondary transition-colors hover:bg-bg-elevated hover:text-fg-primary"
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
        </>
    );
}

function HistoryMiniMetric({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: number;
    tone?: 'default' | 'success' | 'danger' | 'info';
}) {
    const toneClass = {
        default: 'text-fg-secondary',
        success: 'text-fg-success',
        danger: 'text-fg-danger',
        info: 'text-fg-info',
    }[tone];

    return (
        <div className="rounded-token-lg border border-border-subtle bg-bg-muted px-2 py-2">
            <p className="text-[11px] font-bold text-fg-tertiary">{label}</p>
            <p className={`mt-1 text-sm font-black tabular-nums ${toneClass}`}>{value}</p>
        </div>
    );
}

function HistoryResultPill({
    label,
    value,
    tone = 'default',
}: {
    label: string;
    value: number;
    tone?: 'default' | 'success' | 'danger' | 'info';
}) {
    const toneClass = {
        default: 'border-border-subtle bg-bg-muted text-fg-secondary',
        success: 'border-status-success/20 bg-status-success-subtle text-fg-success',
        danger: 'border-status-danger/20 bg-status-danger-subtle text-fg-danger',
        info: 'border-status-info/20 bg-status-info-subtle text-fg-info',
    }[tone];

    return (
        <span className={`inline-flex min-w-14 items-center justify-between gap-2 rounded-token-md border px-2 py-1 text-[11px] font-black tabular-nums ${toneClass}`}>
            <span>{label}</span>
            <span>{value}</span>
        </span>
    );
}
