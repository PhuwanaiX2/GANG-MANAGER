'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    User,
    Calendar,
    FileText,
    DollarSign,
    CheckCircle2,
    XCircle,
    Clock,
    Filter,
    TrendingUp,
    TrendingDown,
    AlertCircle,
    Wallet,
    ChevronLeft,
    ChevronRight,
    CalendarOff
} from 'lucide-react';

interface AttendanceRecord {
    id: string;
    status: string;
    createdAt: Date;
    session: {
        sessionName: string;
        sessionDate: Date;
    };
}

interface LeaveRequest {
    id: string;
    type: string;
    reason: string;
    status: string;
    startDate: Date;
    endDate: Date;
    requestedAt: Date;
}

interface Transaction {
    id: string;
    type: string;
    amount: number;
    description: string | null;
    category: string | null;
    createdAt: Date;
    approvedAt?: Date | null;
    memberBalanceBefore?: number;
    memberBalanceAfter?: number;
}

interface Member {
    id: string;
    name: string;
    discordId: string | null;
    discordUsername?: string | null;
    discordAvatar?: string | null;
    gangRole?: string | null;
    balance: number;
    status: string;
    createdAt: Date;
}

interface FinanceSummary {
    loanDebt: number;
    collectionDue: number;
    availableCredit: number;
}

interface Props {
    member: Member;
    attendance: AttendanceRecord[];
    leaves: LeaveRequest[];
    transactions: Transaction[];
    gangId: string;
    hideHeader?: boolean;
    backHref?: string | null;
    profileLabel?: string;
    financeSummary: FinanceSummary;
}

type FilterType = 'all' | 'attendance' | 'leaves' | 'finance';

interface TimelineItem {
    id: string;
    type: 'attendance' | 'leave' | 'transaction';
    date: Date;
    data: AttendanceRecord | LeaveRequest | Transaction;
}

