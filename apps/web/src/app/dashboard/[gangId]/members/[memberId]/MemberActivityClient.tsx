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
    financeSummary: FinanceSummary;
}

type FilterType = 'all' | 'attendance' | 'leaves' | 'finance';

interface TimelineItem {
    id: string;
    type: 'attendance' | 'leave' | 'transaction';
    date: Date;
    data: AttendanceRecord | LeaveRequest | Transaction;
}

export function MemberActivityClient({ member, attendance, leaves, transactions, gangId, hideHeader = false, financeSummary }: Props) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;
    const totalOutstanding = financeSummary.loanDebt + financeSummary.collectionDue;
    const overallDisplayValue = totalOutstanding > 0 ? totalOutstanding : financeSummary.availableCredit;

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

    return (
        <div className="animate-fade-in space-y-6">
            {!hideHeader && (
                <>
                    {/* Header with Back Button */}
                    <div className="flex items-center gap-4 mb-2">
                        <Link
                            href={`/dashboard/${gangId}/members`}
                            className="p-2 rounded-token-xl bg-bg-muted hover:bg-bg-elevated transition-colors border border-border-subtle shadow-token-sm"
                        >
                            <ArrowLeft className="w-5 h-5 text-fg-secondary" />
                        </Link>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight text-fg-primary font-heading">{member.name}</h1>
                            <p className="text-fg-secondary text-sm flex items-center gap-2 mt-1 tracking-wide">
                                <User className="w-3.5 h-3.5" />
                                ประวัติกิจกรรม
                            </p>
                        </div>
                    </div>

                    {/* Member Summary Card */}
                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 sm:p-6 shadow-token-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center p-3 sm:p-4 rounded-token-xl bg-bg-muted border border-border-subtle shadow-inner">
                                <div className="w-8 h-8 rounded-token-lg bg-status-info-subtle border border-status-info flex items-center justify-center mx-auto mb-2">
                                    <Wallet className="w-4 h-4 text-fg-info" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-fg-tertiary mb-1 uppercase tracking-widest">สถานะกับกองกลาง</p>
                                <p className={`text-base sm:text-lg font-bold tabular-nums tracking-tight ${totalOutstanding > 0 ? 'text-fg-danger' : overallDisplayValue > 0 ? 'text-fg-success' : 'text-fg-secondary'}`}>
                                    {totalOutstanding > 0 ? '' : overallDisplayValue > 0 ? '+' : ''}฿{overallDisplayValue.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-center p-3 sm:p-4 rounded-token-xl bg-bg-muted border border-border-subtle shadow-inner">
                                <div className="w-8 h-8 rounded-token-lg bg-status-danger-subtle border border-status-danger flex items-center justify-center mx-auto mb-2">
                                    <TrendingDown className="w-4 h-4 text-fg-danger" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-fg-tertiary mb-1 uppercase tracking-widest">หนี้ยืมคงค้าง</p>
                                <p className="text-base sm:text-lg font-bold text-fg-danger tabular-nums tracking-tight">฿{financeSummary.loanDebt.toLocaleString()}</p>
                            </div>
                            <div className="text-center p-3 sm:p-4 rounded-token-xl bg-bg-muted border border-border-subtle shadow-inner">
                                <div className="w-8 h-8 rounded-token-lg bg-accent-subtle border border-border-accent flex items-center justify-center mx-auto mb-2">
                                    <Wallet className="w-4 h-4 text-accent-bright" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-fg-tertiary mb-1 uppercase tracking-widest">ค้างเก็บเงิน</p>
                                <p className="text-base sm:text-lg font-bold text-accent-bright tabular-nums tracking-tight">฿{financeSummary.collectionDue.toLocaleString()}</p>
                            </div>
                            <div className="text-center p-3 sm:p-4 rounded-token-xl bg-bg-muted border border-border-subtle shadow-inner">
                                <div className="w-8 h-8 rounded-token-lg bg-status-success-subtle border border-status-success flex items-center justify-center mx-auto mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-fg-success" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-fg-tertiary mb-1 uppercase tracking-widest">เครดิตคงเหลือ</p>
                                <p className="text-base sm:text-lg font-bold text-fg-success tabular-nums tracking-tight">฿{financeSummary.availableCredit.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-2">
                {[
                    { key: 'all', label: 'ทั้งหมด', icon: Filter, count: allActivities.length, colors: 'text-fg-secondary hover:bg-bg-muted hover:text-fg-primary', activeColors: 'bg-bg-elevated text-fg-primary border border-border-strong font-bold shadow-token-sm' },
                    { key: 'attendance', label: 'เช็คชื่อ', icon: Calendar, count: attendance.length, colors: 'text-fg-tertiary hover:bg-status-info-subtle hover:text-fg-info', activeColors: 'bg-status-info-subtle text-fg-info border border-status-info font-semibold shadow-token-sm' },
                    { key: 'leaves', label: 'การลา', icon: FileText, count: leaves.length, colors: 'text-fg-tertiary hover:bg-accent-subtle hover:text-accent-bright', activeColors: 'bg-accent-subtle text-accent-bright border border-border-accent font-semibold shadow-token-sm' },
                    { key: 'finance', label: 'การเงิน', icon: DollarSign, count: transactions.length, colors: 'text-fg-tertiary hover:bg-status-success-subtle hover:text-fg-success', activeColors: 'bg-status-success-subtle text-fg-success border border-status-success font-semibold shadow-token-sm' },
                ].map(tab => {
                    const isActive = filter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => handleFilterChange(tab.key as FilterType)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-token-xl text-sm transition-all whitespace-nowrap border ${isActive ? tab.activeColors : `bg-bg-subtle border-border-subtle ${tab.colors}`
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

            {/* Activity Timeline */}
            <div className="space-y-3">
                {filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm">
                        <div className="w-16 h-16 bg-bg-muted rounded-token-2xl flex items-center justify-center mb-4 border border-border-subtle shadow-inner">
                            <AlertCircle className="w-8 h-8 opacity-50 text-fg-tertiary" />
                        </div>
                        <h3 className="text-sm font-semibold text-fg-primary mb-1.5 tracking-wide">ไม่มีกิจกรรม</h3>
                        <p className="text-fg-tertiary text-xs tracking-wide">ยังไม่มีข้อมูลในหมวดหมู่นี้</p>
                    </div>
                ) : (
                    <>
                        <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                            <div className="overflow-x-auto">
                                <table className="min-w-[920px] w-full text-left">
                                    <thead className="bg-bg-muted border-b border-border-subtle">
                                        <tr>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เวลา</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประเภท</th>
                                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายละเอียด</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {paginatedActivities.map(item => (
                                            <tr key={item.id} className="transition-colors hover:bg-bg-muted">
                                                <td className="px-4 py-3 align-middle whitespace-nowrap">
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
                                                <td className="px-4 py-3 align-middle">
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
                                                <td className="px-4 py-3 align-middle">
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
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-2">
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
