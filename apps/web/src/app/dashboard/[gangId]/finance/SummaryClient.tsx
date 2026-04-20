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
    loanDebt: number;
    collectionDue: number;
    discordAvatar?: string | null;
}

interface Props {
    months: MonthData[];
    topMembers: MemberBalance[];
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

function getCashInflow(m: MonthData) {
    return m.income + m.repayment + m.deposit;
}

function MonthCard({ m, maxInflow }: { m: MonthData; maxInflow: number }) {
    const inflow = getCashInflow(m);
    const outflow = m.expense + m.loan;
    const net = inflow - outflow;
    const inflowPct = maxInflow > 0 ? (inflow / maxInflow) * 100 : 0;
    const outflowPct = maxInflow > 0 ? (outflow / maxInflow) * 100 : 0;

    const [year, month] = m.month.split('-');
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'long' });
    const yearStr = (parseInt(year) + 543).toString();

    return (
        <div className="group relative bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all duration-300 hover:bg-[#151515] shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h4 className="text-white font-semibold text-sm tracking-wide">{monthName}</h4>
                    <span className="text-[10px] text-zinc-500 font-mono tracking-wider">{yearStr}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold tabular-nums tracking-tight ${net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {net >= 0 ? '+' : ''}฿{formatMoney(net)}
                    </span>
                    <div className={`p-1.5 rounded-lg border ${net >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        {net >= 0
                            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                            : <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                        }
                    </div>
                </div>
            </div>

            {/* Visual Bars */}
            <div className="space-y-3 mb-5">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 w-10 shrink-0 text-right font-medium uppercase tracking-wider">เข้า</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-emerald-500/80 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(inflowPct, 2)}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-emerald-400 font-mono font-medium tabular-nums w-16 text-right tracking-tight">+฿{formatMoney(inflow)}</span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] text-zinc-500 w-10 shrink-0 text-right font-medium uppercase tracking-wider">ออก</span>
                    <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden border border-white/5">
                        <div
                            className="h-full bg-rose-500/80 rounded-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(outflowPct, outflow > 0 ? 2 : 0)}%` }}
                        />
                    </div>
                    <span className="text-[10px] text-rose-400 font-mono font-medium tabular-nums w-16 text-right tracking-tight">-฿{formatMoney(outflow)}</span>
                </div>
            </div>

            {/* Breakdown Pills */}
            <div className="flex flex-wrap gap-2">
                {m.income > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" /> รายรับ ฿{formatMoney(m.income)}
                    </span>
                )}
                {m.deposit > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                        <Wallet className="w-3 h-3 text-blue-400" /> นำเงินเข้า ฿{formatMoney(m.deposit)}
                    </span>
                )}
                {m.gangFee > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                        <Coins className="w-3 h-3 text-purple-400" /> ตั้งยอดเก็บเงิน ฿{formatMoney(m.gangFee)}
                    </span>
                )}
                {m.repayment > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                        ชำระหนี้ ฿{formatMoney(m.repayment)}
                    </span>
                )}
                {m.expense > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                        <ArrowDownLeft className="w-3 h-3 text-rose-400" /> จ่าย ฿{formatMoney(m.expense)}
                    </span>
                )}
                {m.loan > 0 && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-[10px] text-zinc-300 font-medium hover:bg-white/10 transition-colors">
                        ยืม ฿{formatMoney(m.loan)}
                    </span>
                )}
            </div>

            {/* Tx count badge */}
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[10px] text-zinc-500 bg-black/40 px-2 py-1 rounded-md border border-white/10 font-medium tracking-wide">{m.txCount} tx</span>
            </div>
        </div>
    );
}