export function MemberActivityClient({
    member,
    attendance,
    leaves,
    transactions,
    gangId,
    hideHeader = false,
    backHref,
    profileLabel = 'โปรไฟล์สมาชิก',
    financeSummary,
}: Props) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const totalOutstanding = financeSummary.loanDebt + financeSummary.collectionDue;
    const overallDisplayValue = totalOutstanding > 0 ? totalOutstanding : financeSummary.availableCredit;
    const showFinanceSummary = totalOutstanding > 0 || financeSummary.availableCredit > 0 || transactions.length > 0;

    // Combine all activities into timeline
    const allActivities: TimelineItem[] = [
        ...attendance.map(a => ({
            id: `attendance-${a.id}`,
            type: 'attendance' as const,
            date: new Date(a.createdAt),
            data: a,
        })),
        ...leaves.map(l => ({
            id: `leave-${l.id}`,
            type: 'leave' as const,
            date: new Date(l.requestedAt),
            data: l,
        })),
        ...transactions.map(t => ({
            id: `transaction-${t.id}`,
            type: 'transaction' as const,
            date: new Date((t as any).approvedAt || (t as any).createdAt),
            data: t,
        })),
    ].sort((a, b) => b.date.getTime() - a.date.getTime());

    // Filter activities
    const filteredActivities = allActivities.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'attendance') return item.type === 'attendance';
        if (filter === 'leaves') return item.type === 'leave';
        if (filter === 'finance') return item.type === 'transaction';
        return true;
    });

    // Pagination
    const totalPages = Math.ceil(filteredActivities.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedActivities = filteredActivities.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Reset page when filter changes
    const handleFilterChange = (newFilter: FilterType) => {
        setFilter(newFilter);
        setCurrentPage(1);
    };

    // Stats
    const stats = {
        totalAttendance: attendance.length,
        present: attendance.filter(a => a.status === 'PRESENT').length,
        absent: attendance.filter(a => a.status === 'ABSENT').length,
        leave: attendance.filter(a => a.status === 'LEAVE').length,
        pendingLeaves: leaves.filter(l => l.status === 'PENDING').length,
        approvedLeaves: leaves.filter(l => l.status === 'APPROVED').length,
        totalIncome: transactions.filter(t => ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type)).reduce((sum, t) => sum + (t.amount || 0), 0),
        totalExpense: transactions.filter(t => ['EXPENSE', 'LOAN'].includes(t.type)).reduce((sum, t) => sum + Math.abs(t.amount || 0), 0),
    };
    const attendanceRate = stats.totalAttendance > 0 ? Math.round((stats.present / stats.totalAttendance) * 100) : 0;
    const roleLabels: Record<string, string> = {
        OWNER: 'หัวหน้าแก๊ง',
        ADMIN: 'รองหัวหน้า',
        TREASURER: 'เหรัญญิก',
        ATTENDANCE_OFFICER: 'เจ้าหน้าที่เช็คชื่อ',
        MEMBER: 'สมาชิก',
    };

    const renderAttendanceItem = (item: AttendanceRecord) => {
        const statusConfig = {
            PRESENT: { icon: CheckCircle2, color: 'text-fg-success', bg: 'bg-status-success-subtle', border: 'border-status-success', label: 'มา' },
            ABSENT: { icon: XCircle, color: 'text-fg-danger', bg: 'bg-status-danger-subtle', border: 'border-status-danger', label: 'ขาด' },
            LEAVE: { icon: FileText, color: 'text-fg-info', bg: 'bg-status-info-subtle', border: 'border-status-info', label: 'ลา' },
        }[item.status] || { icon: Clock, color: 'text-fg-tertiary', bg: 'bg-bg-muted', border: 'border-border-subtle', label: item.status };

        const Icon = statusConfig.icon;

        return (
            <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-token-xl border shadow-inner ${statusConfig.bg} ${statusConfig.border}`}>
                    <Calendar className={`w-4 h-4 ${statusConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-fg-primary text-sm font-semibold truncate tracking-wide">{item.session.sessionName}</p>
                    <p className="text-fg-tertiary text-[11px] font-medium tracking-wide mt-0.5">
                        {new Date(item.session.sessionDate).toLocaleDateString('th-TH', {
                            timeZone: 'Asia/Bangkok', day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <span className={`px-2.5 py-1 rounded-token-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border shadow-sm ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                    <Icon className="w-3 h-3" />
                    {statusConfig.label}
                </span>
            </div>
        );
    };

    const renderLeaveItem = (item: LeaveRequest) => {
        const statusConfig = {
            PENDING: { color: 'text-fg-warning', bg: 'bg-status-warning-subtle', border: 'border-status-warning', label: 'รออนุมัติ' },
            APPROVED: { color: 'text-fg-success', bg: 'bg-status-success-subtle', border: 'border-status-success', label: 'อนุมัติแล้ว' },
            REJECTED: { color: 'text-fg-danger', bg: 'bg-status-danger-subtle', border: 'border-status-danger', label: 'ปฏิเสธ' },
        }[item.status] || { color: 'text-fg-tertiary', bg: 'bg-bg-muted', border: 'border-border-subtle', label: item.status };

        // Type-specific config: FULL = purple (ลาหยุด), LATE = amber (เข้าช้า)
        const typeConfig = {
            FULL: { color: 'text-accent-bright', bg: 'bg-accent-subtle', border: 'border-border-accent', label: 'ลาหยุด', icon: CalendarOff },
            LATE: { color: 'text-fg-warning', bg: 'bg-status-warning-subtle', border: 'border-status-warning', label: 'แจ้งเข้าช้า', icon: Clock },
        }[item.type] || { color: 'text-fg-tertiary', bg: 'bg-bg-muted', border: 'border-border-subtle', label: item.type, icon: FileText };

        const TypeIcon = typeConfig.icon;

        return (
            <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-token-xl border shadow-inner ${typeConfig.bg} ${typeConfig.border}`}>
                    <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-fg-primary text-sm font-semibold truncate tracking-wide">{typeConfig.label}</p>
                    <p className="text-fg-tertiary text-[11px] font-medium tracking-wide mt-0.5 truncate max-w-[200px]">{item.reason}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-token-md text-[10px] font-bold uppercase tracking-widest border shadow-sm ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                    {statusConfig.label}
                </span>
            </div>
        );
    };

    const renderTransactionItem = (item: Transaction) => {
        const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(item.type) || (item.type === 'PENALTY' && item.amount < 0);
        const isDueOnly = item.type === 'GANG_FEE';
        const hasMemberBalance =
            typeof item.memberBalanceBefore === 'number' &&
            typeof item.memberBalanceAfter === 'number';
        const delta = hasMemberBalance ? item.memberBalanceAfter! - item.memberBalanceBefore! : null;

        const primaryLabel = (() => {
            switch (item.type) {
                case 'LOAN':
                    return 'เบิก/ยืมเงิน';
                case 'REPAYMENT':
                    return 'ชำระหนี้ยืมเข้ากองกลาง';
                case 'DEPOSIT':
                    return (typeof item.memberBalanceBefore === 'number' && item.memberBalanceBefore < 0)
                        ? 'ชำระค่าเก็บเงินแก๊ง'
                        : 'ชำระค่าเก็บเงินแก๊ง/ฝากเครดิต';
                case 'GANG_FEE':
                    return 'ตั้งยอดเก็บเงินแก๊ง';
                case 'PENALTY':
                    return item.amount < 0 ? 'คืนค่าปรับ' : 'ค่าปรับ/เข้าคุก';
                case 'INCOME':
                    return 'รายรับ';
                case 'EXPENSE':
                    return 'รายจ่าย';
                default:
                    return item.category || (isIncome ? 'รายรับ' : 'รายจ่าย');
            }
        })();

        const secondaryText = (() => {
            if (!item.description) return null;
            const trimmed = item.description.trim();
            if (trimmed.length === 0) return null;

            // Avoid repeating the same label as the primary title
            if (
                (item.type === 'LOAN' && trimmed === 'เบิก/ยืมเงิน') ||
                (item.type === 'REPAYMENT' && trimmed === 'คืนเงิน') ||
                (item.type === 'REPAYMENT' && trimmed === 'ชำระหนี้เข้ากองกลาง') ||
                (item.type === 'REPAYMENT' && trimmed === 'ชำระหนี้ยืมเข้ากองกลาง') ||
                (item.type === 'DEPOSIT' && trimmed === 'ฝากเงิน/สำรองจ่าย') ||
                (item.type === 'DEPOSIT' && trimmed === 'นำเงินเข้ากองกลาง/สำรองจ่าย') ||
                (item.type === 'DEPOSIT' && trimmed === 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต')
            ) {
                return null;
            }
            return trimmed;
        })();

        return (
            <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-token-xl border shadow-inner ${isDueOnly ? 'bg-accent-subtle border-border-accent' : isIncome ? 'bg-status-success-subtle border-status-success' : 'bg-status-danger-subtle border-status-danger'}`}>
                    {isDueOnly ? (
                        <Wallet className="w-4 h-4 text-accent-bright" />
                    ) : isIncome ? (
                        <TrendingUp className="w-4 h-4 text-fg-success" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-fg-danger" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-fg-primary text-sm font-semibold truncate tracking-wide">
                        {primaryLabel}
                    </p>
                    {secondaryText && (
                        <p className="text-fg-tertiary text-[11px] font-medium tracking-wide mt-0.5 truncate max-w-[200px]">
                            {secondaryText}
                        </p>
                    )}
                    {isDueOnly && (
                        <p className="text-accent-bright text-[10px] font-medium tracking-wide mt-1 opacity-80">
                            เป็นยอดค้าง ไม่ใช่เงินเข้ากองกลางทันที
                        </p>
                    )}
                    {hasMemberBalance && (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-fg-tertiary font-mono tracking-tight">
                            <span>฿{item.memberBalanceBefore!.toLocaleString()}</span>
                            <span className="text-border-strong">→</span>
                            <span>฿{item.memberBalanceAfter!.toLocaleString()}</span>
                            {typeof delta === 'number' && delta !== 0 && (
                                <span className={delta > 0 ? 'text-fg-success' : 'text-fg-danger'}>
                                    ({delta > 0 ? '+' : ''}฿{Math.abs(delta).toLocaleString()})
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <span className={`font-mono font-bold text-sm tracking-tight ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                    {isDueOnly ? `฿${Math.abs(item.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(item.amount).toLocaleString()}`}
                </span>
            </div>
        );
    };

    const renderActivityDetail = (item: TimelineItem) => {
        if (item.type === 'attendance') return renderAttendanceItem(item.data as AttendanceRecord);
        if (item.type === 'leave') return renderLeaveItem(item.data as LeaveRequest);
        return renderTransactionItem(item.data as Transaction);
    };

    const getActivityMeta = (type: TimelineItem['type']) => {
        if (type === 'attendance') {
            return {
                icon: Calendar,
                label: 'เช็คชื่อ',
                className: 'bg-status-info-subtle text-fg-info border-status-info',
            };
        }

        if (type === 'leave') {
            return {
                icon: FileText,
                label: 'การลา',
                className: 'bg-accent-subtle text-accent-bright border-border-accent',
            };
        }

        return {
            icon: DollarSign,
            label: 'การเงิน',
            className: 'bg-status-success-subtle text-fg-success border-status-success',
        };
    };

    return (
        <div className="animate-fade-in space-y-4 pb-24 md:pb-0">
            {!hideHeader && (
                <>
                    <div className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle p-3.5 shadow-token-sm sm:p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-start gap-3 sm:items-center sm:gap-4">
                                {backHref !== null && (
                                    <Link
                                        href={backHref || `/dashboard/${gangId}/members`}
                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-token-xl border border-border-subtle bg-bg-muted text-fg-secondary shadow-token-sm transition-colors hover:bg-bg-elevated hover:text-fg-primary sm:h-11 sm:w-11"
                                        aria-label="กลับไปหน้าสมาชิก"
                                    >
                                        <ArrowLeft className="h-5 w-5" />
                                    </Link>
                                )}

                                <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                                    {member.discordAvatar ? (
                                        <img
                                            src={member.discordAvatar}
                                            alt={member.name}
                                            className="h-12 w-12 shrink-0 rounded-token-xl border-2 border-border-subtle object-cover shadow-token-md sm:h-14 sm:w-14"
                                        />
                                    ) : (
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-token-xl border-2 border-border-subtle bg-bg-muted text-xl font-black text-fg-secondary shadow-token-md sm:h-14 sm:w-14">
                                            {member.name[0]?.toUpperCase() || <User className="h-7 w-7" />}
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <div className="mb-2 hidden items-center gap-2 rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 shadow-token-sm sm:inline-flex">
                                            <span className="h-1.5 w-1.5 rounded-token-full bg-accent-bright" />
                                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">{profileLabel}</span>
                                        </div>
                                        <h1 className="truncate font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">{member.name}</h1>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs font-semibold text-fg-tertiary sm:mt-2">
                                            <span className="rounded-token-full border border-border-subtle bg-bg-muted px-2.5 py-1 text-fg-secondary">
                                                {roleLabels[member.gangRole || 'MEMBER'] || member.gangRole || 'สมาชิก'}
                                            </span>
                                            {member.discordUsername && <span>@{member.discordUsername}</span>}
                                            {member.discordId && <span className="hidden font-mono tabular-nums sm:inline">ID {member.discordId}</span>}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 lg:min-w-[320px]">
                                <div className="rounded-token-lg border border-status-success/30 bg-status-success-subtle px-2 py-2 text-center shadow-inner">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-success">มา</p>
                                    <p className="mt-1 text-base font-black tabular-nums text-fg-primary">{stats.present}</p>
                                </div>
                                <div className="rounded-token-lg border border-status-danger/30 bg-status-danger-subtle px-2 py-2 text-center shadow-inner">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-danger">ขาด</p>
                                    <p className="mt-1 text-base font-black tabular-nums text-fg-primary">{stats.absent}</p>
                                </div>
                                <div className="rounded-token-lg border border-status-info/30 bg-status-info-subtle px-2 py-2 text-center shadow-inner">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-info">เรต</p>
                                    <p className="mt-1 text-base font-black tabular-nums text-fg-primary">{attendanceRate}%</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Member Summary Card */}
                    {showFinanceSummary && (
                    <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2.5 shadow-token-sm sm:p-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <div className="flex items-center gap-3 rounded-token-xl border border-border-subtle bg-bg-muted p-3 shadow-inner">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-lg border border-status-info bg-status-info-subtle">
                                    <Wallet className="w-4 h-4 text-fg-info" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary sm:text-[10px]">สถานะกับกองกลาง</p>
                                    <p className={`mt-0.5 truncate text-base font-black tabular-nums tracking-tight sm:text-lg ${totalOutstanding > 0 ? 'text-fg-danger' : overallDisplayValue > 0 ? 'text-fg-success' : 'text-fg-secondary'}`}>
                                        {totalOutstanding > 0 ? '' : overallDisplayValue > 0 ? '+' : ''}฿{overallDisplayValue.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-token-xl border border-border-subtle bg-bg-muted p-3 shadow-inner">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-lg border border-status-danger bg-status-danger-subtle">
                                    <TrendingDown className="w-4 h-4 text-fg-danger" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary sm:text-[10px]">หนี้ยืมคงค้าง</p>
                                    <p className="mt-0.5 truncate text-base font-black tabular-nums tracking-tight text-fg-danger sm:text-lg">฿{financeSummary.loanDebt.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-token-xl border border-border-subtle bg-bg-muted p-3 shadow-inner">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-lg border border-border-accent bg-accent-subtle">
                                    <Wallet className="w-4 h-4 text-accent-bright" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary sm:text-[10px]">ค้างเก็บเงิน</p>
                                    <p className="mt-0.5 truncate text-base font-black tabular-nums tracking-tight text-accent-bright sm:text-lg">฿{financeSummary.collectionDue.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 rounded-token-xl border border-border-subtle bg-bg-muted p-3 shadow-inner">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-token-lg border border-status-success bg-status-success-subtle">
                                    <CheckCircle2 className="w-4 h-4 text-fg-success" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary sm:text-[10px]">เครดิตคงเหลือ</p>
                                    <p className="mt-0.5 truncate text-base font-black tabular-nums tracking-tight text-fg-success sm:text-lg">฿{financeSummary.availableCredit.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    )}
                </>
            )}

            {/* Filter Tabs */}
            <section className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                <div className="flex items-start justify-between gap-3 sm:items-end">
                    <div>
                        <div className="hidden items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-accent-bright sm:inline-flex">
                            Activity ledger
                        </div>
                        <h2 className="font-heading text-base font-black tracking-tight text-fg-primary sm:mt-2">สมุดกิจกรรม</h2>
                        <p className="mt-1 hidden text-xs leading-5 text-fg-secondary sm:block">กรองประวัติเช็คชื่อ การลา และการเงินในไทม์ไลน์เดียว</p>
                    </div>
                    <div className="shrink-0 rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary tabular-nums">
                        {filteredActivities.length}/{allActivities.length}
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:overflow-x-auto sm:pb-1">
                    {[
                        { key: 'all', label: 'ทั้งหมด', icon: Filter, count: allActivities.length, colors: 'text-fg-secondary hover:bg-bg-muted hover:text-fg-primary', activeColors: 'bg-bg-elevated text-fg-primary border border-border-strong font-bold shadow-token-sm' },
                        { key: 'attendance', label: 'เช็คชื่อ', icon: Calendar, count: attendance.length, colors: 'text-fg-tertiary hover:bg-status-info-subtle hover:text-fg-info', activeColors: 'bg-status-info-subtle text-fg-info border border-status-info font-semibold shadow-token-sm' },
                        { key: 'leaves', label: 'การลา', icon: FileText, count: leaves.length, colors: 'text-fg-tertiary hover:bg-accent-subtle hover:text-accent-bright', activeColors: 'bg-accent-subtle text-accent-bright border border-border-accent font-semibold shadow-token-sm' },
                        { key: 'finance', label: 'การเงินแก๊ง', icon: DollarSign, count: transactions.length, colors: 'text-fg-tertiary hover:bg-status-success-subtle hover:text-fg-success', activeColors: 'bg-status-success-subtle text-fg-success border border-status-success font-semibold shadow-token-sm' },
                    ].map(tab => {
                        const isActive = filter === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => handleFilterChange(tab.key as FilterType)}
                                className={`flex min-h-10 items-center justify-center gap-2 whitespace-nowrap rounded-token-lg border px-3 py-2 text-sm transition-all sm:justify-start ${isActive ? tab.activeColors : `bg-bg-elevated border-border-subtle ${tab.colors}`
                                    }`}
                            >
                                <tab.icon className={`w-4 h-4 ${isActive && tab.key !== 'all' ? '' : 'opacity-70'}`} />
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded-token-sm text-[10px] font-bold tracking-widest tabular-nums ${isActive ? 'bg-bg-base/70 text-fg-primary' : 'bg-bg-muted border border-border-subtle text-fg-tertiary'}`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Activity Timeline */}
            <div className="space-y-3">
                {filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-bg-subtle border border-border-subtle rounded-token-xl shadow-token-sm">
                        <div className="w-12 h-12 bg-bg-muted rounded-token-xl flex items-center justify-center mb-4 border border-border-subtle shadow-inner">
                            <AlertCircle className="w-6 h-6 opacity-50 text-fg-tertiary" />
                        </div>
                        <h3 className="text-sm font-semibold text-fg-primary mb-1.5 tracking-wide">ไม่มีกิจกรรม</h3>
                        <p className="text-fg-tertiary text-xs tracking-wide">ยังไม่มีข้อมูลในหมวดหมู่นี้</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2.5 md:hidden">
                            {paginatedActivities.map((item) => {
                                const meta = getActivityMeta(item.type);
                                const MetaIcon = meta.icon;
                                return (
                                    <article key={item.id} className="overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                                        <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted px-3 py-2.5">
                                            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-fg-tertiary tabular-nums">
                                                <Clock className="h-3.5 w-3.5" />
                                                {item.date.toLocaleString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false,
                                                })}
                                            </div>
                                            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-token-md border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest shadow-sm ${meta.className}`}>
                                                <MetaIcon className="h-3 w-3" />
                                                {meta.label}
                                            </span>
                                        </div>
                                        <div className="p-3">
                                            {renderActivityDetail(item)}
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <div className="hidden overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm md:block">
                            <div className="overflow-x-auto">
                                <table className="min-w-[820px] w-full text-left">
                                    <thead className="bg-bg-muted border-b border-border-subtle">
                                        <tr>
                                            <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เวลา</th>
                                            <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประเภท</th>
                                            <th className="px-3 py-2.5 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายละเอียด</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {paginatedActivities.map(item => (
                                            <tr key={item.id} className="transition-colors hover:bg-bg-muted">
                                                <td className="px-3 py-2.5 align-middle whitespace-nowrap">
                                                    <div className="flex items-center gap-2 text-[11px] font-medium text-fg-tertiary tracking-wide uppercase tabular-nums">
                                                        <Clock className="w-3 h-3" />
                                                        {item.date.toLocaleString('th-TH', {
                                                            timeZone: 'Asia/Bangkok',
                                                            day: 'numeric',
                                                            month: 'short',
                                                            year: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                            hour12: false,
                                                        })}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5 align-middle">
                                                    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-token-md border shadow-sm ${item.type === 'attendance' ? 'bg-status-info-subtle text-fg-info border-status-info' :
                                                        item.type === 'leave' ? 'bg-accent-subtle text-accent-bright border-border-accent' :
                                                            'bg-status-success-subtle text-fg-success border-status-success'
                                                        }`}>
                                                        {item.type === 'attendance' ? <Calendar className="w-3 h-3" /> :
                                                            item.type === 'leave' ? <FileText className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
                                                        {item.type === 'attendance' ? 'เช็คชื่อ' :
                                                            item.type === 'leave' ? 'การลา' : 'การเงิน'}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2.5 align-middle">
                                                    {item.type === 'attendance' && renderAttendanceItem(item.data as AttendanceRecord)}
                                                    {item.type === 'leave' && renderLeaveItem(item.data as LeaveRequest)}
                                                    {item.type === 'transaction' && renderTransactionItem(item.data as Transaction)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex flex-col items-center justify-between gap-3 px-2 pt-2 sm:flex-row">
                                <span className="text-[11px] font-medium text-fg-tertiary tracking-wide order-2 sm:order-1">
                                    แสดง <span className="text-fg-secondary">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredActivities.length)}</span> จากทั้งหมด <span className="text-fg-secondary">{filteredActivities.length}</span> รายการ
                                </span>

                                <div className="flex items-center gap-2 order-1 sm:order-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted hover:border-border disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-token-sm"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-1.5 bg-bg-subtle p-1 rounded-token-xl border border-border-subtle shadow-token-sm">
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let page;
                                            if (totalPages <= 5) {
                                                page = i + 1;
                                            } else if (currentPage <= 3) {
                                                page = i + 1;
                                            } else if (currentPage >= totalPages - 2) {
                                                page = totalPages - 4 + i;
                                            } else {
                                                page = currentPage - 2 + i;
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    onClick={() => setCurrentPage(page)}
                                                    className={`w-7 h-7 rounded-token-lg text-xs font-semibold transition-all ${page === currentPage
                                                        ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                                                        : 'text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted'
                                                        }`}
                                                >
                                                    {page}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="p-1.5 rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted hover:border-border disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-token-sm"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
