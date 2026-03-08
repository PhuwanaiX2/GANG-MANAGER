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

interface Props {
    member: Member;
    attendance: AttendanceRecord[];
    leaves: LeaveRequest[];
    transactions: Transaction[];
    gangId: string;
    hideHeader?: boolean;
}

type FilterType = 'all' | 'attendance' | 'leaves' | 'finance';

interface TimelineItem {
    id: string;
    type: 'attendance' | 'leave' | 'transaction';
    date: Date;
    data: AttendanceRecord | LeaveRequest | Transaction;
}

export function MemberActivityClient({ member, attendance, leaves, transactions, gangId, hideHeader = false }: Props) {
    const [filter, setFilter] = useState<FilterType>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 10;

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
            PRESENT: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'มา' },
            ABSENT: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'ขาด' },
            LEAVE: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'ลา' },
        }[item.status] || { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-white/10', label: item.status };

        const Icon = statusConfig.icon;

        return (
            <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border shadow-inner ${statusConfig.bg} ${statusConfig.border}`}>
                    <Calendar className={`w-4 h-4 ${statusConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 text-sm font-semibold truncate tracking-wide">{item.session.sessionName}</p>
                    <p className="text-zinc-500 text-[11px] font-medium tracking-wide mt-0.5">
                        {new Date(item.session.sessionDate).toLocaleDateString('th-TH', {
                            timeZone: 'Asia/Bangkok', day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border shadow-sm ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                    <Icon className="w-3 h-3" />
                    {statusConfig.label}
                </span>
            </div>
        );
    };

    const renderLeaveItem = (item: LeaveRequest) => {
        const statusConfig = {
            PENDING: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'รออนุมัติ' },
            APPROVED: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'อนุมัติแล้ว' },
            REJECTED: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', label: 'ปฏิเสธ' },
        }[item.status] || { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-white/10', label: item.status };

        // Type-specific config: FULL = purple (ลาหยุด), LATE = amber (เข้าช้า)
        const typeConfig = {
            FULL: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', label: 'ลาหยุด', icon: CalendarOff },
            LATE: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'แจ้งเข้าช้า', icon: Clock },
        }[item.type] || { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-white/10', label: item.type, icon: FileText };

        const TypeIcon = typeConfig.icon;

        return (
            <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border shadow-inner ${typeConfig.bg} ${typeConfig.border}`}>
                    <TypeIcon className={`w-4 h-4 ${typeConfig.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 text-sm font-semibold truncate tracking-wide">{typeConfig.label}</p>
                    <p className="text-zinc-500 text-[11px] font-medium tracking-wide mt-0.5 truncate max-w-[200px]">{item.reason}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border shadow-sm ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                    {statusConfig.label}
                </span>
            </div>
        );
    };

    const renderTransactionItem = (item: Transaction) => {
        const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(item.type);
        const hasMemberBalance =
            typeof item.memberBalanceBefore === 'number' &&
            typeof item.memberBalanceAfter === 'number';
        const delta = hasMemberBalance ? item.memberBalanceAfter! - item.memberBalanceBefore! : null;

        const primaryLabel = (() => {
            switch (item.type) {
                case 'LOAN':
                    return 'เบิก/ยืมเงิน';
                case 'REPAYMENT':
                    return 'คืนเงิน';
                case 'DEPOSIT':
                    return (typeof item.memberBalanceBefore === 'number' && item.memberBalanceBefore < 0)
                        ? 'ฝากเงิน (หักหนี้)'
                        : 'ฝากเงิน/สำรองจ่าย';
                case 'GANG_FEE':
                    return 'เก็บเงินแก๊ง';
                case 'PENALTY':
                    return 'ค่าปรับ/เข้าคุก';
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
                (item.type === 'DEPOSIT' && trimmed === 'ฝากเงิน/สำรองจ่าย')
            ) {
                return null;
            }
            return trimmed;
        })();

        return (
            <div className="flex items-center gap-3.5">
                <div className={`p-2.5 rounded-xl border shadow-inner ${isIncome ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                    {isIncome ? (
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-rose-400" />
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-zinc-200 text-sm font-semibold truncate tracking-wide">
                        {primaryLabel}
                    </p>
                    {secondaryText && (
                        <p className="text-zinc-500 text-[11px] font-medium tracking-wide mt-0.5 truncate max-w-[200px]">
                            {secondaryText}
                        </p>
                    )}
                    {hasMemberBalance && (
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-tight">
                            <span>฿{item.memberBalanceBefore!.toLocaleString()}</span>
                            <span className="text-zinc-700">→</span>
                            <span>฿{item.memberBalanceAfter!.toLocaleString()}</span>
                            {typeof delta === 'number' && delta !== 0 && (
                                <span className={delta > 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                    ({delta > 0 ? '+' : ''}฿{Math.abs(delta).toLocaleString()})
                                </span>
                            )}
                        </div>
                    )}
                </div>
                <span className={`font-mono font-bold text-sm tracking-tight ${isIncome ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isIncome ? '+' : '-'}฿{Math.abs(item.amount).toLocaleString()}
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
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors border border-white/10 shadow-sm"
                        >
                            <ArrowLeft className="w-5 h-5 text-zinc-400" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-white font-heading">{member.name}</h1>
                            <p className="text-zinc-400 text-sm flex items-center gap-2 mt-1 tracking-wide">
                                <User className="w-3.5 h-3.5" />
                                ประวัติกิจกรรม
                            </p>
                        </div>
                    </div>

                    {/* Member Summary Card */}
                    <div className="bg-[#111] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-sm">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center p-3 sm:p-4 rounded-xl bg-[#0A0A0A] border border-white/5 shadow-inner">
                                <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto mb-2">
                                    <Wallet className="w-4 h-4 text-blue-400" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-widest">ยอดสุทธิ</p>
                                <p className={`text-base sm:text-lg font-bold tabular-nums tracking-tight ${member.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    ฿{member.balance.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-center p-3 sm:p-4 rounded-xl bg-[#0A0A0A] border border-white/5 shadow-inner">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-widest">เช็คชื่อมา</p>
                                <p className="text-base sm:text-lg font-bold text-white tabular-nums tracking-tight">{stats.present}<span className="text-zinc-600 text-sm">/{stats.totalAttendance}</span></p>
                            </div>
                            <div className="text-center p-3 sm:p-4 rounded-xl bg-[#0A0A0A] border border-white/5 shadow-inner">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-2">
                                    <FileText className="w-4 h-4 text-purple-400" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-widest">ขอลาผ่าน</p>
                                <p className="text-base sm:text-lg font-bold text-white tabular-nums tracking-tight">{stats.approvedLeaves}</p>
                            </div>
                            <div className="text-center p-3 sm:p-4 rounded-xl bg-[#0A0A0A] border border-white/5 shadow-inner">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-2">
                                    <DollarSign className="w-4 h-4 text-amber-400" />
                                </div>
                                <p className="text-[10px] sm:text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-widest">การเงิน</p>
                                <p className="text-base sm:text-lg font-bold text-white tabular-nums tracking-tight">{transactions.length} <span className="text-zinc-600 text-sm font-medium">รายการ</span></p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2.5 overflow-x-auto custom-scrollbar pb-2">
                {[
                    { key: 'all', label: 'ทั้งหมด', icon: Filter, count: allActivities.length, colors: 'text-zinc-300 hover:bg-white/10 hover:text-white', activeColors: 'bg-white text-black font-bold shadow-md' },
                    { key: 'attendance', label: 'เช็คชื่อ', icon: Calendar, count: attendance.length, colors: 'text-zinc-400 hover:bg-blue-500/10 hover:text-blue-300', activeColors: 'bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold shadow-sm' },
                    { key: 'leaves', label: 'การลา', icon: FileText, count: leaves.length, colors: 'text-zinc-400 hover:bg-purple-500/10 hover:text-purple-300', activeColors: 'bg-purple-500/20 text-purple-400 border border-purple-500/30 font-semibold shadow-sm' },
                    { key: 'finance', label: 'การเงิน', icon: DollarSign, count: transactions.length, colors: 'text-zinc-400 hover:bg-emerald-500/10 hover:text-emerald-300', activeColors: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-semibold shadow-sm' },
                ].map(tab => {
                    const isActive = filter === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => handleFilterChange(tab.key as FilterType)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all whitespace-nowrap border ${isActive ? tab.activeColors : `bg-[#111] border-white/5 ${tab.colors}`
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${isActive && tab.key !== 'all' ? '' : 'opacity-70'}`} />
                            {tab.label}
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest tabular-nums ${isActive ? (tab.key === 'all' ? 'bg-black/20 text-black' : 'bg-black/30') : 'bg-[#0A0A0A] border border-white/5'}`}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Activity Timeline */}
            <div className="space-y-3">
                {filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-[#111] border border-white/5 rounded-2xl shadow-sm">
                        <div className="w-16 h-16 bg-[#0A0A0A] rounded-2xl flex items-center justify-center mb-4 border border-white/5 shadow-inner">
                            <AlertCircle className="w-8 h-8 opacity-50 text-zinc-400" />
                        </div>
                        <h3 className="text-sm font-semibold text-zinc-300 mb-1.5 tracking-wide">ไม่มีกิจกรรม</h3>
                        <p className="text-zinc-500 text-xs tracking-wide">ยังไม่มีข้อมูลในหมวดหมู่นี้</p>
                    </div>
                ) : (
                    <>
                        {paginatedActivities.map(item => (
                            <div
                                key={item.id}
                                className="bg-[#111] border border-white/5 rounded-xl p-4 sm:p-5 hover:border-white/10 transition-colors shadow-sm group"
                            >
                                <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3 text-zinc-500" />
                                        <span className="text-[11px] font-medium text-zinc-500 tracking-wide uppercase">
                                            {item.date.toLocaleString('th-TH', {
                                                timeZone: 'Asia/Bangkok',
                                                day: 'numeric',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit',
                                                hour12: false,
                                            })}
                                        </span>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border shadow-sm ${item.type === 'attendance' ? 'bg-blue-500/5 text-blue-400 border-blue-500/20' :
                                        item.type === 'leave' ? 'bg-purple-500/5 text-purple-400 border-purple-500/20' :
                                            'bg-emerald-500/5 text-emerald-400 border-emerald-500/20'
                                        }`}>
                                        {item.type === 'attendance' ? 'เช็คชื่อ' :
                                            item.type === 'leave' ? 'การลา' : 'การเงิน'}
                                    </span>
                                </div>
                                <div className="pl-1">
                                    {item.type === 'attendance' && renderAttendanceItem(item.data as AttendanceRecord)}
                                    {item.type === 'leave' && renderLeaveItem(item.data as LeaveRequest)}
                                    {item.type === 'transaction' && renderTransactionItem(item.data as Transaction)}
                                </div>
                            </div>
                        ))}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 px-2">
                                <span className="text-[11px] font-medium text-zinc-500 tracking-wide order-2 sm:order-1">
                                    แสดง <span className="text-zinc-300">{startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredActivities.length)}</span> จากทั้งหมด <span className="text-zinc-300">{filteredActivities.length}</span> รายการ
                                </span>

                                <div className="flex items-center gap-2 order-1 sm:order-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="p-1.5 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    <div className="flex items-center gap-1.5 bg-[#111] p-1 rounded-xl border border-white/5 shadow-sm">
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
                                                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${page === currentPage
                                                        ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-white/10'
                                                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
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
                                        className="p-1.5 rounded-lg bg-[#111] border border-white/5 text-zinc-500 hover:text-zinc-300 hover:bg-[#1a1a1a] hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
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
