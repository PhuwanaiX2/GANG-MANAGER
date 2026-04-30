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
            case 'INCOME': return <ArrowUpRight className="w-4 h-4 text-fg-success" />;
            case 'EXPENSE': return <ArrowDownLeft className="w-4 h-4 text-fg-danger" />;
            case 'LOAN': return <Banknote className="w-4 h-4 text-fg-warning" />;
            case 'REPAYMENT': return <ArrowRightLeft className="w-4 h-4 text-fg-info" />;
            case 'DEPOSIT': return <PiggyBank className="w-4 h-4 text-fg-success" />;
            case 'GANG_FEE': return <Coins className="w-4 h-4 text-accent-bright" />;
            case 'PENALTY': return <Siren className="w-4 h-4 text-fg-warning" />;
            default: return <Wallet className="w-4 h-4 text-fg-tertiary" />;
        }
    };

    const typeLabels: Record<string, string> = {
        INCOME: 'รายรับเข้ากองกลาง',
        EXPENSE: 'รายจ่ายจากกองกลาง',
        LOAN: 'สมาชิกยืมจากกองกลาง',
        REPAYMENT: 'ชำระหนี้ยืมเข้ากองกลาง',
        DEPOSIT: 'เก็บเงินแก๊ง/ฝากเครดิต',
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
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm flex flex-col">
            <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-border-subtle bg-bg-muted flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <History className="w-4 h-4 text-fg-tertiary" />
                    <h3 className="font-bold text-sm text-fg-primary tracking-wide font-heading">ประวัติธุรกรรม</h3>
                </div>
                {totalItems > 0 && (
                    <span className="text-[11px] text-fg-tertiary font-medium">
                        ทั้งหมด {totalItems.toLocaleString()} รายการ
                    </span>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-border-subtle bg-bg-muted">
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary whitespace-nowrap">ประเภท</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายละเอียด</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary hidden sm:table-cell whitespace-nowrap">สมาชิก</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary hidden xl:table-cell whitespace-nowrap">ผู้ทำรายการ</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right whitespace-nowrap">จำนวน</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right hidden sm:table-cell whitespace-nowrap">คงเหลือ</th>
                            <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary hidden sm:table-cell whitespace-nowrap">วันที่</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {transactions.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3 text-fg-tertiary">
                                        <div className="w-12 h-12 rounded-token-full bg-bg-muted flex items-center justify-center border border-border-subtle">
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
                                    <tr key={t.id} className="hover:bg-bg-muted transition-colors group">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className="flex items-center gap-2.5">
                                                <div className={`p-1.5 rounded-token-lg border ${isDueOnly ? 'bg-accent-subtle border-border-accent' : isIncome ? 'bg-status-success-subtle border-status-success/20' : 'bg-status-danger-subtle border-status-danger/20'}`}>
                                                    {getTypeIcon(t.type)}
                                                </div>
                                                <span className="text-xs font-bold text-fg-secondary group-hover:text-fg-primary transition-colors">{displayTypeLabel}</span>
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col max-w-[180px] sm:max-w-xs md:max-w-sm">
                                                <span className="font-medium text-fg-primary text-sm truncate">
                                                    {['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                        ? t.type === 'GANG_FEE'
                                                            ? `${t.member?.name || '-'} ค้างเก็บเงินแก๊ง`
                                                            : `${t.member?.name || '-'} ${displayTypeLabel}`
                                                        : t.description
                                                    }
                                                </span>
                                                {['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type) && (
                                                    <span className="text-xs text-fg-tertiary truncate mt-0.5" title={t.description}>
                                                        {t.description}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                                            <span className="text-xs font-medium text-fg-secondary">
                                                {['LOAN', 'REPAYMENT', 'DEPOSIT', 'GANG_FEE', 'PENALTY'].includes(t.type)
                                                    ? (t.member?.name || '-')
                                                    : '-'
                                                }
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 hidden xl:table-cell whitespace-nowrap">
                                            <span className="inline-flex items-center text-xs font-medium bg-bg-muted text-fg-secondary px-2 py-1 rounded-token-md border border-border-subtle">
                                                {t.createdBy?.name || 'System'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <span className={`font-mono font-semibold text-sm ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                {isDueOnly ? `฿${t.amount.toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                            </span>
                                            {isDueOnly && (
                                                <div className="text-[10px] text-fg-tertiary mt-1">ยังไม่เข้ากองกลาง</div>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap">
                                            <span className="text-xs text-fg-tertiary font-mono">
                                                ฿{t.balanceAfter.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                                            <span className="text-xs text-fg-tertiary">
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
                <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-border-subtle bg-bg-muted">
                    <span className="text-xs text-fg-tertiary hidden sm:inline-block">
                        หน้า {currentPage} จาก {totalPages}
                    </span>
                    <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-start">
                        <a
                            href={currentPage > 1 ? getPageUrl(currentPage - 1) : '#'}
                            className={`p-2 rounded-token-lg border transition-colors ${currentPage === 1
                                ? 'bg-bg-muted text-fg-tertiary cursor-not-allowed border-transparent opacity-60'
                                : 'bg-bg-subtle text-fg-secondary border-border-subtle hover:text-fg-primary hover:bg-bg-elevated'
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
                                        className={`w-9 h-9 flex items-center justify-center rounded-token-lg text-sm font-medium transition-all ${page === currentPage
                                            ? 'bg-accent text-accent-fg shadow-token-sm scale-110'
                                            : 'bg-transparent text-fg-secondary hover:text-fg-primary hover:bg-bg-elevated'
                                            }`}
                                    >
                                        {page}
                                    </a>
                                );
                            })}
                        </div>

                        <a
                            href={currentPage < totalPages ? getPageUrl(currentPage + 1) : '#'}
                            className={`p-2 rounded-token-lg border transition-colors ${currentPage === totalPages
                                ? 'bg-bg-muted text-fg-tertiary cursor-not-allowed border-transparent opacity-60'
                                : 'bg-bg-subtle text-fg-secondary border-border-subtle hover:text-fg-primary hover:bg-bg-elevated'
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
