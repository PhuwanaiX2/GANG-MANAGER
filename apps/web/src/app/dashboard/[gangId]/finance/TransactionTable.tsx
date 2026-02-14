'use client';

import { useState } from 'react';
import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    TrendingUp,
    PiggyBank,
    AlertTriangle,
    Banknote,
    History,
    ChevronLeft,
    ChevronRight,
    ArrowRightLeft,
    Coins,
    Siren,
    Ban
} from 'lucide-react';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';

interface Transaction {
    id: string;
    type: string;
    description: string;
    amount: number;
    balanceAfter: number;
    createdAt: Date;
    member?: {
        name: string;
    } | null;
    createdBy?: {
        name: string;
    } | null;
}

interface Props {
    transactions: Transaction[];
    currentPage: number;
    totalPages: number;
    totalItems?: number;
    itemsPerPage?: number;
}

export function TransactionTable({ transactions, currentPage, totalPages, totalItems = 0, itemsPerPage = 20 }: Props) {
    // Client-side pagination logic is removed. We use props now.
    // const [currentPage, setCurrentPage] = useState(1); <-- Removed

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'INCOME': return <ArrowUpRight className="w-4 h-4 text-green-400" />;
            case 'EXPENSE': return <ArrowDownLeft className="w-4 h-4 text-red-400" />;
            case 'LOAN': return <Banknote className="w-4 h-4 text-yellow-400" />;
            case 'REPAYMENT': return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
            case 'DEPOSIT': return <PiggyBank className="w-4 h-4 text-emerald-400" />;
            case 'PENALTY': return <Siren className="w-4 h-4 text-orange-400" />;
            default: return <Wallet className="w-4 h-4 text-gray-400" />;
        }
    };

    const typeLabels: Record<string, string> = {
        INCOME: 'รายรับ (ฝาก)',
        EXPENSE: 'รายจ่าย (ถอน)',
        LOAN: 'สมาชิกเบิก/ยืมเงิน',
        REPAYMENT: 'สมาชิบคืนเงิน',
        DEPOSIT: 'สมาชิกฝากเงิน',
        PENALTY: 'ค่าปรับ/เข้าคุก',
    };

    // Helper to generate pagination URL
    const getPageUrl = (page: number) => {
        // Use window.location.search to preserve other params if needed, but for now simple ?page= is enough
        const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
        params.set('page', page.toString());
        return `?${params.toString()}`;
    };

    return (
        <div className="bg-[#151515] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-6 border-b border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    <h3 className="font-bold text-white">ประวัติธุรกรรม</h3>
                </div>
                {totalItems > 0 && (
                    <span className="text-xs text-gray-500">
                        ทั้งหมด {totalItems.toLocaleString()} รายการ
                    </span>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-black/20 text-gray-400 text-xs uppercase font-semibold tracking-wider">
                        <tr>
                            <th className="px-6 py-4 text-left">ประเภท</th>
                            <th className="px-6 py-4 text-left">รายละเอียด</th>
                            <th className="px-6 py-4 text-left">สมาชิก</th>
                            <th className="px-6 py-4 text-left">ผู้ทำรายการ</th>
                            <th className="px-6 py-4 text-right">จำนวน</th>
                            <th className="px-6 py-4 text-right">คงเหลือ</th>
                            <th className="px-6 py-4 text-left">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <History className="w-10 h-10 opacity-20" />
                                        <span>ไม่พบข้อมูลธุรกรรมในหน้านี้</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t) => (
                                <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <span className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-lg bg-white/5`}>
                                                {getTypeIcon(t.type)}
                                            </div>
                                            <span className="text-sm font-medium">{typeLabels[t.type] || t.type}</span>
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 max-w-xs truncate text-gray-300">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">
                                                {['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(t.type)
                                                    ? `${t.member?.name || '-'} ${typeLabels[t.type] || t.type}`
                                                    : t.description
                                                }
                                            </span>
                                            {['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(t.type) && (
                                                <span className="text-xs text-gray-500">
                                                    {t.description}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-sm">
                                        {['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(t.type)
                                            ? (t.member?.name || '-')
                                            : '-'
                                        }
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-sm">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs bg-white/5 px-2 py-0.5 rounded border border-white/5">
                                                {t.createdBy?.name || 'System'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-mono font-bold ${['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type)
                                            ? 'text-green-400'
                                            : 'text-red-400'
                                            }`}>
                                            {['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type) ? '+' : '-'}
                                            ฿{t.amount.toLocaleString()}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right text-gray-500 font-mono text-sm">
                                        ฿{t.balanceAfter.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        {new Date(t.createdAt).toLocaleString('th-TH', {
                                            timeZone: 'Asia/Bangkok',
                                            day: 'numeric',
                                            month: 'short',
                                            year: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            hour12: false
                                        })}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 py-4 border-t border-white/5">
                    <a
                        href={currentPage > 1 ? getPageUrl(currentPage - 1) : '#'}
                        className={`p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 transition-colors ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-black/30'
                            }`}
                        aria-disabled={currentPage === 1}
                        onClick={(e) => currentPage === 1 && e.preventDefault()}
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </a>

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
                                <a
                                    key={page}
                                    href={getPageUrl(page)}
                                    className={`w-10 h-10 rounded-lg text-sm font-medium flex items-center justify-center transition-colors ${page === currentPage
                                        ? 'bg-discord-primary text-white'
                                        : 'bg-black/20 border border-white/5 text-gray-400 hover:text-white hover:bg-black/30'
                                        }`}
                                >
                                    {page}
                                </a>
                            );
                        })}
                    </div>

                    <a
                        href={currentPage < totalPages ? getPageUrl(currentPage + 1) : '#'}
                        className={`p-2 rounded-lg bg-black/20 border border-white/5 text-gray-400 transition-colors ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : 'hover:text-white hover:bg-black/30'
                            }`}
                        aria-disabled={currentPage === totalPages}
                        onClick={(e) => currentPage === totalPages && e.preventDefault()}
                    >
                        <ChevronRight className="w-5 h-5" />
                    </a>

                    <span className="text-xs text-gray-500 ml-2">
                        หน้า {currentPage} จาก {totalPages}
                    </span>
                </div>
            )}
        </div>
    );
}
