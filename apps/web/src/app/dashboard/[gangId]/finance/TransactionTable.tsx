'use client';

import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    PiggyBank,
    Banknote,
    History,
    ChevronLeft,
    ChevronRight,
    ArrowRightLeft,
    Coins,
    Siren
} from 'lucide-react';

interface Transaction {
    id: string;
    type: string;
    description: string;
    amount: number;
    balanceAfter: number;
    createdAt: Date;
    approvedAt?: Date | null;
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
            case 'INCOME': return <ArrowUpRight className="w-4 h-4 text-emerald-400" />;
            case 'EXPENSE': return <ArrowDownLeft className="w-4 h-4 text-rose-400" />;
            case 'LOAN': return <Banknote className="w-4 h-4 text-amber-400" />;
            case 'REPAYMENT': return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
            case 'DEPOSIT': return <PiggyBank className="w-4 h-4 text-emerald-400" />;
            case 'GANG_FEE': return <Coins className="w-4 h-4 text-purple-400" />;
            case 'PENALTY': return <Siren className="w-4 h-4 text-orange-400" />;
            default: return <Wallet className="w-4 h-4 text-zinc-400" />;
        }
    };

    const typeLabels: Record<string, string> = {
        INCOME: 'รายรับเข้ากองกลาง',
        EXPENSE: 'รายจ่ายจากกองกลาง',
        LOAN: 'สมาชิกยืมจากกองกลาง',
        REPAYMENT: 'ชำระหนี้เข้ากองกลาง',
        DEPOSIT: 'นำเงินเข้ากองกลาง',
        GANG_FEE: 'ตั้งยอดเก็บเงินแก๊ง',
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
        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 sm:p-5 border-b border-white/5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-zinc-400" />
                    <h3 className="font-semibold text-white tracking-wide font-heading">ประวัติธุรกรรม</h3>
                </div>
                {totalItems > 0 && (
                    <span className="text-xs text-zinc-500 font-medium">
                        ทั้งหมด {totalItems.toLocaleString()} รายการ
                    </span>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-white/5 bg-[#111]/50 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold whitespace-nowrap">ประเภท</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold">รายละเอียด</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold hidden md:table-cell whitespace-nowrap">สมาชิก</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold hidden lg:table-cell whitespace-nowrap">ผู้ทำรายการ</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold text-right whitespace-nowrap">จำนวน</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold text-right hidden sm:table-cell whitespace-nowrap">คงเหลือ</th>
                            <th className="px-4 py-3 sm:px-6 sm:py-4 font-semibold hidden sm:table-cell whitespace-nowrap">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3 text-zinc-500">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                            <History className="w-6 h-6 opacity-40" />
                                        </div>
                                        <span className="text-sm">ไม่พบข้อมูลธุรกรรมในหน้านี้</span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            transactions.map((t) => {
                                const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type) || (t.type === 'PENALTY' && t.amount < 0);
                                const isDueOnly = t.type === 'GANG_FEE';
                                const displayTypeLabel = t.type === 'PENALTY' && t.amount < 0
                                    ? 'คืน/ปรับค่าปรับ'
                                    : typeLabels[t.type] || t.type;
                                return (
                                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                                        <td className="px-4 py-3 sm:px-6 sm:py-4 whitespace-nowrap">
                                            <span className="flex items-center gap-2.5">
                                                <div className={`p-1.5 rounded-lg ${isDueOnly ? 'bg-purple-500/10' : isIncome ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                                                    {getTypeIcon(t.type)}
                                                </div>
                                                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors">{displayTypeLabel}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 sm:px-6 sm:py-4">
                                            <div className="flex flex-col max-w-[150px] sm:max-w-xs md:max-w-sm">
                                                <span className="font-medium text-zinc-200 text-sm truncate">
                                                    {['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                        ? t.type === 'GANG_FEE'
                                                            ? `${t.member?.name || '-'} ค้างเก็บเงินแก๊ง`
                                                            : `${t.member?.name || '-'} ${displayTypeLabel}`
                                                        : t.description
                                                    }
                                                </span>
                                                {['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type) && (
                                                    <span className="text-xs text-zinc-500 truncate mt-0.5" title={t.description}>
                                                        {t.description}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 sm:px-6 sm:py-4 hidden md:table-cell whitespace-nowrap">
                                            <span className="text-sm text-zinc-400">
                                                {['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                    ? (t.member?.name || '-')
                                                    : '-'
                                                }
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 sm:px-6 sm:py-4 hidden lg:table-cell whitespace-nowrap">
                                            <span className="inline-flex items-center text-xs font-medium bg-white/5 text-zinc-400 px-2 py-1 rounded-md border border-white/5">
                                                {t.createdBy?.name || 'System'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 sm:px-6 sm:py-4 text-right whitespace-nowrap">
                                            <span className={`font-mono font-semibold text-sm ${isDueOnly ? 'text-purple-400' : isIncome ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                {isDueOnly ? `฿${t.amount.toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                            </span>
                                            {isDueOnly && (
                                                <div className="text-[10px] text-zinc-600 mt-1">ยังไม่เข้ากองกลาง</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 sm:px-6 sm:py-4 text-right hidden sm:table-cell whitespace-nowrap">
                                            <span className="text-sm text-zinc-500 font-mono">
                                                ฿{t.balanceAfter.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 sm:px-6 sm:py-4 hidden sm:table-cell whitespace-nowrap">
                                            <span className="text-xs text-zinc-500">
                                                {new Date((t as any).approvedAt || t.createdAt).toLocaleString('th-TH', {
                                                    timeZone: 'Asia/Bangkok',
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false
                                                })}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-white/5 bg-[#111]/30">
                    <span className="text-xs text-zinc-500 hidden sm:inline-block">
                        หน้า {currentPage} จาก {totalPages}
                    </span>
                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-start">
                        <a
                            href={currentPage > 1 ? getPageUrl(currentPage - 1) : '#'}
                            className={`p-2 rounded-lg border border-white/10 transition-colors ${currentPage === 1
                                ? 'bg-white/5 text-zinc-600 cursor-not-allowed border-transparent'
                                : 'bg-[#111] text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                                }`}
                            aria-disabled={currentPage === 1}
                            onClick={(e) => currentPage === 1 && e.preventDefault()}
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </a>

                        <div className="flex items-center gap-1 mx-2">
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
                                        className={`w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${page === currentPage
                                            ? 'bg-white text-black shadow-sm scale-110'
                                            : 'bg-transparent text-zinc-400 hover:text-white hover:bg-white/10'
                                            }`}
                                    >
                                        {page}
                                    </a>
                                );
                            })}
                        </div>

                        <a
                            href={currentPage < totalPages ? getPageUrl(currentPage + 1) : '#'}
                            className={`p-2 rounded-lg border border-white/10 transition-colors ${currentPage === totalPages
                                ? 'bg-white/5 text-zinc-600 cursor-not-allowed border-transparent'
                                : 'bg-[#111] text-zinc-400 hover:text-white hover:bg-[#1a1a1a]'
                                }`}
                            aria-disabled={currentPage === totalPages}
                            onClick={(e) => currentPage === totalPages && e.preventDefault()}
                        >
                            <ChevronRight className="w-4 h-4" />
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
