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
        <tr className="hover:bg-bg-muted transition-colors">
            {/* Header */}
            <td className="px-4 py-3 align-middle">
                <div className="font-semibold text-sm text-fg-primary tracking-wide">{monthName}</div>
                <div className="text-[10px] text-fg-tertiary font-mono tracking-wider">{yearStr}</div>
            </td>
            <td className="px-4 py-3 align-middle text-right">
                <span className={`inline-flex items-center gap-1.5 rounded-token-md border px-2.5 py-1 text-xs font-bold tabular-nums ${net >= 0 ? 'bg-status-success-subtle border-status-success text-fg-success' : 'bg-status-danger-subtle border-status-danger text-fg-danger'}`}>
                    {net >= 0
                        ? <TrendingUp className="w-3.5 h-3.5" />
                        : <TrendingDown className="w-3.5 h-3.5" />
                    }
                    {net >= 0 ? '+' : ''}฿{formatMoney(net)}
                </span>
            </td>

            {/* Visual Bars */}
            <td className="px-4 py-3 align-middle">
                <div className="flex items-center gap-3">
                    <div className="h-2.5 w-28 rounded-token-full bg-bg-muted border border-border-subtle overflow-hidden">
                        <div
                            className="h-full bg-status-success rounded-token-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(inflowPct, 2)}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-fg-success tabular-nums whitespace-nowrap">+฿{formatMoney(inflow)}</span>
                </div>
            </td>
            <td className="px-4 py-3 align-middle">
                <div className="flex items-center gap-3">
                    <div className="h-2.5 w-28 rounded-token-full bg-bg-muted border border-border-subtle overflow-hidden">
                        <div
                            className="h-full bg-status-danger rounded-token-full transition-all duration-700 ease-out"
                            style={{ width: `${Math.max(outflowPct, outflow > 0 ? 2 : 0)}%` }}
                        />
                    </div>
                    <span className="text-xs font-semibold text-fg-danger tabular-nums whitespace-nowrap">-฿{formatMoney(outflow)}</span>
                </div>
            </td>

            {/* Breakdown Pills */}
            <td className="px-4 py-3 align-middle">
                <div className="flex flex-wrap gap-1.5">
                    {m.income > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-token-md bg-bg-muted border border-border-subtle text-[10px] text-fg-secondary font-medium">
                            <ArrowUpRight className="w-3 h-3 text-fg-success" /> รายรับ ฿{formatMoney(m.income)}
                        </span>
                    )}
                    {m.deposit > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-token-md bg-bg-muted border border-border-subtle text-[10px] text-fg-secondary font-medium">
                            <Wallet className="w-3 h-3 text-fg-info" /> เก็บเงิน/เครดิต ฿{formatMoney(m.deposit)}
                        </span>
                    )}
                    {m.gangFee > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-token-md bg-bg-muted border border-border-subtle text-[10px] text-fg-secondary font-medium">
                            <Coins className="w-3 h-3 text-accent-bright" /> ตั้งยอดเก็บเงิน ฿{formatMoney(m.gangFee)}
                        </span>
                    )}
                    {m.repayment > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-token-md bg-bg-muted border border-border-subtle text-[10px] text-fg-secondary font-medium">
                            ชำระหนี้ยืม ฿{formatMoney(m.repayment)}
                        </span>
                    )}
                    {m.expense > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-token-md bg-bg-muted border border-border-subtle text-[10px] text-fg-secondary font-medium">
                            <ArrowDownLeft className="w-3 h-3 text-fg-danger" /> จ่าย ฿{formatMoney(m.expense)}
                        </span>
                    )}
                    {m.loan > 0 && (
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-token-md bg-bg-muted border border-border-subtle text-[10px] text-fg-secondary font-medium">
                            ยืม ฿{formatMoney(m.loan)}
                        </span>
                    )}
                </div>
            </td>

            {/* Tx count badge */}
            <td className="px-4 py-3 align-middle text-right text-xs font-bold text-fg-secondary tabular-nums">{m.txCount}</td>
        </tr>
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
        <div className="flex items-center gap-1.5 bg-bg-subtle border border-border-subtle rounded-token-xl p-1 shadow-token-sm">
            {RANGE_OPTIONS.map((opt) => (
                <button
                    key={opt.value}
                    onClick={() => handleRangeChange(opt.value)}
                    className={`px-3 py-1.5 rounded-token-lg text-xs font-semibold transition-all duration-200 tracking-wide ${currentRange === opt.value
                        ? 'bg-bg-elevated text-fg-primary shadow-token-sm ring-1 ring-border'
                        : 'text-fg-tertiary hover:text-fg-secondary hover:bg-bg-muted'
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
                        <Calendar className="w-4 h-4 text-fg-tertiary" />
                        <span className="text-sm font-semibold text-fg-primary tracking-wide">ช่วงเวลา</span>
                    </div>
                    {rangeSelector}
                </div>
                <div className="flex flex-col items-center justify-center py-20 text-fg-tertiary bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-sm">
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
                    <div className="p-2 rounded-token-lg bg-bg-subtle border border-border-subtle">
                        <Calendar className="w-4 h-4 text-fg-tertiary" />
                    </div>
                    <span className="text-sm font-semibold text-fg-primary tracking-wide">ภาพรวมการเงิน</span>
                    <span className="text-[10px] text-fg-tertiary font-medium bg-bg-muted px-2 py-1 rounded-token-md border border-border-subtle uppercase tracking-wider">{rangeLabel}</span>
                </div>
                {rangeSelector}
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Net */}
                <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors">
                    <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-token-full blur-3xl opacity-20 ${stats.totalNet >= 0 ? 'bg-status-success' : 'bg-status-danger'}`} />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className={`p-2 rounded-token-xl border ${stats.totalNet >= 0 ? 'bg-status-success-subtle border-status-success' : 'bg-status-danger-subtle border-status-danger'}`}>
                                {stats.totalNet >= 0 ? <TrendingUp className="w-4 h-4 text-fg-success" /> : <TrendingDown className="w-4 h-4 text-fg-danger" />}
                            </div>
                            <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">เงินสุทธิเข้า/ออกกองกลาง</span>
                        </div>
                        <div className={`text-2xl font-black tabular-nums tracking-tight ${stats.totalNet >= 0 ? 'text-fg-success' : 'text-fg-danger'}`}>
                            {stats.totalNet >= 0 ? '+' : ''}฿{formatMoney(stats.totalNet)}
                        </div>
                        <div className="text-[10px] text-fg-tertiary font-medium mt-1.5 tracking-wide">{rangeLabel}ล่าสุด</div>
                    </div>
                </div>

                {/* Avg Monthly */}
                <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-token-full blur-3xl opacity-20 bg-status-info" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-token-xl bg-status-info-subtle border border-status-info">
                                <BarChart3 className="w-4 h-4 text-fg-info" />
                            </div>
                            <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">เฉลี่ย/เดือน</span>
                        </div>
                        <div className={`text-2xl font-black tabular-nums tracking-tight ${stats.avgMonthly >= 0 ? 'text-fg-info' : 'text-fg-danger'}`}>
                            {stats.avgMonthly >= 0 ? '+' : ''}฿{formatMoney(Math.round(stats.avgMonthly))}
                        </div>
                        <div className="text-[10px] text-fg-tertiary font-medium mt-1.5 tracking-wide">เงินเข้า/ออกกองกลางเฉลี่ย</div>
                    </div>
                </div>

                {/* Best Month */}
                <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-token-full blur-3xl opacity-20 bg-status-warning" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-token-xl bg-status-warning-subtle border border-status-warning">
                                <Crown className="w-4 h-4 text-fg-warning" />
                            </div>
                            <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">เดือนที่ดีสุด</span>
                        </div>
                        <div className="text-2xl font-black tabular-nums tracking-tight text-fg-warning">
                            {stats.bestMonth.name}
                        </div>
                        <div className="text-[10px] text-fg-tertiary font-medium mt-1.5 tracking-wide">+฿{formatMoney(Math.max(0, stats.bestMonth.net))}</div>
                    </div>
                </div>

                {/* Total Transactions */}
                <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors">
                    <div className="absolute -top-12 -right-12 w-32 h-32 rounded-token-full blur-3xl opacity-20 bg-accent" />
                    <div className="relative">
                        <div className="flex items-center gap-2 mb-3">
                            <div className="p-2 rounded-token-xl bg-accent-subtle border border-border-accent">
                                <Receipt className="w-4 h-4 text-accent-bright" />
                            </div>
                            <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">รายการทั้งหมด</span>
                        </div>
                        <div className="text-2xl font-black tabular-nums tracking-tight text-fg-primary">
                            {stats.totalTx.toLocaleString()}
                        </div>
                        <div className="text-[10px] text-fg-tertiary font-medium mt-1.5 tracking-wide">transactions</div>
                    </div>
                </div>
            </div>

            {/* Inflow / Outflow Summary Bar */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-semibold text-fg-secondary tracking-wide">วิเคราะห์เงินเข้า vs เงินออกกองกลาง</span>
                    <span className="text-[10px] font-medium text-fg-tertiary bg-bg-muted px-2 py-1 rounded-token-md border border-border-subtle">{rangeLabel}</span>
                </div>
                <div className="flex h-3.5 rounded-token-full overflow-hidden bg-bg-muted border border-border-subtle p-0.5">
                    {stats.totalInflow + stats.totalOutflow > 0 && (
                        <>
                            <div
                                className="h-full rounded-l-token-full bg-status-success transition-all duration-1000"
                                style={{ width: `${(stats.totalInflow / (stats.totalInflow + stats.totalOutflow)) * 100}%` }}
                            />
                            <div
                                className="h-full rounded-r-token-full bg-status-danger transition-all duration-1000"
                                style={{ width: `${(stats.totalOutflow / (stats.totalInflow + stats.totalOutflow)) * 100}%`, marginLeft: '2px' }}
                            />
                        </>
                    )}
                </div>
                <div className="flex items-center justify-between mt-3 px-1">
                    <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-token-sm bg-status-success shadow-[0_0_8px_var(--color-success)]" />
                        <span className="text-[10px] text-fg-secondary font-medium uppercase tracking-widest">เงินเข้า</span>
                        <span className="text-xs font-black text-fg-success tabular-nums tracking-tight bg-status-success-subtle px-2 py-0.5 rounded-token-md text-shadow-sm border border-status-success">฿{stats.totalInflow.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-fg-danger tabular-nums tracking-tight bg-status-danger-subtle px-2 py-0.5 rounded-token-md text-shadow-sm border border-status-danger">฿{stats.totalOutflow.toLocaleString()}</span>
                        <span className="text-[10px] text-fg-secondary font-medium uppercase tracking-widest">เงินออก</span>
                        <span className="w-2.5 h-2.5 rounded-token-sm bg-status-danger shadow-[0_0_8px_var(--color-danger)]" />
                    </div>
                </div>
                <p className="text-[10px] text-fg-tertiary mt-4">หมายเหตุ: การตั้งยอดเก็บเงินแก๊งจะถูกนับเป็นยอดค้างของสมาชิก ไม่ถูกนับเป็นเงินเข้ากองกลางจนกว่าจะมีการชำระจริง</p>
            </div>

            {/* Monthly Cards Grid */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                <div className="flex items-center gap-3 mb-5 border-b border-border-subtle pb-4">
                    <div className="p-2 rounded-token-lg bg-bg-muted border border-border-subtle">
                        <BarChart3 className="w-4 h-4 text-fg-tertiary" />
                    </div>
                    <h3 className="text-sm font-semibold text-fg-primary tracking-wide">สรุปรายเดือน</h3>
                    <span className="text-[10px] font-medium text-fg-tertiary bg-bg-muted px-2 py-1 rounded-token-md ml-auto tracking-wider">{months.length} เดือน</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-[980px] w-full text-left">
                        <thead className="bg-bg-muted border-b border-border-subtle">
                            <tr>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เดือน</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">สุทธิ</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เงินเข้า</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เงินออก</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายละเอียด</th>
                                <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Tx</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {[...months].reverse().map((m) => (
                                <MonthCard key={m.month} m={m} maxInflow={maxInflow} />
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Member Balances */}
            {topMembers.length > 0 && (
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-bg-muted">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-token-lg bg-status-info-subtle border border-status-info">
                                <Users className="w-4 h-4 text-fg-info" />
                            </div>
                            <h3 className="text-sm font-semibold text-fg-primary tracking-wide">สถานะการเงินสมาชิก</h3>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] font-medium tracking-wide">
                            {debtorsCount > 0 && (
                                <span className="flex items-center gap-1.5 text-fg-danger bg-status-danger-subtle px-2.5 py-1 rounded-token-md border border-status-danger">
                                    <span className="w-1.5 h-1.5 rounded-token-full bg-status-danger shadow-[0_0_4px_var(--color-danger)]" />
                                    ค้างชำระ {debtorsCount}
                                </span>
                            )}
                            {creditorsCount > 0 && (
                                <span className="flex items-center gap-1.5 text-fg-success bg-status-success-subtle px-2.5 py-1 rounded-token-md border border-status-success">
                                    <span className="w-1.5 h-1.5 rounded-token-full bg-status-success shadow-[0_0_4px_var(--color-success)]" />
                                    มีเครดิต {creditorsCount}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="max-h-[420px] overflow-auto custom-scrollbar">
                        <table className="min-w-[780px] w-full text-left">
                            <thead className="sticky top-0 z-10 bg-bg-muted border-b border-border-subtle">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right w-12">#</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สมาชิก</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">หนี้ยืม</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ค้างเก็บ</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">เครดิต</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">สถานะรวม</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {topMembers.map((d, i) => {
                                    const totalOutstanding = (Number(d.loanDebt) || 0) + (Number(d.collectionDue) || 0);
                                    const isDebt = totalOutstanding > 0 || d.balance < 0;
                                    const emphasisValue = isDebt ? totalOutstanding || Math.abs(d.balance) : Math.abs(d.balance);
                                    const maxBal = Math.max(...topMembers.map(x => Math.max(Math.abs(x.balance), (Number(x.loanDebt) || 0) + (Number(x.collectionDue) || 0))), 1);
                                    const barPct = maxBal > 0 ? (emphasisValue / maxBal) * 100 : 0;
                                    return (
                                        <tr key={d.id} className="hover:bg-bg-muted transition-colors group">
                                            <td className="px-4 py-3 text-right text-fg-tertiary font-mono text-[10px]">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img
                                                        src={d.discordAvatar || '/avatars/0.png'}
                                                        alt={d.name}
                                                        className="w-8 h-8 rounded-token-full ring-2 ring-border-subtle shrink-0 group-hover:ring-border transition-all"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-semibold text-fg-primary truncate group-hover:text-accent-bright transition-colors tracking-wide">{d.name}</div>
                                                        <div className="mt-1 h-1.5 w-32 bg-bg-muted rounded-token-full overflow-hidden border border-border-subtle">
                                                            <div
                                                                className={`h-full rounded-token-full transition-all duration-500 ${isDebt ? 'bg-status-danger shadow-[0_0_8px_var(--color-danger)]' : 'bg-status-success shadow-[0_0_8px_var(--color-success)]'}`}
                                                                style={{ width: `${Math.max(barPct, 2)}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-bold tabular-nums ${d.loanDebt > 0 ? 'text-fg-danger' : 'text-fg-tertiary'}`}>
                                                    {d.loanDebt > 0 ? `฿${d.loanDebt.toLocaleString()}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-bold tabular-nums ${d.collectionDue > 0 ? 'text-fg-danger' : 'text-fg-tertiary'}`}>
                                                    {d.collectionDue > 0 ? `฿${d.collectionDue.toLocaleString()}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`text-xs font-bold tabular-nums ${d.balance > 0 ? 'text-fg-success' : 'text-fg-tertiary'}`}>
                                                    {d.balance > 0 ? `+฿${d.balance.toLocaleString()}` : '-'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <span className={`inline-flex rounded-token-md border px-2.5 py-1 text-xs font-bold tabular-nums tracking-tight ${isDebt ? 'bg-status-danger-subtle text-fg-danger border-status-danger' : 'bg-status-success-subtle text-fg-success border-status-success'}`}>
                                                    {isDebt ? '' : '+'}฿{(isDebt ? emphasisValue : d.balance).toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
