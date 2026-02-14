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
    ChevronRight
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
            date: new Date(t.createdAt),
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
            PRESENT: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'มา' },
            ABSENT: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'ขาด' },
            LEAVE: { icon: FileText, color: 'text-blue-400', bg: 'bg-blue-500/10', label: 'ลา' },
        }[item.status] || { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/10', label: item.status };

        const Icon = statusConfig.icon;

        return (
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${statusConfig.bg}`}>
                    <Calendar className={`w-4 h-4 ${statusConfig.color}`} />
                </div>
                <div className="flex-1">
                    <p className="text-white text-sm font-medium">{item.session.sessionName}</p>
                    <p className="text-gray-500 text-xs">
                        {new Date(item.session.sessionDate).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color} flex items-center gap-1`}>
                    <Icon className="w-3 h-3" />
                    {statusConfig.label}
                </span>
            </div>
        );
    };

    const renderLeaveItem = (item: LeaveRequest) => {
        const statusConfig = {
            PENDING: { color: 'text-yellow-400', bg: 'bg-yellow-500/10', label: 'รออนุมัติ' },
            APPROVED: { color: 'text-green-400', bg: 'bg-green-500/10', label: 'อนุมัติแล้ว' },
            REJECTED: { color: 'text-red-400', bg: 'bg-red-500/10', label: 'ปฏิเสธ' },
        }[item.status] || { color: 'text-gray-400', bg: 'bg-gray-500/10', label: item.status };

        // Type-specific config: FULL = purple (ลาหยุด), LATE = amber (เข้าช้า)
        const typeConfig = {
            FULL: { color: 'text-purple-400', bg: 'bg-purple-500/10', label: 'ลาหยุด', icon: 'CalendarOff' },
            LATE: { color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'แจ้งเข้าช้า', icon: 'Clock' },
        }[item.type] || { color: 'text-gray-400', bg: 'bg-gray-500/10', label: item.type, icon: 'FileText' };

        return (
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${typeConfig.bg}`}>
                    <FileText className={`w-4 h-4 ${typeConfig.color}`} />
                </div>
                <div className="flex-1">
                    <p className="text-white text-sm font-medium">{typeConfig.label}</p>
                    <p className="text-gray-500 text-xs truncate max-w-[200px]">{item.reason}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.color}`}>
                    {statusConfig.label}
                </span>
            </div>
        );
    };

    const renderTransactionItem = (item: Transaction) => {
        const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(item.type);

        return (
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isIncome ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                    {isIncome ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                    ) : (
                        <TrendingDown className="w-4 h-4 text-red-400" />
                    )}
                </div>
                <div className="flex-1">
                    <p className="text-white text-sm font-medium">
                        {item.category || (isIncome ? 'รายรับ' : 'รายจ่าย')}
                    </p>
                    <p className="text-gray-500 text-xs truncate max-w-[200px]">
                        {item.description || '-'}
                    </p>
                </div>
                <span className={`font-mono font-bold text-sm ${isIncome ? 'text-green-400' : 'text-red-400'}`}>
                    {isIncome ? '+' : '-'}฿{Math.abs(item.amount).toLocaleString()}
                </span>
            </div>
        );
    };

    return (
        <>
            {!hideHeader && (
                <>
                    {/* Header with Back Button */}
                    <div className="flex items-center gap-4 mb-6">
                        <Link
                            href={`/dashboard/${gangId}/members`}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </Link>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{member.name}</h1>
                            <p className="text-gray-400 text-sm flex items-center gap-2">
                                <User className="w-3 h-3" />
                                ประวัติกิจกรรม
                            </p>
                        </div>
                    </div>

                    {/* Member Summary Card */}
                    <div className="bg-[#151515] border border-white/5 rounded-2xl p-6 mb-6">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div className="text-center p-3 rounded-xl bg-black/20">
                                <Wallet className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-400 mb-1">ยอดคงเหลือ</p>
                                <p className={`text-lg font-bold ${member.balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    ฿{member.balance.toLocaleString()}
                                </p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-black/20">
                                <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-400 mb-1">เช็คชื่อมา</p>
                                <p className="text-lg font-bold text-white">{stats.present}/{stats.totalAttendance}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-black/20">
                                <FileText className="w-5 h-5 text-purple-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-400 mb-1">ขอลา</p>
                                <p className="text-lg font-bold text-white">{stats.approvedLeaves}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-black/20">
                                <DollarSign className="w-5 h-5 text-yellow-400 mx-auto mb-2" />
                                <p className="text-xs text-gray-400 mb-1">ธุรกรรม</p>
                                <p className="text-lg font-bold text-white">{transactions.length}</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {[
                    { key: 'all', label: 'ทั้งหมด', icon: Filter, count: allActivities.length, color: 'bg-discord-primary' },
                    { key: 'attendance', label: 'เช็คชื่อ', icon: Calendar, count: attendance.length, color: 'bg-cyan-500' },
                    { key: 'leaves', label: 'การลา', icon: FileText, count: leaves.length, color: 'bg-purple-500' },
                    { key: 'finance', label: 'การเงิน', icon: DollarSign, count: transactions.length, color: 'bg-emerald-500' },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => handleFilterChange(tab.key as FilterType)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${filter === tab.key
                                ? `${tab.color} text-white`
                                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                        <span className={`px-1.5 py-0.5 rounded text-xs ${filter === tab.key ? 'bg-white/20' : 'bg-white/5'}`}>
                            {tab.count}
                        </span>
                    </button>
                ))}
            </div>

            {/* Activity Timeline */}
            <div className="space-y-3">
                {filteredActivities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 bg-[#151515] border border-dashed border-white/10 rounded-2xl">
                        <AlertCircle className="w-12 h-12 text-gray-500 mb-4" />
                        <h3 className="text-lg font-bold text-white mb-2">ไม่มีกิจกรรม</h3>
                        <p className="text-gray-400 text-sm">ยังไม่มีข้อมูลในหมวดหมู่นี้</p>
                    </div>
                ) : (
                    <>
                        {paginatedActivities.map(item => (
                            <div
                                key={item.id}
                                className="bg-[#151515] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs text-gray-500">
                                        {item.date.toLocaleDateString('th-TH', {
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    <span className={`text-xs px-2 py-0.5 rounded-full ${item.type === 'attendance' ? 'bg-blue-500/10 text-blue-400' :
                                        item.type === 'leave' ? 'bg-purple-500/10 text-purple-400' :
                                            'bg-yellow-500/10 text-yellow-400'
                                        }`}>
                                        {item.type === 'attendance' ? 'เช็คชื่อ' :
                                            item.type === 'leave' ? 'การลา' : 'การเงิน'}
                                    </span>
                                </div>
                                {item.type === 'attendance' && renderAttendanceItem(item.data as AttendanceRecord)}
                                {item.type === 'leave' && renderLeaveItem(item.data as LeaveRequest)}
                                {item.type === 'transaction' && renderTransactionItem(item.data as Transaction)}
                            </div>
                        ))}

                        {/* Pagination Controls */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-2 pt-4">
                                <button
                                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                    disabled={currentPage === 1}
                                    className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-1">
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
                                                className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors ${page === currentPage
                                                    ? 'bg-discord-primary text-white'
                                                    : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30'
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
                                    className="p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>

                                <span className="text-xs text-gray-500 ml-2">
                                    {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredActivities.length)} จาก {filteredActivities.length}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>
        </>
    );
}
