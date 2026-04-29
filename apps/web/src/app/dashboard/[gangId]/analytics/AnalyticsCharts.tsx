'use client';

import { useMemo } from 'react';
import {
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownLeft,
    BarChart3,
    PieChart,
    CalendarCheck,
    Users,
    Coins,
    Receipt,
    Wallet,
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

interface AttendanceStat {
    sessionName: string;
    sessionDate: string;
    present: number;
    absent: number;
    leave: number;
    total: number;
}

interface TransactionBreakdown {
    type: string;
    label: string;
    total: number;
    count: number;
}

interface Props {
    months: MonthData[];
    attendanceStats: AttendanceStat[];
    transactionBreakdown: TransactionBreakdown[];
}

function formatMoney(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 100_000) return `${(n / 1_000).toFixed(0)}K`;
    if (n >= 10_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
}

function formatMonthLabel(monthStr: string): string {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok',  month: 'short' });
}

const TYPE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
    INCOME: { bg: 'bg-status-success-subtle', text: 'text-fg-success', bar: 'bg-status-success' },
    EXPENSE: { bg: 'bg-status-danger-subtle', text: 'text-fg-danger', bar: 'bg-status-danger' },
    LOAN: { bg: 'bg-status-warning-subtle', text: 'text-fg-warning', bar: 'bg-status-warning' },
    REPAYMENT: { bg: 'bg-status-info-subtle', text: 'text-fg-info', bar: 'bg-status-info' },
    DEPOSIT: { bg: 'bg-status-info-subtle', text: 'text-fg-info', bar: 'bg-status-info' },
    PENALTY: { bg: 'bg-status-warning-subtle', text: 'text-fg-warning', bar: 'bg-status-warning' },
    GANG_FEE: { bg: 'bg-accent-subtle', text: 'text-accent-bright', bar: 'bg-accent' },
};