export function SummaryClient({ months, topMembers, currentRange }: Props) {
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
            const inflow = getCashInflow(m);
            const outflow = m.expense + m.loan;
            const net = inflow - outflow;
            totalInflow += inflow;
            totalOutflow += outflow;
            totalTx += m.txCount;

            const [y, mo] = m.month.split('-');
            const mName = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', month: 'short' });
            if (net > bestMonth.net) bestMonth = { name: mName, net };
        }

        const totalNet = totalInflow - totalOutflow;
        const avgMonthly = months.length > 0 ? totalNet / months.length : 0;

        return { totalInflow, totalOutflow, totalNet, avgMonthly, totalTx, bestMonth };
    }, [months]);

    const maxInflow = useMemo(() => {
        let max = 0;
        for (const m of months) {
            const inflow = getCashInflow(m);
            if (inflow > max) max = inflow;
        }
        return max;
    }, [months]);

    const debtorsCount = topMembers.filter(d => d.loanDebt > 0 || d.collectionDue > 0 || d.balance < 0).length;
    const creditorsCount = topMembers.filter(d => d.balance > 0).length;

    const rangeSelector = (
        <div className="flex items-center gap-1.5 bg-[#111] border border-white/5 rounded-xl p-1 shadow-sm">
            {RANGE_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handleRangeChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 tracking-wide ${currentRange === opt.value
                        ? 'bg-[#222] text-white shadow-sm ring-1 ring-white/10'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
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
                        <Calendar className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-semibold text-white tracking-wide">ช่วงเวลา</span>
                    </div>
                    {rangeSelector}
                </div>
                <div className="flex flex-col items-center justify-center py-20 text-zinc-600 bg-[#0A0A0A] border border-white/5 rounded-2xl shadow-sm">
                    <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-medium tracking-wide">ยังไม่มีข้อมูลสำหรับสรุป</p>
                </div>
            </div>
        );
    }

    const rangeLabel = RANGE_OPTIONS.find(o => o.value === currentRange)?.label || '6 เดือน';

    return (
        <div className="animate-fade-in-up space-y-8">
            {/* Range Selector */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                        <Calendar className="w-4 h-4 text-zinc-400" />
                    </div>
                    <span className="text-sm font-semibold text-white tracking-wide">ภาพรวมการเงิน</span>
                    <span className="text-[10px] text-zinc-500 font-medium bg-black/50 px-2 py-1 rounded-md border border-white/5 uppercase tracking-wider">{rangeLabel}</span>
                </div>
                {rangeSelector}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Net */}
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${stats.totalNet >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`p-2 rounded-xl border ${stats.totalNet >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                                {stats.totalNet >= 0 ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">เงินสุทธิเข้า/ออกกองกลาง</span>
                        </div>
                        <div className={`text-2xl font-black tabular-nums tracking-tight ${stats.totalNet >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {stats.totalNet >= 0 ? '+' : ''}฿{formatMoney(stats.totalNet)}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-1.5 tracking-wide">{rangeLabel}ล่าสุด</div>
                    </div>
                </div>

                {/* Avg Monthly */}
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 bg-blue-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20">
                                <BarChart3 className="w-4 h-4 text-blue-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">เฉลี่ย/เดือน</span>
                        </div>
                        <div className={`text-2xl font-black tabular-nums tracking-tight ${stats.avgMonthly >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                            {stats.avgMonthly >= 0 ? '+' : ''}฿{formatMoney(Math.round(stats.avgMonthly))}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-1.5 tracking-wide">เงินเข้า/ออกกองกลางเฉลี่ย</div>
                    </div>
                </div>

                {/* Best Month */}
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 bg-amber-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <Crown className="w-4 h-4 text-amber-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">เดือนที่ดีสุด</span>
                        </div>
                        <div className="text-2xl font-black tabular-nums tracking-tight text-amber-400">
                            {stats.bestMonth.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-1.5 tracking-wide">+฿{formatMoney(Math.max(0, stats.bestMonth.net))}</div>
                    </div>
                </div>

                {/* Total Transactions */}
                <div className="relative bg-[#111] border border-white/5 rounded-2xl p-5 overflow-hidden shadow-sm hover:border-white/10 transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 bg-purple-500" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                                <Receipt className="w-4 h-4 text-purple-400" />
                            </div>
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest text-shadow-sm">รายการทั้งหมด</span>
                        </div>
                        <div className="text-2xl font-black tabular-nums tracking-tight text-white">
                            {stats.totalTx.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-zinc-500 font-medium mt-1.5 tracking-wide">transactions</div>
                    </div>
                </div>
            </div>

            {/* Inflow / Outflow Summary Bar */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-zinc-300 tracking-wide">วิเคราะห์เงินเข้า vs เงินออกกองกลาง</span>
                    <span className="text-[10px] font-medium text-zinc-500 bg-black/40 px-2 py-1 rounded-md border border-white/5">{rangeLabel}</span>
                </div>
                <div className="flex h-3.5 rounded-full overflow-hidden bg-black/50 border border-white/5 p-0.5">
                    {stats.totalInflow + stats.totalOutflow > 0 && (
                        <>
                            <div
                                className="h-full rounded-l-full bg-emerald-500/80 transition-all duration-1000"
                                style={{ width: `${(stats.totalInflow / (stats.totalInflow + stats.totalOutflow)) * 100}%` }}
                            />
                            <div
                                className="h-full rounded-r-full bg-rose-500/80 transition-all duration-1000"
                                style={{ width: `${(stats.totalOutflow / (stats.totalInflow + stats.totalOutflow)) * 100}%`, marginLeft: '2px' }}
                            />
                        </>
                    )}
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                        <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">เงินเข้า</span>
                        <span className="text-xs font-black text-emerald-400 tabular-nums tracking-tight bg-emerald-500/10 px-2 py-0.5 rounded-md text-shadow-sm border border-emerald-500/20">฿{stats.totalInflow.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-rose-400 tabular-nums tracking-tight bg-rose-500/10 px-2 py-0.5 rounded-md text-shadow-sm border border-rose-500/20">฿{stats.totalOutflow.toLocaleString()}</span>
                        <span className="text-[10px] text-zinc-400 font-medium uppercase tracking-widest">เงินออก</span>
                        <span className="w-2.5 h-2.5 rounded bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                    </div>
                </div>
                <p className="text-[10px] text-zinc-500 mt-4">หมายเหตุ: การตั้งยอดเก็บเงินแก๊งจะถูกนับเป็นยอดค้างของสมาชิก ไม่ถูกนับเป็นเงินเข้ากองกลางจนกว่าจะมีการชำระจริง</p>
            </div>

            {/* Monthly Cards Grid */}
            <div className="bg-[#0A0A0A] border border-white/5 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-3 mb-5 border-b border-white/5 pb-4">
                    <div className="p-2 rounded-lg bg-white/5 border border-white/5">
                        <BarChart3 className="w-4 h-4 text-zinc-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-white tracking-wide">สรุปรายเดือน</h3>
                    <span className="text-[10px] font-medium text-zinc-500 bg-white/5 px-2 py-1 rounded-md ml-auto tracking-wider">{months.length} เดือน</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {[...months].reverse().map((m) => (
                        <MonthCard key={m.month} m={m} maxInflow={maxInflow} />
                    ))}
                </div>
            </div>

            {/* Member Balances */}
            {topMembers.length > 0 && (
                <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden shadow-sm">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#151515]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Users className="w-4 h-4 text-blue-400" />
                            </div>
                            <h3 className="text-sm font-semibold text-white tracking-wide">สถานะการเงินสมาชิก</h3>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-medium tracking-wide">
                            {debtorsCount > 0 && (
                                <span className="flex items-center gap-1.5 text-rose-400 bg-rose-500/10 px-2.5 py-1 rounded-md border border-rose-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_4px_rgba(244,63,94,0.6)]" />
                                    ค้างชำระ {debtorsCount}
                                </span>
                            )}
                            {creditorsCount > 0 && (
                                <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
                                    มีเครดิต {creditorsCount}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto custom-scrollbar">
                        {topMembers.map((d, i) => {
                            const totalOutstanding = (Number(d.loanDebt) || 0) + (Number(d.collectionDue) || 0);
                            const isDebt = totalOutstanding > 0 || d.balance < 0;
                            const emphasisValue = isDebt ? totalOutstanding || Math.abs(d.balance) : Math.abs(d.balance);
                            const maxBal = Math.max(...topMembers.map(x => Math.max(Math.abs(x.balance), (Number(x.loanDebt) || 0) + (Number(x.collectionDue) || 0))), 1);
                            const barPct = maxBal > 0 ? (emphasisValue / maxBal) * 100 : 0;
                            return (
                                <div key={d.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#1a1a1a] transition-colors group">
                                    <span className="text-zinc-600 font-mono text-[10px] w-5 text-right shrink-0">{i + 1}</span>
                                    <div className="relative">
                                        <img
                                            src={d.discordAvatar || '/avatars/0.png'}
                                            alt={d.name}
                                            className="w-8 h-8 rounded-full ring-2 ring-white/5 shrink-0 group-hover:ring-white/10 transition-all"
                                        />
                                    </div>
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-xs font-semibold text-zinc-200 truncate group-hover:text-white transition-colors tracking-wide">{d.name}</span>
                                            <span className={`text-xs font-bold tabular-nums shrink-0 ml-3 tracking-tight ${isDebt ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {isDebt ? '' : '+'}฿{(isDebt ? emphasisValue : d.balance).toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5 text-[10px] text-zinc-500">
                                            {d.loanDebt > 0 && (
                                                <span>หนี้ยืม ฿{d.loanDebt.toLocaleString()}</span>
                                            )}
                                            {d.collectionDue > 0 && (
                                                <span>ค้างเก็บเงิน ฿{d.collectionDue.toLocaleString()}</span>
                                            )}
                                            {d.balance > 0 && (
                                                <span>เครดิตคงเหลือ +฿{d.balance.toLocaleString()}</span>
                                            )}
                                            {d.balance === 0 && totalOutstanding === 0 && (
                                                <span>ไม่มีหนี้หรือเครดิตคงเหลือ</span>
                                            )}
                                        </div>
                                        <div className="h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${isDebt ? 'bg-rose-500/80 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-emerald-500/80 shadow-[0_0_8px_rgba(16,185,129,0.4)]'}`}
                                                style={{ width: `${Math.max(barPct, 2)}%` }}
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
