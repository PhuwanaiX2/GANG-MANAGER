'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    DollarSign, TrendingUp, CreditCard, Clock, RefreshCw,
    ArrowUpRight, ArrowDownRight, Receipt, Banknote, PieChart,
    ExternalLink, AlertTriangle, Loader2, QrCode, Wallet,
    BarChart3, Calendar, ChevronDown,
} from 'lucide-react';

interface StripeData {
    balance: {
        available: { amount: number; currency: string }[];
        pending: { amount: number; currency: string }[];
    };
    revenue: {
        total: number;
        fees: number;
        net: number;
        currency: string;
    };
    charges: {
        successful: number;
        failed: number;
        total: number;
    };
    checkout: {
        paid: number;
        pending: number;
    };
    revenueByTier: Record<string, { count: number; amount: number }>;
    dailyRevenue: Record<string, number>;
    recentTransactions: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        created: number;
        description: string | null;
        receiptUrl: string | null;
        paymentMethod: string;
        metadata: Record<string, string>;
        customerEmail: string | null;
    }[];
    paymentMethods: Record<string, number>;
    period: string;
}

const PERIODS = [
    { value: '7d', label: '7 วัน' },
    { value: '30d', label: '30 วัน' },
    { value: '90d', label: '90 วัน' },
    { value: 'all', label: 'ทั้งหมด' },
];

