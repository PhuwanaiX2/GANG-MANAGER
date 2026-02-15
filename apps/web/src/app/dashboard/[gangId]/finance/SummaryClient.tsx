'use client';

import { useMemo } from 'react';
import { useSearchParams, usePathname, useRouter } from 'next/navigation';
import {
    TrendingUp,
    TrendingDown,
    BarChart3,
    Users,
    ArrowUpRight,
    ArrowDownLeft,
    Coins,
    Receipt,
    Wallet,
    Crown,
    Calendar,
} from 'lucide-react';

interface MonthData {
    month: string;
    income: number;
    expense: number;
    loan: number;
    repayment: number;
    penalty: number;
    deposit: number;
    gangFee: number;
    txCount: number;
}

interface MemberBalance {
    id: string;
    name: string;
    balance: number;
    discordAvatar?: string | null;
}

interface Props {
    months: MonthData[];
    topDebtors: MemberBalance[];
    currentRange: string;
}

const RANGE_OPTIONS = [
    { value: '3', label: '3 เดือน' },
    { value: '6', label: '6 เดือน' },
    { value: '12', label: '12 เดือน' },
    { value: 'all', label: 'ทั้งหมด' },
];

function formatMoney(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function MonthCard({ m, maxInflow }: { m: MonthData; maxInflow: number }) {
    const inflow = m.income + m.repayment + m.deposit + m.gangFee;
    const outflow = m.expense + m.loan;
    const net = inflow - outflow;
    const inflowPct = maxInflow > 0 ? (inflow / maxInflow) * 100 : 0;
    const outflowPct = maxInflow > 0 ? (outflow / maxInflow) * 100 : 0;

    const [year, month] = m.month.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('th-TH', { month: 'long' });
    const yearStr = (parseInt(year) + 543).toString();

    return (
        <div className="group relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 hover:bg-white/[0.03]">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h4 className="text-white font-bold text-sm">{monthName}</h4>
                    <span className="text-[10px] text-gray-600 font-mono">{yearStr}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-black tabular-nums ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {net >= 0 ? '+' : ''}฿{formatMoney(net)}
                    </span>
                    <div className={`p-1 rounded-md ${net >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                        {net >= 0
                            ? <TrendingUp className="w-3 h-3 text-emerald-400" />
                            : <TrendingDown className="w-3 h-3 text-red-400" />
                        }
                    </div>
                </div>
            </div>

            {/* Visual Bars */}
            <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 w-8 shrink-0 text-right">เข้า</span>
                    <div className="flex-1 h-2.5 bg-white/[0.03] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(inflowPct, 2)}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono tabular-nums w-16 text-right">+฿{formatMoney(inflow)}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-500 w-8 shrink-0 text-right">ออก</span>
                    <div className="flex-1 h-2.5 bg-white/[0.03] rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(outflowPct, outflow > 0 ? 2 : 0)}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-red-400 font-mono tabular-nums w-16 text-right">-฿{formatMoney(outflow)}</span>
                </div>
            </div>

            {/* Breakdown Pills */}
            <div className="flex flex-wrap gap-1.5">
                {m.income > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/5 border border-emerald-500/10 text-[9px] text-emerald-400 font-medium">
                        <ArrowUpRight className="w-2.5 h-2.5" /> รายรับ ฿{formatMoney(m.income)}
                    </span>
                )}
                {m.deposit > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/5 border border-blue-500/10 text-[9px] text-blue-400 font-medium">
                        <Wallet className="w-2.5 h-2.5" /> ฝาก ฿{formatMoney(m.deposit)}
                    </span>
                )}
                {m.gangFee > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/5 border border-purple-500/10 text-[9px] text-purple-400 font-medium">
                        <Coins className="w-2.5 h-2.5" /> เก็บเงิน ฿{formatMoney(m.gangFee)}
                    </span>
                )}
                {m.repayment > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/5 border border-cyan-500/10 text-[9px] text-cyan-400 font-medium">
                        คืน ฿{formatMoney(m.repayment)}
                    </span>
                )}
                {m.expense > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/5 border border-red-500/10 text-[9px] text-red-400 font-medium">
                        <ArrowDownLeft className="w-2.5 h-2.5" /> จ่าย ฿{formatMoney(m.expense)}
                    </span>
                )}
                {m.loan > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-500/5 border border-yellow-500/10 text-[9px] text-yellow-400 font-medium">
                        ยืม ฿{formatMoney(m.loan)}
                    </span>
                )}
            </div>

            {/* Tx count badge */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] text-gray-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/5">{m.txCount} tx</span>
            </div>
        </div>
    );
}

export function SummaryClient({ months, topDebtors, currentRange }: Props) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleRangeChange = (range: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set('tab', 'summary');
        if (range === '6') {
            params.delete('range');
        } else {
            params.set('range', range);
        }
        router.push(`${pathname}?${params.toString()}`);
    };

    const stats = useMemo(() => {
        if (months.length === 0) return null;

        let totalInflow = 0;
        let totalOutflow = 0;
        let totalTx = 0;
        let bestMonth = { name: '', net: -Infinity };

        for (const m of months) {
            const inflow = m.income + m.repayment + m.deposit + m.gangFee;
            const outflow = m.expense + m.loan;
            const net = inflow - outflow;
            totalInflow += inflow;
            totalOutflow += outflow;
            totalTx += m.txCount;

            const [y, mo] = m.month.split('-');
            const mName = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('th-TH', { month: 'short' });
            if (net > bestMonth.net) bestMonth = { name: mName, net };
        }

        const totalNet = totalInflow - totalOutflow;
        const avgMonthly = months.length > 0 ? totalNet / months.length : 0;

        return { totalInflow, totalOutflow, totalNet, avgMonthly, totalTx, bestMonth };
    }, [months]);

    const maxInflow = useMemo(() => {
        let max = 0;
        for (const m of months) {
            const inflow = m.income + m.repayment + m.deposit + m.gangFee;
            if (inflow > max) max = inflow;
        }
        return max;
    }, [months]);

    const debtorsCount = topDebtors.filter(d => d.balance < 0).length;
    const creditorsCount = topDebtors.filter(d => d.balance > 0).length;

    const rangeSelector = (
        <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 rounded-xl p-1">
            {RANGE_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handleRangeChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 ${
                        currentRange === opt.value
                            ? 'bg-white/10 text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );

    if (!stats) {
        return (
            <div className="animate-fade-in-up">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-bold text-white">ช่วงเวลา</span>
                    </div>
                    {rangeSelector}
                </div>
                <div className="flex flex-col items-center justify-center py-20 text-gray-600">
                    <BarChart3 className="w-12 h-12 mb-3 opacity-20" />
                    <p className="text-sm">ยังไม่มีข้อมูลสำหรับสรุป</p>
                </div>
            </div>
        );
    }

    const rangeLabel = RANGE_OPTIONS.find(o => o.value === currentRange)?.label || '6 เดือน';

    return (
        <div className="animate-fade-in-up space-y-8">
            {/* Range Selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-bold text-white">ช่วงเวลา</span>
                    <span className="text-[10px] text-gray-600 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">{rangeLabel}</span>
                </div>
                {rangeSelector}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Net */}
                <div className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 overflow-hidden">
                    <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl ${stats.totalNet >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`} />
                    <div className="relative">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className={`p-1.5 rounded-lg ${stats.totalNet >= 0 ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
                                {stats.totalNet >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">กำไร/ขาดทุน</span>
                        </div>
                        <div className={`text-2xl font-black tabular-nums tracking-tight ${stats.totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {stats.totalNet >= 0 ? '+' : ''}฿{formatMoney(stats.totalNet)}
                        </div>
                        <div className="text-[9px] text-gray-600 mt-1">{rangeLabel}ล่าสุด</div>
                    </div>
                </div>

                {/* Avg Monthly */}
                <div className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl bg-blue-500/10" />
                    <div className="relative">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="p-1.5 rounded-lg bg-blue-500/10">
                                <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">เฉลี่ย/เดือน</span>
                        </div>
                        <div className={`text-2xl font-black tabular-nums tracking-tight ${stats.avgMonthly >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                            {stats.avgMonthly >= 0 ? '+' : ''}฿{formatMoney(Math.round(stats.avgMonthly))}
                        </div>
                        <div className="text-[9px] text-gray-600 mt-1">net flow เฉลี่ย</div>
                    </div>
                </div>

                {/* Best Month */}
                <div className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl bg-yellow-500/10" />
                    <div className="relative">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="p-1.5 rounded-lg bg-yellow-500/10">
                                <Crown className="w-3.5 h-3.5 text-yellow-400" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">เดือนที่ดีสุด</span>
                        </div>
                        <div className="text-2xl font-black tabular-nums tracking-tight text-yellow-400">
                            {stats.bestMonth.name}
                        </div>
                        <div className="text-[9px] text-gray-600 mt-1">+฿{formatMoney(Math.max(0, stats.bestMonth.net))}</div>
                    </div>
                </div>

                {/* Total Transactions */}
                <div className="relative bg-white/[0.02] border border-white/5 rounded-2xl p-5 overflow-hidden">
                    <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl bg-purple-500/10" />
                    <div className="relative">
                        <div className="flex items-center gap-1.5 mb-2">
                            <div className="p-1.5 rounded-lg bg-purple-500/10">
                                <Receipt className="w-3.5 h-3.5 text-purple-400" />
                            </div>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">รายการทั้งหมด</span>
                        </div>
                        <div className="text-2xl font-black tabular-nums tracking-tight text-white">
                            {stats.totalTx.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-gray-600 mt-1">transactions</div>
                    </div>
                </div>
            </div>

            {/* Inflow / Outflow Summary Bar */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-gray-400">รายรับ vs รายจ่ายรวม</span>
                    <span className="text-[10px] text-gray-600">{rangeLabel}</span>
                </div>
                <div className="flex h-4 rounded-full overflow-hidden bg-white/[0.03]">
                    {stats.totalInflow + stats.totalOutflow > 0 && (
                        <>
                            <div
                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-1000"
                                style={{ width: `${(stats.totalInflow / (stats.totalInflow + stats.totalOutflow)) * 100}%` }}
                            />
                            <div
                                className="h-full bg-gradient-to-r from-red-500 to-red-400 transition-all duration-1000"
                                style={{ width: `${(stats.totalOutflow / (stats.totalInflow + stats.totalOutflow)) * 100}%` }}
                            />
                        </>
                    )}
                </div>
                <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-[10px] text-gray-400">รายรับ</span>
                        <span className="text-xs font-bold text-emerald-400 tabular-nums">฿{stats.totalInflow.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-red-400 tabular-nums">฿{stats.totalOutflow.toLocaleString()}</span>
                        <span className="text-[10px] text-gray-400">รายจ่าย</span>
                        <span className="w-2 h-2 rounded-full bg-red-400" />
                    </div>
                </div>
            </div>

            {/* Monthly Cards Grid */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-gray-500" />
                    <h3 className="text-sm font-bold text-white">รายเดือน</h3>
                    <span className="text-[10px] text-gray-600 ml-auto">{months.length} เดือน</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {[...months].reverse().map((m) => (
                        <MonthCard key={m.month} m={m} maxInflow={maxInflow} />
                    ))}
                </div>
            </div>

            {/* Member Balances */}
            {topDebtors.length > 0 && (
                <div className="bg-[#131313] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-400" />
                            <h3 className="text-sm font-bold text-white">สถานะการเงินสมาชิก</h3>
                        </div>
                        <div className="flex items-center gap-3 text-[10px]">
                            {debtorsCount > 0 && (
                                <span className="flex items-center gap-1 text-red-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                    ติดหนี้ {debtorsCount}
                                </span>
                            )}
                            {creditorsCount > 0 && (
                                <span className="flex items-center gap-1 text-emerald-400">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                    เงินเหลือ {creditorsCount}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="divide-y divide-white/[0.03] max-h-[420px] overflow-y-auto">
                        {topDebtors.map((d, i) => {
                            const isDebt = d.balance < 0;
                            const maxBal = Math.max(...topDebtors.map(x => Math.abs(x.balance)));
                            const barPct = maxBal > 0 ? (Math.abs(d.balance) / maxBal) * 100 : 0;
                            return (
                                <div key={d.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                                    <span className="text-gray-700 font-mono text-[10px] w-5 text-right shrink-0">{i + 1}</span>
                                    <img
                                        src={d.discordAvatar || '/avatars/0.png'}
                                        alt={d.name}
                                        className="w-7 h-7 rounded-full border border-white/10 shrink-0"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-xs font-medium text-white truncate">{d.name}</span>
                                            <span className={`text-xs font-black tabular-nums shrink-0 ml-2 ${isDebt ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {isDebt ? '' : '+'}฿{d.balance.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-1 bg-white/[0.03] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isDebt ? 'bg-red-500/60' : 'bg-emerald-500/60'}`}
                                                style={{ width: `${Math.max(barPct, 3)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
