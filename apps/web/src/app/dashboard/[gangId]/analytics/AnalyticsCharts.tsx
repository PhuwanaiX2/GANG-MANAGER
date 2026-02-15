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
    late: number;
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
    return date.toLocaleDateString('th-TH', { month: 'short' });
}

const TYPE_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
    INCOME: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', bar: 'bg-emerald-500' },
    EXPENSE: { bg: 'bg-red-500/10', text: 'text-red-400', bar: 'bg-red-500' },
    LOAN: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', bar: 'bg-yellow-500' },
    REPAYMENT: { bg: 'bg-cyan-500/10', text: 'text-cyan-400', bar: 'bg-cyan-500' },
    DEPOSIT: { bg: 'bg-blue-500/10', text: 'text-blue-400', bar: 'bg-blue-500' },
    PENALTY: { bg: 'bg-orange-500/10', text: 'text-orange-400', bar: 'bg-orange-500' },
    GANG_FEE: { bg: 'bg-purple-500/10', text: 'text-purple-400', bar: 'bg-purple-500' },
};

export function AnalyticsCharts({ months, attendanceStats, transactionBreakdown }: Props) {
    // ========== FINANCIAL CHART DATA ==========
    const financeChart = useMemo(() => {
        if (months.length === 0) return null;

        const data = months.map(m => {
            const inflow = m.income + m.repayment + m.deposit + m.gangFee;
            const outflow = m.expense + m.loan;
            const net = inflow - outflow;
            return { ...m, inflow, outflow, net };
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
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden lg:col-span-2">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-white text-sm">แนวโน้มการเงินรายเดือน</h3>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono">6 เดือนล่าสุด</span>
                </div>

                {!financeChart ? (
                    <div className="p-12 text-center text-gray-600 text-sm">ยังไม่มีข้อมูลธุรกรรม</div>
                ) : (
                    <div className="p-5">
                        {/* Summary Row */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            {(() => {
                                const totalInflow = financeChart.data.reduce((s, d) => s + d.inflow, 0);
                                const totalOutflow = financeChart.data.reduce((s, d) => s + d.outflow, 0);
                                const totalNet = totalInflow - totalOutflow;
                                return (
                                    <>
                                        <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
                                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">รวมเข้า</div>
                                            <div className="text-lg font-black text-emerald-400 tabular-nums">+฿{formatMoney(totalInflow)}</div>
                                        </div>
                                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3">
                                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">รวมออก</div>
                                            <div className="text-lg font-black text-red-400 tabular-nums">-฿{formatMoney(totalOutflow)}</div>
                                        </div>
                                        <div className={`${totalNet >= 0 ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-red-500/5 border-red-500/10'} border rounded-xl p-3`}>
                                            <div className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mb-1">สุทธิ</div>
                                            <div className={`text-lg font-black tabular-nums ${totalNet >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                {totalNet >= 0 ? '+' : ''}฿{formatMoney(totalNet)}
                                            </div>
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
                                                <span className="text-[11px] font-bold text-gray-400">{formatMonthLabel(d.month)}</span>
                                            </div>
                                            <div className="flex-1 space-y-1">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.max(inflowPct, d.inflow > 0 ? 2 : 0)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-emerald-400 tabular-nums w-20 text-right">
                                                        +฿{formatMoney(d.inflow)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-3 bg-white/[0.03] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700 ease-out"
                                                            style={{ width: `${Math.max(outflowPct, d.outflow > 0 ? 2 : 0)}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] font-bold text-red-400 tabular-nums w-20 text-right">
                                                        -฿{formatMoney(d.outflow)}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className={`w-20 text-right shrink-0 ${d.net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
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
                        <div className="flex items-center gap-6 mt-5 pt-4 border-t border-white/5">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-emerald-400" />
                                <span className="text-[10px] text-gray-500 font-medium">เข้า (รายรับ/ฝาก/คืน/เก็บ)</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-1.5 rounded-full bg-gradient-to-r from-red-600 to-red-400" />
                                <span className="text-[10px] text-gray-500 font-medium">ออก (รายจ่าย/ยืม)</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== ATTENDANCE CHART ===== */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CalendarCheck className="w-5 h-5 text-blue-400" />
                        <h3 className="font-bold text-white text-sm">อัตราเข้าร่วมเช็คชื่อ</h3>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono">10 เซสชันล่าสุด</span>
                </div>

                {!attendanceChart || attendanceChart.length === 0 ? (
                    <div className="p-12 text-center text-gray-600 text-sm">ยังไม่มีข้อมูลเช็คชื่อ</div>
                ) : (
                    <div className="p-5 space-y-2">
                        {attendanceChart.map((s, i) => {
                            const participationRate = s.total > 0 ? ((s.present + s.late) / s.total) * 100 : 0;
                            const date = new Date(s.sessionDate);
                            const dateStr = date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });

                            return (
                                <div key={i} className="group">
                                    <div className="flex items-center gap-3">
                                        <div className="w-14 shrink-0">
                                            <span className="text-[10px] font-medium text-gray-500 truncate block">{dateStr}</span>
                                        </div>
                                        <div className="flex-1 h-4 bg-white/[0.03] rounded-full overflow-hidden flex">
                                            {s.total > 0 && (
                                                <>
                                                    {s.present > 0 && (
                                                        <div
                                                            className="h-full bg-emerald-500 transition-all duration-500"
                                                            style={{ width: `${(s.present / s.total) * 100}%` }}
                                                            title={`มา: ${s.present}`}
                                                        />
                                                    )}
                                                    {s.late > 0 && (
                                                        <div
                                                            className="h-full bg-yellow-500 transition-all duration-500"
                                                            style={{ width: `${(s.late / s.total) * 100}%` }}
                                                            title={`สาย: ${s.late}`}
                                                        />
                                                    )}
                                                    {s.leave > 0 && (
                                                        <div
                                                            className="h-full bg-blue-500 transition-all duration-500"
                                                            style={{ width: `${(s.leave / s.total) * 100}%` }}
                                                            title={`ลา: ${s.leave}`}
                                                        />
                                                    )}
                                                    {s.absent > 0 && (
                                                        <div
                                                            className="h-full bg-red-500/60 transition-all duration-500"
                                                            style={{ width: `${(s.absent / s.total) * 100}%` }}
                                                            title={`ขาด: ${s.absent}`}
                                                        />
                                                    )}
                                                </>
                                            )}
                                        </div>
                                        <span className={`text-[10px] font-black tabular-nums w-10 text-right shrink-0 ${participationRate >= 80 ? 'text-emerald-400' : participationRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                                            {participationRate.toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Legend */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-4 pt-3 border-t border-white/5">
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /><span className="text-[9px] text-gray-500">มา</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-yellow-500" /><span className="text-[9px] text-gray-500">สาย</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500" /><span className="text-[9px] text-gray-500">ลา</span></div>
                            <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/60" /><span className="text-[9px] text-gray-500">ขาด</span></div>
                        </div>
                    </div>
                )}
            </div>

            {/* ===== TRANSACTION TYPE BREAKDOWN ===== */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-purple-400" />
                        <h3 className="font-bold text-white text-sm">สัดส่วนธุรกรรม</h3>
                    </div>
                    <span className="text-[10px] text-gray-600 font-mono">ทั้งหมด</span>
                </div>

                {!breakdownData ? (
                    <div className="p-12 text-center text-gray-600 text-sm">ยังไม่มีข้อมูล</div>
                ) : (
                    <div className="p-5 space-y-3">
                        {breakdownData.items
                            .sort((a, b) => b.total - a.total)
                            .map((item) => {
                                const pct = breakdownData.totalAmount > 0 ? (item.total / breakdownData.totalAmount) * 100 : 0;
                                const colors = TYPE_COLORS[item.type] || { bg: 'bg-gray-500/10', text: 'text-gray-400', bar: 'bg-gray-500' };

                                return (
                                    <div key={item.type}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${colors.bar}`} />
                                                <span className="text-xs text-gray-300 font-medium">{item.label}</span>
                                                <span className="text-[10px] text-gray-600 tabular-nums">({item.count} รายการ)</span>
                                            </div>
                                            <span className={`text-xs font-bold ${colors.text} tabular-nums`}>
                                                ฿{formatMoney(item.total)}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-white/[0.03] rounded-full overflow-hidden">
                                            <div
                                                className={`h-full ${colors.bar} rounded-full transition-all duration-700 ease-out opacity-80`}
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