export function AnalyticsCharts({ months, attendanceStats, transactionBreakdown }: Props) {
    // ========== FINANCIAL CHART DATA ==========
    const financeChart = useMemo(() => {
        if (months.length === 0) return null;

        const data = months.map(m => {
            const inflow = m.income + m.repayment + m.deposit;
            const outflow = m.expense + m.loan;
            const net = inflow - outflow;
            return { ...m, inflow, outflow, net, due: m.gangFee };
        });

        const maxValue = Math.max(...data.map(d => Math.max(d.inflow, d.outflow)), 1);
        return { data, maxValue };
    }, [months]);

    // ========== ATTENDANCE CHART DATA ==========
    const attendanceChart = useMemo(() => {
        if (attendanceStats.length === 0) return null;
        const reversed = [...attendanceStats].reverse(); // chronological
        return reversed;
    }, [attendanceStats]);

    // ========== TRANSACTION BREAKDOWN ==========
    const breakdownData = useMemo(() => {
        if (transactionBreakdown.length === 0) return null;
        const totalAmount = transactionBreakdown.reduce((sum, t) => sum + t.total, 0);
        return { items: transactionBreakdown, totalAmount };
    }, [transactionBreakdown]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* ===== FINANCIAL TRENDS ===== */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden lg:col-span-2 shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-fg-success" />
                        <h3 className="font-bold text-fg-primary text-sm">แนวโน้มการเงินรายเดือน</h3>
                    </div>
                    <span className="text-[10px] text-fg-tertiary font-mono">6 เดือนล่าสุด</span>
                </div>

                {!financeChart ? (
                    <div className="p-12 text-center text-fg-tertiary text-sm">ยังไม่มีข้อมูลธุรกรรม</div>
                ) : (
                    <div className="p-5">
                        {/* Summary Row */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                            {(() => {
                                const totalInflow = financeChart.data.reduce((s, d) => s + d.inflow, 0);
                                const totalOutflow = financeChart.data.reduce((s, d) => s + d.outflow, 0);
                                const totalNet = totalInflow - totalOutflow;
                                return (
                                    <>
                                        <div className="bg-status-success-subtle border border-status-success rounded-token-xl p-3">
                                            <div className="text-[9px] text-fg-tertiary font-bold uppercase tracking-wider mb-1">รวมเข้า</div>
                                            <div className="text-lg font-black text-fg-success tabular-nums">+฿{formatMoney(totalInflow)}</div>
                                        </div>
                                        <div className="bg-status-danger-subtle border border-status-danger rounded-token-xl p-3">
                                            <div className="text-[9px] text-fg-tertiary font-bold uppercase tracking-wider mb-1">รวมออก</div>
                                            <div className="text-lg font-black text-fg-danger tabular-nums">-฿{formatMoney(totalOutflow)}</div>
                                        </div>
                                        <div className={`${totalNet >= 0 ? 'bg-status-success-subtle border-status-success' : 'bg-status-danger-subtle border-status-danger'} border rounded-token-xl p-3`}>
                                            <div className="text-[9px] text-fg-tertiary font-bold uppercase tracking-wider mb-1">สุทธิ</div>
                                            <div className={`text-lg font-black tabular-nums ${totalNet >= 0 ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                {totalNet >= 0 ? '+' : ''}฿{formatMoney(totalNet)}
                                            </div>
                                        </div>
                                        <div className="bg-accent-subtle border border-border-accent rounded-token-xl p-3">
                                            <div className="text-[9px] text-fg-tertiary font-bold uppercase tracking-wider mb-1">ตั้งยอดเก็บเงิน</div>
                                            <div className="text-lg font-black text-accent-bright tabular-nums">฿{formatMoney(financeChart.data.reduce((s, d) => s + d.due, 0))}</div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>

                        {/* Bar Chart */}
                        <div className="space-y-3">
                            {financeChart.data.map((d, i) => {
                                const inflowPct = (d.inflow / financeChart.maxValue) * 100;
                                const outflowPct = (d.outflow / financeChart.maxValue) * 100;
                                return (
                                    <div key={d.month} className="group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 shrink-0 text-right">
                                                <span className="text-[11px] font-bold text-fg-secondary">{formatMonthLabel(d.month)}</span>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-3 bg-bg-muted rounded-token-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-status-success rounded-token-full transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.max(inflowPct, d.inflow > 0 ? 2 : 0)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-fg-success tabular-nums w-20 text-right">
                                                        +฿{formatMoney(d.inflow)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-3 bg-bg-muted rounded-token-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-status-danger rounded-token-full transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.max(outflowPct, d.outflow > 0 ? 2 : 0)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-fg-danger tabular-nums w-20 text-right">
                                                        -฿{formatMoney(d.outflow)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-20 text-right shrink-0 ${d.net >= 0 ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                <span className="text-[10px] font-black tabular-nums">
                                                    {d.net >= 0 ? '+' : ''}฿{formatMoney(d.net)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-6 mt-5 pt-4 border-t border-border-subtle">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-1.5 rounded-token-full bg-status-success" />
                                <span className="text-[10px] text-fg-tertiary font-medium">เข้า (รายรับ/ฝาก/คืน)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-1.5 rounded-token-full bg-status-danger" />
                                <span className="text-[10px] text-fg-tertiary font-medium">ออก (รายจ่าย/ยืม)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-1.5 rounded-token-full bg-accent" />
                                <span className="text-[10px] text-fg-tertiary font-medium">ยอดเก็บเงิน (ยังไม่ใช่เงินเข้ากองกลาง)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== ATTENDANCE CHART ===== */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarCheck className="w-5 h-5 text-fg-info" />
                        <h3 className="font-bold text-fg-primary text-sm">อัตราเข้าร่วมเช็คชื่อ</h3>
                    </div>
                    <span className="text-[10px] text-fg-tertiary font-mono">10 เซสชันล่าสุด</span>
                </div>

                {!attendanceChart || attendanceChart.length === 0 ? (
                    <div className="p-12 text-center text-fg-tertiary text-sm">ยังไม่มีข้อมูลเช็คชื่อ</div>
                ) : (
                    <div className="p-5 space-y-2">
                        {attendanceChart.map((s, i) => {
                            const participationRate = s.total > 0 ? (s.present / s.total) * 100 : 0;
                            const date = new Date(s.sessionDate);
                            const dateStr = date.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' });

                            return (
                                <div key={i} className="group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 shrink-0">
                                            <span className="text-[10px] font-medium text-fg-tertiary truncate block">{dateStr}</span>
                                        </div>
                                        <div className="flex-1 h-4 bg-bg-muted rounded-token-full overflow-hidden flex">
                                            {s.total > 0 && (
                                                <>
                                                    {s.present > 0 && (
                                                        <div
                                                            className="h-full bg-status-success transition-all duration-500"
                                                            style={{ width: `${(s.present / s.total) * 100}%` }}
                                                            title={`มา: ${s.present}`}
                                                        />
                                                    )}
                                                    {s.leave > 0 && (
                                                        <div
                                                            className="h-full bg-status-info transition-all duration-500"
                                                            style={{ width: `${(s.leave / s.total) * 100}%` }}
                                                            title={`ลา: ${s.leave}`}
                                                        />
                                                    )}
                                                    {s.absent > 0 && (
                                                        <div
                                                            className="h-full bg-status-danger transition-all duration-500"
                                                            style={{ width: `${(s.absent / s.total) * 100}%` }}
                                                            title={`ขาด: ${s.absent}`}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-black tabular-nums w-10 text-right shrink-0 ${participationRate >= 80 ? 'text-fg-success' : participationRate >= 50 ? 'text-fg-warning' : 'text-fg-danger'}`}>
                                            {participationRate.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-border-subtle">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-token-sm bg-status-success" /><span className="text-[9px] text-fg-tertiary">มา</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-token-sm bg-status-info" /><span className="text-[9px] text-fg-tertiary">ลา</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-token-sm bg-status-danger" /><span className="text-[9px] text-fg-tertiary">ขาด</span></div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== TRANSACTION TYPE BREAKDOWN ===== */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-accent-bright" />
                        <h3 className="font-bold text-fg-primary text-sm">สัดส่วนธุรกรรม</h3>
                    </div>
                    <span className="text-[10px] text-fg-tertiary font-mono">ทั้งหมด</span>
                </div>

                {!breakdownData ? (
                    <div className="p-12 text-center text-fg-tertiary text-sm">ยังไม่มีข้อมูล</div>
                ) : (
                    <div className="p-5 space-y-3">
                        {breakdownData.items
                            .sort((a, b) => b.total - a.total)
                            .map((item) => {
                                const pct = breakdownData.totalAmount > 0 ? (item.total / breakdownData.totalAmount) * 100 : 0;
                                const colors = TYPE_COLORS[item.type] || { bg: 'bg-bg-muted', text: 'text-fg-secondary', bar: 'bg-fg-tertiary' };

                                return (
                                    <div key={item.type}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-token-full ${colors.bar}`} />
                                                <span className="text-xs text-fg-secondary font-medium">{item.label}</span>
                                                <span className="text-[10px] text-fg-tertiary tabular-nums">({item.count} รายการ)</span>
                                            </div>
                                            <span className={`text-xs font-bold ${colors.text} tabular-nums`}>
                                                ฿{formatMoney(item.total)}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-bg-muted rounded-token-full overflow-hidden">
                                            <div
                                                className={`h-full ${colors.bar} rounded-token-full transition-all duration-700 ease-out opacity-80`}
                                                style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                )}
            </div>
        </div>
    );
}
