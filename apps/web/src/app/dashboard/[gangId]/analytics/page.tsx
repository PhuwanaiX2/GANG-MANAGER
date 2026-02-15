import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, transactions, attendanceSessions, attendanceRecords, leaveRequests } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';
import {
    TrendingUp,
    Users,
    Wallet,
    CalendarCheck,
    Shield,
    Zap,
    ArrowUpRight,
    ArrowDownLeft,
    UserCheck,
    UserX,
    Clock,
    AlertTriangle,
    Activity,
    Gem,
} from 'lucide-react';
import Link from 'next/link';
import { AnalyticsCharts } from './AnalyticsCharts';

interface Props {
    params: { gangId: string };
}

export default async function AnalyticsPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Permission check
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-gray-400 max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner) หรือ Admin เท่านั้นที่สามารถดู Analytics ได้
                </p>
            </div>
        );
    }

    // Tier check — PREMIUM only
    const tierCheck = await checkTierAccess(gangId, 'analytics');
    if (!tierCheck.allowed) {
        return (
            <div className="space-y-8 animate-fade-in">
                <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                        <span className="text-purple-400 text-[10px] font-black tracking-widest uppercase">Analytics Dashboard</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-sm">Analytics</h1>
                    <p className="text-gray-400 font-medium">วิเคราะห์ข้อมูลแก๊งเชิงลึก</p>
                </div>

                <div className="relative overflow-hidden rounded-3xl border border-purple-500/20 bg-gradient-to-br from-purple-500/5 via-transparent to-purple-500/5">
                    <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
                    <div className="relative p-12 text-center">
                        <div className="inline-flex p-5 bg-purple-500/10 rounded-3xl mb-6 ring-1 ring-purple-500/20">
                            <Gem className="w-12 h-12 text-purple-400" />
                        </div>
                        <h2 className="text-2xl font-black text-white mb-3">Analytics Dashboard</h2>
                        <p className="text-gray-400 max-w-lg mx-auto mb-2">
                            ดูสถิติเชิงลึกของแก๊ง รวมถึงแนวโน้มการเงิน อัตราเข้าร่วมเช็คชื่อ
                            การกระจายหนี้สมาชิก และภาพรวมกิจกรรมทั้งหมด
                        </p>
                        <p className="text-sm text-gray-500 mb-8">
                            แพลนปัจจุบัน: <strong className="text-white">{tierCheck.tierConfig.name}</strong>
                        </p>

                        {/* Feature Preview Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-10">
                            {[
                                { icon: TrendingUp, label: 'แนวโน้มการเงิน', color: 'emerald' },
                                { icon: CalendarCheck, label: 'สถิติเช็คชื่อ', color: 'blue' },
                                { icon: Users, label: 'วิเคราะห์สมาชิก', color: 'purple' },
                                { icon: Activity, label: 'ภาพรวมกิจกรรม', color: 'orange' },
                            ].map((item, i) => (
                                <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 text-center">
                                    <item.icon className={`w-6 h-6 mx-auto mb-2 text-${item.color}-400 opacity-50`} />
                                    <span className="text-xs text-gray-500 font-medium">{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <Link
                            href={`/dashboard/${gangId}/settings?tab=subscription`}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-purple-500/20 hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-95"
                        >
                            <Zap className="w-5 h-5" />
                            อัปเกรดเป็น Premium
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    // ========== FETCH ALL ANALYTICS DATA ==========
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);

    const [
        gang,
        memberStats,
        monthlyFinance,
        attendanceStats,
        topDebtors,
        topCreditors,
        recentSessionStats,
        leaveStats,
        transactionTypeBreakdown,
        weeklyActivity,
    ] = await Promise.all([
        // Gang info
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { balance: true, subscriptionTier: true, name: true, createdAt: true },
        }),

        // Member stats
        db.select({
            total: sql<number>`count(*)`,
            active: sql<number>`sum(case when ${members.isActive} = 1 and ${members.status} = 'APPROVED' then 1 else 0 end)`,
            pending: sql<number>`sum(case when ${members.status} = 'PENDING' then 1 else 0 end)`,
            withDebt: sql<number>`sum(case when ${members.isActive} = 1 and ${members.balance} < 0 then 1 else 0 end)`,
            totalDebt: sql<number>`sum(case when ${members.isActive} = 1 and ${members.balance} < 0 then ABS(${members.balance}) else 0 end)`,
            totalCredit: sql<number>`sum(case when ${members.isActive} = 1 and ${members.balance} > 0 then ${members.balance} else 0 end)`,
        }).from(members).where(eq(members.gangId, gangId)),

        // Monthly financial trends (last 6 months)
        db.select({
            month: sql<string>`strftime('%Y-%m', ${transactions.createdAt})`,
            type: transactions.type,
            total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
            count: sql<number>`count(*)`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED'),
                sql`${transactions.createdAt} >= ${sixMonthsAgo.toISOString()}`
            ))
            .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
            .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`),

        // Attendance participation stats (last 10 sessions)
        db.select({
            sessionId: attendanceSessions.id,
            sessionName: attendanceSessions.sessionName,
            sessionDate: attendanceSessions.sessionDate,
            present: sql<number>`sum(case when ${attendanceRecords.status} = 'PRESENT' then 1 else 0 end)`,
            late: sql<number>`sum(case when ${attendanceRecords.status} = 'LATE' then 1 else 0 end)`,
            absent: sql<number>`sum(case when ${attendanceRecords.status} = 'ABSENT' then 1 else 0 end)`,
            leave: sql<number>`sum(case when ${attendanceRecords.status} = 'LEAVE' then 1 else 0 end)`,
            total: sql<number>`count(${attendanceRecords.id})`,
        })
            .from(attendanceSessions)
            .leftJoin(attendanceRecords, eq(attendanceSessions.id, attendanceRecords.sessionId))
            .where(and(
                eq(attendanceSessions.gangId, gangId),
                eq(attendanceSessions.status, 'CLOSED')
            ))
            .groupBy(attendanceSessions.id)
            .orderBy(desc(attendanceSessions.sessionDate))
            .limit(10),

        // Top debtors
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                sql`${members.balance} < 0`
            ),
            orderBy: sql`${members.balance} ASC`,
            limit: 5,
            columns: { id: true, name: true, balance: true, discordAvatar: true },
        }),

        // Top creditors
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                sql`${members.balance} > 0`
            ),
            orderBy: desc(members.balance),
            limit: 5,
            columns: { id: true, name: true, balance: true, discordAvatar: true },
        }),

        // Recent session stats for attendance rate calculation
        db.select({
            totalSessions: sql<number>`count(*)`,
        })
            .from(attendanceSessions)
            .where(and(
                eq(attendanceSessions.gangId, gangId),
                eq(attendanceSessions.status, 'CLOSED'),
            )),

        // Leave request stats
        db.select({
            total: sql<number>`count(*)`,
            approved: sql<number>`sum(case when ${leaveRequests.status} = 'APPROVED' then 1 else 0 end)`,
            pending: sql<number>`sum(case when ${leaveRequests.status} = 'PENDING' then 1 else 0 end)`,
            rejected: sql<number>`sum(case when ${leaveRequests.status} = 'REJECTED' then 1 else 0 end)`,
        }).from(leaveRequests).where(eq(leaveRequests.gangId, gangId)),

        // Transaction type breakdown (all time)
        db.select({
            type: transactions.type,
            total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
            count: sql<number>`count(*)`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED'),
            ))
            .groupBy(transactions.type),

        // Weekly activity (last 4 weeks)
        db.select({
            week: sql<string>`strftime('%Y-W%W', ${transactions.createdAt})`,
            count: sql<number>`count(*)`,
            total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED'),
                sql`${transactions.createdAt} >= date('now', '-28 days')`
            ))
            .groupBy(sql`strftime('%Y-W%W', ${transactions.createdAt})`)
            .orderBy(sql`strftime('%Y-W%W', ${transactions.createdAt})`),
    ]);

    if (!gang) redirect('/dashboard');

    // Process monthly finance data
    const monthlyMap = new Map<string, { month: string; income: number; expense: number; loan: number; repayment: number; penalty: number; deposit: number; gangFee: number; txCount: number }>();
    for (const row of monthlyFinance) {
        const month = row.month;
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expense: 0, loan: 0, repayment: 0, penalty: 0, deposit: 0, gangFee: 0, txCount: 0 });
        }
        const entry = monthlyMap.get(month)!;
        entry.txCount += row.count;
        switch (row.type) {
            case 'INCOME': entry.income = row.total; break;
            case 'EXPENSE': entry.expense = row.total; break;
            case 'LOAN': entry.loan = row.total; break;
            case 'REPAYMENT': entry.repayment = row.total; break;
            case 'PENALTY': entry.penalty = row.total; break;
            case 'DEPOSIT': entry.deposit = row.total; break;
            case 'GANG_FEE': entry.gangFee = row.total; break;
        }
    }
    const months = Array.from(monthlyMap.values());

    // Calculate attendance averages
    const avgAttendanceRate = attendanceStats.length > 0
        ? attendanceStats.reduce((sum, s) => sum + (s.total > 0 ? ((s.present + s.late) / s.total) * 100 : 0), 0) / attendanceStats.length
        : 0;

    // Transaction type labels
    const typeLabels: Record<string, string> = {
        INCOME: 'รายรับ',
        EXPENSE: 'รายจ่าย',
        LOAN: 'ยืม',
        REPAYMENT: 'คืนเงิน',
        DEPOSIT: 'ฝากเงิน',
        PENALTY: 'ค่าปรับ',
        GANG_FEE: 'เก็บเงินแก๊ง',
    };

    const stats = memberStats[0] || { total: 0, active: 0, pending: 0, withDebt: 0, totalDebt: 0, totalCredit: 0 };
    const leaves = leaveStats[0] || { total: 0, approved: 0, pending: 0, rejected: 0 };
    const totalSessions = recentSessionStats[0]?.totalSessions || 0;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-purple-400 text-[10px] font-black tracking-widest uppercase">Analytics Dashboard</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-sm">Analytics</h1>
                <p className="text-gray-400 font-medium">วิเคราะห์ข้อมูลเชิงลึกของแก๊ง {gang.name}</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    label="ยอดกองกลาง"
                    value={`฿${gang.balance.toLocaleString()}`}
                    icon={Wallet}
                    color="emerald"
                    sub="Current Balance"
                />
                <KpiCard
                    label="สมาชิก Active"
                    value={`${stats.active || 0}`}
                    icon={Users}
                    color="blue"
                    sub={`จากทั้งหมด ${stats.total || 0} คน`}
                />
                <KpiCard
                    label="อัตราเข้าร่วม"
                    value={`${avgAttendanceRate.toFixed(1)}%`}
                    icon={CalendarCheck}
                    color="purple"
                    sub={`จาก ${totalSessions} เซสชัน`}
                />
                <KpiCard
                    label="สมาชิกมีหนี้"
                    value={`${stats.withDebt || 0}`}
                    icon={AlertTriangle}
                    color="red"
                    sub={`รวม ฿${(stats.totalDebt || 0).toLocaleString()}`}
                />
            </div>

            {/* Charts Section */}
            <AnalyticsCharts
                months={months}
                attendanceStats={attendanceStats.map(s => ({
                    sessionName: s.sessionName,
                    sessionDate: s.sessionDate?.toISOString() || '',
                    present: s.present || 0,
                    late: s.late || 0,
                    absent: s.absent || 0,
                    leave: s.leave || 0,
                    total: s.total || 0,
                }))}
                transactionBreakdown={transactionTypeBreakdown.map(t => ({
                    type: t.type,
                    label: typeLabels[t.type] || t.type,
                    total: t.total,
                    count: t.count,
                }))}
            />

            {/* Bottom Grid: Debtors + Creditors + Leaves */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Debtors */}
                <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center gap-2">
                        <ArrowDownLeft className="w-5 h-5 text-red-400" />
                        <h3 className="font-bold text-white text-sm">สมาชิกที่มีหนี้สูงสุด</h3>
                    </div>
                    {topDebtors.length === 0 ? (
                        <div className="p-8 text-center text-gray-600 text-sm">ไม่มีสมาชิกที่มีหนี้</div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {topDebtors.map((m, i) => (
                                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                                    <span className="text-xs text-gray-600 font-mono w-5 shrink-0">{i + 1}.</span>
                                    {m.discordAvatar ? (
                                        <img src={m.discordAvatar} alt="" className="w-7 h-7 rounded-full shrink-0" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                                            <UserX className="w-3.5 h-3.5 text-red-400" />
                                        </div>
                                    )}
                                    <span className="text-sm text-white font-medium flex-1 truncate">{m.name}</span>
                                    <span className="text-sm font-bold text-red-400 tabular-nums">฿{Math.abs(m.balance).toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Creditors */}
                <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center gap-2">
                        <ArrowUpRight className="w-5 h-5 text-emerald-400" />
                        <h3 className="font-bold text-white text-sm">สมาชิกยอดคงเหลือสูงสุด</h3>
                    </div>
                    {topCreditors.length === 0 ? (
                        <div className="p-8 text-center text-gray-600 text-sm">ไม่มีข้อมูล</div>
                    ) : (
                        <div className="divide-y divide-white/5">
                            {topCreditors.map((m, i) => (
                                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                                    <span className="text-xs text-gray-600 font-mono w-5 shrink-0">{i + 1}.</span>
                                    {m.discordAvatar ? (
                                        <img src={m.discordAvatar} alt="" className="w-7 h-7 rounded-full shrink-0" />
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                        </div>
                                    )}
                                    <span className="text-sm text-white font-medium flex-1 truncate">{m.name}</span>
                                    <span className="text-sm font-bold text-emerald-400 tabular-nums">+฿{m.balance.toLocaleString()}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Leave Stats */}
                <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-400" />
                        <h3 className="font-bold text-white text-sm">สถิติการลา</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-400">คำขอลาทั้งหมด</span>
                            <span className="text-lg font-black text-white tabular-nums">{leaves.total || 0}</span>
                        </div>
                        <div className="space-y-2.5">
                            <StatBar label="อนุมัติ" value={leaves.approved || 0} total={leaves.total || 1} color="emerald" />
                            <StatBar label="รอดำเนินการ" value={leaves.pending || 0} total={leaves.total || 1} color="yellow" />
                            <StatBar label="ปฏิเสธ" value={leaves.rejected || 0} total={leaves.total || 1} color="red" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ label, value, icon: Icon, color, sub }: {
    label: string; value: string; icon: any; color: string; sub: string;
}) {
    const colorMap: Record<string, { bg: string; text: string; icon: string; glow: string }> = {
        emerald: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', icon: 'bg-emerald-500', glow: 'shadow-emerald-500/20' },
        blue: { bg: 'bg-blue-500/10', text: 'text-blue-400', icon: 'bg-blue-500', glow: 'shadow-blue-500/20' },
        purple: { bg: 'bg-purple-500/10', text: 'text-purple-400', icon: 'bg-purple-500', glow: 'shadow-purple-500/20' },
        red: { bg: 'bg-red-500/10', text: 'text-red-400', icon: 'bg-red-500', glow: 'shadow-red-500/20' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5 relative overflow-hidden group hover:border-white/10 transition-all">
            <div className={`absolute top-0 right-0 w-20 h-20 ${c.bg} blur-2xl rounded-full -mr-8 -mt-8 opacity-50`} />
            <div className="relative z-10">
                <div className={`inline-flex p-2 ${c.icon} rounded-xl shadow-lg ${c.glow} mb-3`}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-[10px] text-gray-500 font-bold tracking-wider uppercase mb-1">{label}</div>
                <div className="text-2xl font-black text-white tracking-tight tabular-nums">{value}</div>
                <div className="text-[10px] text-gray-600 mt-1">{sub}</div>
            </div>
        </div>
    );
}

function StatBar({ label, value, total, color }: {
    label: string; value: number; total: number; color: string;
}) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    const colorMap: Record<string, string> = {
        emerald: 'bg-emerald-500',
        yellow: 'bg-yellow-500',
        red: 'bg-red-500',
        blue: 'bg-blue-500',
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-xs font-bold text-white tabular-nums">{value} <span className="text-gray-600">({pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div
                    className={`h-full ${colorMap[color] || 'bg-gray-500'} rounded-full transition-all duration-700`}
                    style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                />
            </div>
        </div>
    );
}
