export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, transactions, attendanceSessions, leaveRequests, financeCollectionBatches, financeCollectionMembers, getAttendanceBucketCounts } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { getGangPermissionFlagsForDiscordId } from '@/lib/gangAccess';
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
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function AnalyticsPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Permission check
    const permissions = await getGangPermissionFlagsForDiscordId({ gangId, discordId: session.user.discordId });
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-status-danger-subtle rounded-token-full flex items-center justify-center mb-4">
                    <Shield className="w-8 h-8 text-fg-danger" />
                </div>
                <h1 className="text-2xl font-bold text-fg-primary mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-secondary max-w-md">
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
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-accent-subtle border border-border-accent mb-3">
                        <span className="w-1.5 h-1.5 rounded-token-full bg-accent animate-pulse" />
                        <span className="text-accent-bright text-[10px] font-black tracking-widest uppercase">Analytics Dashboard</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary mb-2 drop-shadow-sm">Analytics</h1>
                    <p className="text-fg-secondary font-medium">วิเคราะห์ข้อมูลแก๊งเชิงลึก</p>
                </div>

                <div className="relative overflow-hidden rounded-token-3xl border border-border-accent bg-accent-subtle">
                    <div className="absolute inset-0 bg-[url('https://transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.02]" />
                    <div className="relative p-12 text-center">
                        <div className="inline-flex p-5 bg-accent-subtle rounded-token-3xl mb-6 ring-1 ring-border-accent">
                            <Gem className="w-12 h-12 text-accent-bright" />
                        </div>
                        <h2 className="text-2xl font-black text-fg-primary mb-3">Analytics Dashboard</h2>
                        <p className="text-fg-secondary max-w-lg mx-auto mb-2">
                            ดูสถิติเชิงลึกของแก๊ง รวมถึงแนวโน้มการเงิน อัตราเข้าร่วมเช็คชื่อ
                            การกระจายหนี้สมาชิก และภาพรวมกิจกรรมทั้งหมด
                        </p>
                        <p className="text-sm text-fg-tertiary mb-8">
                            แพลนปัจจุบัน: <strong className="text-fg-primary">{tierCheck.tierConfig.name}</strong>
                            <span className="block mt-2 text-fg-warning">{PAYMENT_PAUSED_COPY.lockedFeature}</span>
                        </p>

                        {/* Feature Preview Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-10">
                            {[
                                { icon: TrendingUp, label: 'แนวโน้มการเงิน', colorClass: 'text-fg-success' },
                                { icon: CalendarCheck, label: 'สถิติเช็คชื่อ', colorClass: 'text-fg-info' },
                                { icon: Users, label: 'วิเคราะห์สมาชิก', colorClass: 'text-accent-bright' },
                                { icon: Activity, label: 'ภาพรวมกิจกรรม', colorClass: 'text-fg-warning' },
                            ].map((item, i) => (
                                <div key={i} className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 text-center">
                                    <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.colorClass} opacity-60`} />
                                    <span className="text-xs text-fg-tertiary font-medium">{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <Link
                            href={`/dashboard/${gangId}/settings?tab=subscription`}
                            className="inline-flex items-center gap-2 px-8 py-4 bg-accent hover:brightness-110 text-accent-fg font-bold rounded-token-2xl transition-all shadow-token-md hover:scale-[1.02] active:scale-95"
                        >
                            <Zap className="w-5 h-5" />
                            {PAYMENT_PAUSED_COPY.detailsActionLabel}
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
        monthlyCollectionDue,
        recentAttendanceSessions,
        memberRows,
        loanSummaryRaw,
        collectionDueRaw,
        recentSessionStats,
        leaveStats,
        transactionTypeBreakdown,
        collectionBreakdownRaw,
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
                sql`${transactions.type} != 'GANG_FEE'`,
                sql`${transactions.createdAt} >= ${sixMonthsAgo.toISOString()}`
            ))
            .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
            .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`),

        db.select({
            month: sql<string>`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`,
            totalDue: sql<number>`COALESCE(sum(${financeCollectionBatches.totalAmountDue}), 0)`,
            count: sql<number>`count(*)`,
        })
            .from(financeCollectionBatches)
            .where(and(
                eq(financeCollectionBatches.gangId, gangId),
                sql`${financeCollectionBatches.createdAt} >= ${sixMonthsAgo.toISOString()}`
            ))
            .groupBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`)
            .orderBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`),

        // Attendance participation stats (last 10 sessions)
        db.query.attendanceSessions.findMany({
            where: and(
                eq(attendanceSessions.gangId, gangId),
                eq(attendanceSessions.status, 'CLOSED')
            ),
            orderBy: [desc(attendanceSessions.sessionDate)],
            limit: 10,
            with: {
                records: true,
            },
        }),

        // Approved active members for finance rollups
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true, balance: true, discordAvatar: true },
        }),

        db.select({
            memberId: transactions.memberId,
            type: transactions.type,
            total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED'),
                sql`${transactions.memberId} IS NOT NULL`,
                sql`${transactions.type} IN ('LOAN', 'REPAYMENT')`
            ))
            .groupBy(transactions.memberId, transactions.type),

        db.select({
            memberId: financeCollectionMembers.memberId,
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId)
            ))
            .groupBy(financeCollectionMembers.memberId),

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
                sql`${transactions.type} != 'GANG_FEE'`,
            ))
            .groupBy(transactions.type),

        db.select({
            total: sql<number>`COALESCE(sum(${financeCollectionBatches.totalAmountDue}), 0)`,
            count: sql<number>`count(*)`,
        })
            .from(financeCollectionBatches)
            .where(eq(financeCollectionBatches.gangId, gangId)),

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
        }
    }
    for (const row of monthlyCollectionDue) {
        const month = row.month;
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, { month, income: 0, expense: 0, loan: 0, repayment: 0, penalty: 0, deposit: 0, gangFee: 0, txCount: 0 });
        }
        const entry = monthlyMap.get(month)!;
        entry.gangFee = Number(row.totalDue) || 0;
        entry.txCount += row.count;
    }
    const months = Array.from(monthlyMap.values());

    const loanMap = new Map<string, { loan: number; repayment: number }>();
    for (const row of loanSummaryRaw) {
        if (!row.memberId) continue;
        const current = loanMap.get(row.memberId) || { loan: 0, repayment: 0 };
        if (row.type === 'LOAN') current.loan = Number(row.total) || 0;
        if (row.type === 'REPAYMENT') current.repayment = Number(row.total) || 0;
        loanMap.set(row.memberId, current);
    }

    const collectionDueMap = new Map<string, number>();
    for (const row of collectionDueRaw) {
        if (!row.memberId) continue;
        collectionDueMap.set(row.memberId, Number(row.total) || 0);
    }

    const memberFinanceRows = memberRows.map((member) => {
        const loan = loanMap.get(member.id)?.loan || 0;
        const repayment = loanMap.get(member.id)?.repayment || 0;
        const loanDebt = Math.max(0, loan - repayment);
        const collectionDue = collectionDueMap.get(member.id) || 0;
        const debtExposure = Math.max(Math.abs(Number(member.balance) || 0), loanDebt + collectionDue);
        return {
            ...member,
            loanDebt,
            collectionDue,
            debtExposure,
        };
    });

    const topDebtors = memberFinanceRows
        .filter((member) => member.debtExposure > 0 && (member.loanDebt > 0 || member.collectionDue > 0 || member.balance < 0))
        .sort((a, b) => b.debtExposure - a.debtExposure)
        .slice(0, 5);

    const topCreditors = memberFinanceRows
        .filter((member) => member.balance > 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 5);

    const attendanceStats = recentAttendanceSessions.map((attendanceSession) => {
        const counts = getAttendanceBucketCounts(attendanceSession.records);

        return {
            sessionId: attendanceSession.id,
            sessionName: attendanceSession.sessionName,
            sessionDate: attendanceSession.sessionDate,
            present: counts.present,
            absent: counts.absent,
            leave: counts.leave,
            total: counts.total,
        };
    });

    // Calculate attendance averages
    const avgAttendanceRate = attendanceStats.length > 0
        ? attendanceStats.reduce((sum, s) => sum + (s.total > 0 ? (s.present / s.total) * 100 : 0), 0) / attendanceStats.length
        : 0;

    // Transaction type labels
    const typeLabels: Record<string, string> = {
        INCOME: 'รายรับ',
        EXPENSE: 'รายจ่าย',
        LOAN: 'ยืม',
        REPAYMENT: 'ชำระหนี้',
        DEPOSIT: 'นำเงินเข้า',
        PENALTY: 'ค่าปรับ',
        GANG_FEE: 'ตั้งยอดเก็บเงินแก๊ง',
    };

    const baseStats = memberStats[0] || { total: 0, active: 0, pending: 0, totalCredit: 0 };
    const stats = {
        ...baseStats,
        withDebt: memberFinanceRows.filter((member) => member.debtExposure > 0 && (member.loanDebt > 0 || member.collectionDue > 0 || member.balance < 0)).length,
        totalDebt: memberFinanceRows.reduce((sum, member) => sum + member.debtExposure, 0),
    };
    const leaves = leaveStats[0] || { total: 0, approved: 0, pending: 0, rejected: 0 };
    const totalSessions = recentSessionStats[0]?.totalSessions || 0;
    const collectionBreakdown = collectionBreakdownRaw[0];
    const breakdownItems = [
        ...transactionTypeBreakdown.map((t) => ({
            type: t.type,
            label: typeLabels[t.type] || t.type,
            total: t.total,
            count: t.count,
        })),
        ...((collectionBreakdown?.total || 0) > 0 ? [{
            type: 'GANG_FEE',
            label: typeLabels.GANG_FEE,
            total: Number(collectionBreakdown?.total) || 0,
            count: Number(collectionBreakdown?.count) || 0,
        }] : []),
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-accent-subtle border border-border-accent mb-3">
                    <span className="w-1.5 h-1.5 rounded-token-full bg-accent animate-pulse" />
                    <span className="text-accent-bright text-[10px] font-black tracking-widest uppercase">Analytics Dashboard</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary mb-2 drop-shadow-sm">Analytics</h1>
                <p className="text-fg-secondary font-medium">วิเคราะห์ข้อมูลเชิงลึกของแก๊ง {gang.name}</p>
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
                    absent: s.absent || 0,
                    leave: s.leave || 0,
                    total: s.total || 0,
                }))}
                transactionBreakdown={breakdownItems}
            />

            {/* Bottom Grid: Debtors + Creditors + Leaves */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Debtors */}
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center gap-2">
                        <ArrowDownLeft className="w-5 h-5 text-fg-danger" />
                        <h3 className="font-bold text-fg-primary text-sm">สมาชิกที่มีหนี้สูงสุด</h3>
                    </div>
                    {topDebtors.length === 0 ? (
                        <div className="p-8 text-center text-fg-tertiary text-sm">ไม่มีสมาชิกที่มีหนี้</div>
                    ) : (
                        <>
                        <div className="grid gap-3 p-4 md:hidden">
                            {topDebtors.map((m, i) => (
                                <div key={m.id} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="shrink-0 text-[10px] font-mono text-fg-tertiary">#{i + 1}</span>
                                            {m.discordAvatar ? (
                                                <img src={m.discordAvatar} alt="" className="h-8 w-8 rounded-token-full shrink-0" />
                                            ) : (
                                                <div className="h-8 w-8 rounded-token-full bg-status-danger-subtle flex items-center justify-center shrink-0">
                                                    <UserX className="w-4 h-4 text-fg-danger" />
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-fg-primary">{m.name}</p>
                                                <p className="mt-1 text-[10px] text-fg-tertiary">
                                                    {m.loanDebt > 0 ? `หนี้ยืม ฿${m.loanDebt.toLocaleString()}` : ''}
                                                    {m.loanDebt > 0 && m.collectionDue > 0 ? ' · ' : ''}
                                                    {m.collectionDue > 0 ? `ค้างเก็บเงิน ฿${m.collectionDue.toLocaleString()}` : ''}
                                                </p>
                                            </div>
                                        </div>
                                        <span className="shrink-0 text-sm font-black text-fg-danger tabular-nums">฿{m.debtExposure.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-[460px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right w-12">#</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สมาชิก</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">ยอดหนี้</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {topDebtors.map((m, i) => (
                                        <tr key={m.id} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-4 py-3 text-right text-xs text-fg-tertiary font-mono">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {m.discordAvatar ? (
                                                        <img src={m.discordAvatar} alt="" className="w-7 h-7 rounded-token-full shrink-0" />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-token-full bg-status-danger-subtle flex items-center justify-center shrink-0">
                                                            <UserX className="w-3.5 h-3.5 text-fg-danger" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-sm text-fg-primary font-medium truncate">{m.name}</div>
                                                        <div className="text-[10px] text-fg-tertiary mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                                                            {m.loanDebt > 0 && <span>หนี้ยืม ฿{m.loanDebt.toLocaleString()}</span>}
                                                            {m.collectionDue > 0 && <span>ค้างเก็บเงิน ฿{m.collectionDue.toLocaleString()}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <span className="text-sm font-bold text-fg-danger tabular-nums">฿{m.debtExposure.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </div>

                {/* Top Creditors */}
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center gap-2">
                        <ArrowUpRight className="w-5 h-5 text-fg-success" />
                        <h3 className="font-bold text-fg-primary text-sm">สมาชิกยอดคงเหลือสูงสุด</h3>
                    </div>
                    {topCreditors.length === 0 ? (
                        <div className="p-8 text-center text-fg-tertiary text-sm">ไม่มีข้อมูล</div>
                    ) : (
                        <>
                        <div className="grid gap-3 p-4 md:hidden">
                            {topCreditors.map((m, i) => (
                                <div key={m.id} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="shrink-0 text-[10px] font-mono text-fg-tertiary">#{i + 1}</span>
                                            {m.discordAvatar ? (
                                                <img src={m.discordAvatar} alt="" className="h-8 w-8 rounded-token-full shrink-0" />
                                            ) : (
                                                <div className="h-8 w-8 rounded-token-full bg-status-success-subtle flex items-center justify-center shrink-0">
                                                    <UserCheck className="w-4 h-4 text-fg-success" />
                                                </div>
                                            )}
                                            <span className="truncate text-sm font-bold text-fg-primary">{m.name}</span>
                                        </div>
                                        <span className="shrink-0 text-sm font-black text-fg-success tabular-nums">+฿{m.balance.toLocaleString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="min-w-[420px] w-full text-left">
                                <thead className="bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right w-12">#</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">สมาชิก</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">เครดิต</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {topCreditors.map((m, i) => (
                                        <tr key={m.id} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-4 py-3 text-right text-xs text-fg-tertiary font-mono">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {m.discordAvatar ? (
                                                        <img src={m.discordAvatar} alt="" className="w-7 h-7 rounded-token-full shrink-0" />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-token-full bg-status-success-subtle flex items-center justify-center shrink-0">
                                                            <UserCheck className="w-3.5 h-3.5 text-fg-success" />
                                                        </div>
                                                    )}
                                                    <span className="text-sm text-fg-primary font-medium truncate">{m.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-right whitespace-nowrap">
                                                <span className="text-sm font-bold text-fg-success tabular-nums">+฿{m.balance.toLocaleString()}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        </>
                    )}
                </div>

                {/* Leave Stats */}
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center gap-2">
                        <Clock className="w-5 h-5 text-fg-warning" />
                        <h3 className="font-bold text-fg-primary text-sm">สถิติการลา</h3>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-fg-secondary">คำขอลาทั้งหมด</span>
                            <span className="text-lg font-black text-fg-primary tabular-nums">{leaves.total || 0}</span>
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
        emerald: { bg: 'bg-status-success-subtle', text: 'text-fg-success', icon: 'bg-status-success', glow: 'shadow-token-sm' },
        blue: { bg: 'bg-status-info-subtle', text: 'text-fg-info', icon: 'bg-status-info', glow: 'shadow-token-sm' },
        purple: { bg: 'bg-accent-subtle', text: 'text-accent-bright', icon: 'bg-accent', glow: 'shadow-token-sm' },
        red: { bg: 'bg-status-danger-subtle', text: 'text-fg-danger', icon: 'bg-status-danger', glow: 'shadow-token-sm' },
    };
    const c = colorMap[color] || colorMap.blue;

    return (
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 relative overflow-hidden group hover:border-border transition-all shadow-token-sm">
            <div className={`absolute top-0 right-0 w-20 h-20 ${c.bg} blur-2xl rounded-token-full -mr-8 -mt-8 opacity-50`} />
            <div className="relative z-10">
                <div className={`inline-flex p-2 ${c.icon} rounded-token-xl ${c.glow} mb-3`}>
                    <Icon className="w-4 h-4 text-fg-inverse" />
                </div>
                <div className="text-[10px] text-fg-tertiary font-bold tracking-wider uppercase mb-1">{label}</div>
                <div className="text-2xl font-black text-fg-primary tracking-tight tabular-nums">{value}</div>
                <div className="text-[10px] text-fg-tertiary mt-1">{sub}</div>
            </div>
        </div>
    );
}

function StatBar({ label, value, total, color }: {
    label: string; value: number; total: number; color: string;
}) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    const colorMap: Record<string, string> = {
        emerald: 'bg-status-success',
        yellow: 'bg-status-warning',
        red: 'bg-status-danger',
        blue: 'bg-status-info',
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-fg-secondary">{label}</span>
                <span className="text-xs font-bold text-fg-primary tabular-nums">{value} <span className="text-fg-tertiary">({pct.toFixed(0)}%)</span></span>
            </div>
            <div className="h-1.5 bg-bg-muted rounded-token-full overflow-hidden">
                <div
                    className={`h-full ${colorMap[color] || 'bg-fg-tertiary'} rounded-token-full transition-all duration-700`}
                    style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                />
            </div>
        </div>
    );
}