function formatTHB(satang: number): string {
    return `฿${(satang / 100).toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
}

function formatDate(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

const PAYMENT_METHOD_LABELS: Record<string, { label: string; icon: typeof CreditCard }> = {
    card: { label: 'บัตรเครดิต/เดบิต', icon: CreditCard },
    promptpay: { label: 'PromptPay QR', icon: QrCode },
    unknown: { label: 'ไม่ทราบ', icon: Wallet },
};

const TIER_COLORS: Record<string, string> = {
    PRO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PREMIUM: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    Unknown: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

export function SalesDashboard() {
    const [data, setData] = useState<StripeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [period, setPeriod] = useState('30d');

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/admin/stripe?period=${period}`);
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || `HTTP ${res.status}`);
            }
            const json = await res.json();
            setData(json);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [period]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Bar chart helper — simple CSS bars
    const dailyEntries = data ? Object.entries(data.dailyRevenue).sort(([a], [b]) => a.localeCompare(b)).slice(-14) : [];
    const maxDaily = Math.max(...dailyEntries.map(([, v]) => v), 1);

    if (error) {
        return (
            <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-8 text-center">
                <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-red-400 mb-1">ไม่สามารถดึงข้อมูลจาก Stripe ได้</h3>
                <p className="text-[11px] text-gray-500 mb-4">{error}</p>
                <button onClick={fetchData} className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors">
                    ลองอีกครั้ง
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Period selector + Refresh */}
            <div className="flex items-center gap-2">
                <div className="flex bg-[#111] border border-white/5 rounded-xl overflow-hidden">
                    {PERIODS.map(p => (
                        <button
                            key={p.value}
                            onClick={() => setPeriod(p.value)}
                            className={`px-3 py-2 text-xs font-bold transition-colors ${
                                period === p.value
                                    ? 'bg-white/10 text-white'
                                    : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2 rounded-xl bg-[#111] border border-white/5 text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {loading && <span className="text-[10px] text-gray-600 ml-2">กำลังโหลด...</span>}
            </div>

            {loading && !data ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 text-gray-600 animate-spin" />
                </div>
            ) : data ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Total Revenue */}
                        <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10">
                                    <DollarSign className="w-4 h-4 text-emerald-400" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase">รายได้รวม</span>
                            </div>
                            <div className="text-xl font-black text-white tabular-nums">{formatTHB(data.revenue.total)}</div>
                            <div className="text-[10px] text-gray-600 mt-1">
                                ค่าธรรมเนียม {formatTHB(data.revenue.fees)}
                            </div>
                        </div>

                        {/* Net Revenue */}
                        <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 rounded-lg bg-blue-500/10">
                                    <TrendingUp className="w-4 h-4 text-blue-400" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase">รายได้สุทธิ</span>
                            </div>
                            <div className="text-xl font-black text-white tabular-nums">{formatTHB(data.revenue.net)}</div>
                            <div className="text-[10px] text-gray-600 mt-1">
                                หลังหักค่าธรรมเนียม Stripe
                            </div>
                        </div>

                        {/* Successful Charges */}
                        <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 rounded-lg bg-purple-500/10">
                                    <Receipt className="w-4 h-4 text-purple-400" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase">ธุรกรรมสำเร็จ</span>
                            </div>
                            <div className="text-xl font-black text-white tabular-nums">{data.charges.successful}</div>
                            <div className="text-[10px] text-gray-600 mt-1">
                                {data.charges.failed > 0 && <span className="text-red-400">{data.charges.failed} ล้มเหลว</span>}
                                {data.charges.failed === 0 && 'ไม่มีล้มเหลว'}
                            </div>
                        </div>

                        {/* Balance */}
                        <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="p-1.5 rounded-lg bg-yellow-500/10">
                                    <Banknote className="w-4 h-4 text-yellow-400" />
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase">ยอดคงเหลือ</span>
                            </div>
                            <div className="text-xl font-black text-white tabular-nums">
                                {data.balance.available.length > 0 ? formatTHB(data.balance.available[0].amount) : '฿0.00'}
                            </div>
                            <div className="text-[10px] text-gray-600 mt-1">
                                {data.balance.pending.length > 0 && data.balance.pending[0].amount > 0
                                    ? <span className="text-yellow-400">รอโอน {formatTHB(data.balance.pending[0].amount)}</span>
                                    : 'พร้อมถอน'
                                }
                            </div>
                        </div>
                    </div>

                    {/* Revenue Chart + Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Daily Revenue Chart */}
                        <div className="lg:col-span-2 bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                            <div className="p-5 border-b border-white/5">
                                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                                    รายได้รายวัน
                                </h3>
                            </div>
                            {dailyEntries.length > 0 ? (
                                <div className="p-5">
                                    <div className="flex items-end gap-1.5 h-40">
                                        {dailyEntries.map(([date, amount]) => {
                                            const height = Math.max((amount / maxDaily) * 100, 2);
                                            const day = new Date(date).getDate();
                                            const month = new Date(date).toLocaleString('th-TH', { month: 'short' });
                                            return (
                                                <div key={date} className="flex-1 flex flex-col items-center gap-1" title={`${date}: ${formatTHB(amount)}`}>
                                                    <div className="text-[8px] text-gray-600 tabular-nums">{amount > 0 ? formatTHB(amount) : ''}</div>
                                                    <div
                                                        className="w-full rounded-t-md bg-emerald-500/30 hover:bg-emerald-500/50 transition-colors cursor-default"
                                                        style={{ height: `${height}%`, minHeight: '2px' }}
                                                    />
                                                    <div className="text-[8px] text-gray-600 tabular-nums">{day}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-10 text-center text-gray-600">
                                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                    <p className="text-xs">ยังไม่มีข้อมูลรายได้ในช่วงนี้</p>
                                </div>
                            )}
                        </div>

                        {/* Revenue by Tier + Payment Methods */}
                        <div className="space-y-4">
                            {/* By Tier */}
                            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-white/5">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                                        <PieChart className="w-3.5 h-3.5 text-purple-400" />
                                        รายได้ตามแพลน
                                    </h3>
                                </div>
                                <div className="p-4 space-y-2">
                                    {Object.keys(data.revenueByTier).length > 0 ? (
                                        Object.entries(data.revenueByTier).map(([tier, info]) => (
                                            <div key={tier} className="flex items-center justify-between gap-2 p-2.5 bg-black/20 rounded-lg border border-white/5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${TIER_COLORS[tier] || TIER_COLORS.Unknown}`}>
                                                        {tier}
                                                    </span>
                                                    <span className="text-[10px] text-gray-500">{info.count} รายการ</span>
                                                </div>
                                                <span className="text-xs font-bold text-white tabular-nums">{formatTHB(info.amount)}</span>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[10px] text-gray-600 text-center py-2">ยังไม่มีข้อมูล</p>
                                    )}
                                </div>
                            </div>

                            {/* Payment Methods */}
                            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                                <div className="p-4 border-b border-white/5">
                                    <h3 className="text-xs font-bold text-white flex items-center gap-2">
                                        <CreditCard className="w-3.5 h-3.5 text-blue-400" />
                                        ช่องทางชำระเงิน
                                    </h3>
                                </div>
                                <div className="p-4 space-y-2">
                                    {Object.keys(data.paymentMethods).length > 0 ? (
                                        Object.entries(data.paymentMethods).map(([method, count]) => {
                                            const info = PAYMENT_METHOD_LABELS[method] || PAYMENT_METHOD_LABELS.unknown;
                                            const Icon = info.icon;
                                            const total = Object.values(data.paymentMethods).reduce((a, b) => a + b, 0);
                                            const pct = Math.round((count / total) * 100);
                                            return (
                                                <div key={method} className="flex items-center gap-2 p-2.5 bg-black/20 rounded-lg border border-white/5">
                                                    <Icon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                                    <span className="text-[10px] text-gray-300 flex-1">{info.label}</span>
                                                    <span className="text-[10px] text-gray-500">{count}</span>
                                                    <span className="text-[10px] font-bold text-white tabular-nums w-8 text-right">{pct}%</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-[10px] text-gray-600 text-center py-2">ยังไม่มีข้อมูล</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Recent Transactions */}
                    <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-white/5 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <Receipt className="w-4 h-4 text-cyan-400" />
                                ธุรกรรมล่าสุด
                            </h3>
                            <span className="text-[10px] text-gray-500">{data.recentTransactions.length} รายการ</span>
                        </div>
                        {data.recentTransactions.length > 0 ? (
                            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto">
                                {data.recentTransactions.map(tx => {
                                    const methodInfo = PAYMENT_METHOD_LABELS[tx.paymentMethod] || PAYMENT_METHOD_LABELS.unknown;
                                    const MethodIcon = methodInfo.icon;
                                    return (
                                        <div key={tx.id} className="px-5 py-3 flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                                                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold text-white tabular-nums">{formatTHB(tx.amount)}</span>
                                                    {tx.metadata?.tier && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${TIER_COLORS[tx.metadata.tier] || TIER_COLORS.Unknown}`}>
                                                            {tx.metadata.tier}
                                                        </span>
                                                    )}
                                                    {tx.metadata?.billing && (
                                                        <span className="text-[8px] text-gray-600">({tx.metadata.billing})</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <MethodIcon className="w-3 h-3 text-gray-600" />
                                                    <span className="text-[9px] text-gray-500">{methodInfo.label}</span>
                                                    {tx.metadata?.gangId && (
                                                        <span className="text-[9px] text-gray-600 font-mono">Gang: {tx.metadata.gangId.slice(0, 8)}...</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-[9px] text-gray-500 tabular-nums">{formatDate(tx.created)}</div>
                                                {tx.receiptUrl && (
                                                    <a href={tx.receiptUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 justify-end mt-0.5">
                                                        ใบเสร็จ <ExternalLink className="w-2.5 h-2.5" />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-10 text-center text-gray-600">
                                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-xs">ยังไม่มีธุรกรรมในช่วงนี้</p>
                            </div>
                        )}
                    </div>

                    {/* Stripe Dashboard Link */}
                    <div className="flex justify-center">
                        <a
                            href="https://dashboard.stripe.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2.5 bg-[#111] border border-white/5 rounded-xl text-xs text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            เปิด Stripe Dashboard เต็มรูปแบบ
                        </a>
                    </div>
                </>
            ) : null}
        </div>
    );
}
