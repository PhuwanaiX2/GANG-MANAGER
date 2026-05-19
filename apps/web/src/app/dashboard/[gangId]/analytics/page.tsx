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
    Clock,
    AlertTriangle,
    Activity,
    Gem,
} from 'lucide-react';
import Link from 'next/link';
import { AnalyticsCharts } from './AnalyticsCharts';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';
import { Avatar } from '@/components/ui';

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
                    เฉพาะหัวหน้าแก๊งหรือผู้ดูแลเท่านั้นที่สามารถดูสถิติแก๊งได้
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
                        <span className="h-1.5 w-1.5 rounded-token-full bg-accent" />
                        <span className="text-accent-bright text-[10px] font-bold">สถิติแก๊ง</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary mb-2 drop-shadow-sm">สถิติแก๊ง</h1>
                    <p className="text-fg-secondary font-medium">วิเคราะห์ข้อมูลแก๊งเชิงลึก</p>
                </div>

                <div className="relative overflow-hidden rounded-token-3xl border border-border-accent bg-accent-subtle">
                    <div className="relative p-12 text-center">
                        <div className="inline-flex p-5 bg-accent-subtle rounded-token-3xl mb-6 ring-1 ring-border-accent">
                            <Gem className="w-12 h-12 text-accent-bright" />
                        </div>
                        <h2 className="text-2xl font-black text-fg-primary mb-3">สถิติแก๊ง</h2>
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
                                <div key={i} className="bg-bg-subtle border border-border-subtle rounded-token-lg p-3 text-center">
                                    <item.icon className={`w-6 h-6 mx-auto mb-2 ${item.colorClass} opacity-60`} />
                                    <span className="text-xs text-fg-tertiary font-medium">{item.label}</span>
                                </div>
                            ))}
                        </div>

                        <Link
                            href={`/dashboard/${gangId}/billing`}
                            className="inline-flex min-h-11 items-center gap-2 rounded-token-lg bg-accent px-4 py-2 font-bold text-accent-fg transition-colors hover:opacity-90"
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
        <div className="space-y-5 animate-fade-in">
            {/* Header */}
            <section className="ops-surface rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1">
                        <span className="h-1.5 w-1.5 rounded-token-full bg-accent" />
                        <span className="text-[10px] font-bold text-accent-bright">Operations insight</span>
                    </div>
                    <h1 className="mt-2 font-heading text-xl font-black tracking-tight text-fg-primary sm:text-2xl">สถิติแก๊ง</h1>
                    <p className="mt-1.5 hidden max-w-2xl text-sm leading-6 text-fg-secondary sm:block">
                        วิเคราะห์ {gang.name} แบบใช้งานจริง: เงินที่เสี่ยงค้าง วินัยเช็คชื่อ สมาชิกที่ต้องตาม และแนวโน้มกิจกรรมในช่วงล่าสุด
                    </p>
                    <p className="mt-1.5 text-sm leading-6 text-fg-secondary sm:hidden">
                        เงิน วินัยเช็คชื่อ สมาชิกเสี่ยง และแนวโน้มล่าสุดของ {gang.name}
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                        {[
                            { href: '#analytics-kpi', label: 'ภาพรวม', hint: 'ตัวเลขที่ต้องดูทุกวัน' },
                            { href: '#analytics-charts', label: 'แนวโน้ม', hint: 'เงินและเช็คชื่อย้อนหลัง' },
                            { href: '#analytics-risk', label: 'ความเสี่ยง', hint: 'หนี้ เครดิต และคิวลา' },
                            { href: `/dashboard/${gangId}/finance`, label: 'ไปการเงิน', hint: 'ตรวจรายการต่อทันที' },
                        ].map((link) => (
                            <a
                                key={link.href}
                                href={link.href}
                                className="min-h-11 rounded-token-lg border border-border-subtle bg-bg-elevated/80 px-3 py-2 text-left shadow-token-xs transition-colors hover:border-border-accent hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                            >
                                <span className="block text-xs font-black text-fg-primary">{link.label}</span>
                                <span className="mt-0.5 hidden truncate text-[10px] font-semibold text-fg-tertiary sm:block">{link.hint}</span>
                            </a>
                        ))}
                    </div>
                </div>
            </section>

            {/* KPI Cards */}
            <div id="analytics-kpi" className="grid scroll-mt-6 grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                <KpiCard
                    label="ยอดกองกลาง"
                    value={`฿${gang.balance.toLocaleString()}`}
                    icon={Wallet}
                    color="emerald"
                    sub="ยอดปัจจุบัน"
                />
                <KpiCard
                    label="สมาชิกใช้งาน"
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
            <section id="analytics-charts" className="scroll-mt-6">
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
            </section>

            {/* Bottom Grid: Debtors + Creditors + Leaves */}
            <div id="analytics-risk" className="grid scroll-mt-6 grid-cols-1 gap-4 lg:grid-cols-3">
                {/* Top Debtors */}
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl overflow-hidden shadow-token-sm">
                    <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-muted p-4">
                        <ArrowDownLeft className="h-4 w-4 text-fg-danger" />
                        <h3 className="font-bold text-fg-primary text-sm">สมาชิกที่มีหนี้สูงสุด</h3>
                    </div>
                    {topDebtors.length === 0 ? (
                        <div className="p-8 text-center text-fg-tertiary text-sm">ไม่มีสมาชิกที่มีหนี้</div>
                    ) : (
                        <>
                        <div className="grid gap-2.5 p-3 md:hidden">
                            {topDebtors.map((m, i) => (
                            <div key={m.id} className="rounded-token-lg border border-border-subtle bg-bg-muted/70 p-3 shadow-token-sm">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="shrink-0 text-[10px] font-mono text-fg-tertiary">#{i + 1}</span>
                                            <Avatar src={m.discordAvatar} name={m.name} alt={m.name} className="h-7 w-7" />
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
                                        <th className="px-4 py-3 text-[10px] font-bold text-fg-tertiary text-right w-12">#</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-fg-tertiary">สมาชิก</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-fg-tertiary text-right">ยอดหนี้</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {topDebtors.map((m, i) => (
                                        <tr key={m.id} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-4 py-3 text-right text-xs text-fg-tertiary font-mono">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar src={m.discordAvatar} name={m.name} alt={m.name} className="h-7 w-7" />
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
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl overflow-hidden shadow-token-sm">
                    <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-muted p-4">
                        <ArrowUpRight className="h-4 w-4 text-fg-success" />
                        <h3 className="font-bold text-fg-primary text-sm">สมาชิกยอดคงเหลือสูงสุด</h3>
                    </div>
                    {topCreditors.length === 0 ? (
                        <div className="p-8 text-center text-fg-tertiary text-sm">ไม่มีข้อมูล</div>
                    ) : (
                        <>
                        <div className="grid gap-2.5 p-3 md:hidden">
                            {topCreditors.map((m, i) => (
                                <div key={m.id} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-3 shadow-token-sm">
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="shrink-0 text-[10px] font-mono text-fg-tertiary">#{i + 1}</span>
                                            <Avatar src={m.discordAvatar} name={m.name} alt={m.name} className="h-7 w-7" />
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
                                        <th className="px-4 py-3 text-[10px] font-bold text-fg-tertiary text-right w-12">#</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-fg-tertiary">สมาชิก</th>
                                        <th className="px-4 py-3 text-[10px] font-bold text-fg-tertiary text-right">เครดิต</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {topCreditors.map((m, i) => (
                                        <tr key={m.id} className="hover:bg-bg-muted transition-colors">
                                            <td className="px-4 py-3 text-right text-xs text-fg-tertiary font-mono">{i + 1}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <Avatar src={m.discordAvatar} name={m.name} alt={m.name} className="h-7 w-7" />
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
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl overflow-hidden shadow-token-sm">
                    <div className="flex items-center gap-2 border-b border-border-subtle bg-bg-muted p-4">
                        <Clock className="h-4 w-4 text-fg-warning" />
                        <h3 className="font-bold text-fg-primary text-sm">สถิติการลา</h3>
                    </div>
                    <div className="space-y-4 p-4">
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
        <div className="group rounded-token-xl border border-border-subtle bg-bg-subtle p-3.5 shadow-token-sm transition-colors hover:border-border sm:p-4">
            <div className="relative z-10">
                <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-token-lg ${c.icon} ${c.glow} sm:h-8 sm:w-8`}>
                    <Icon className="h-3.5 w-3.5 text-fg-inverse sm:h-4 sm:w-4" />
                </div>
                <div className="mb-1 text-[10px] font-bold text-fg-tertiary">{label}</div>
                <div className="text-lg font-black tracking-tight text-fg-primary tabular-nums sm:text-xl">{value}</div>
                <div className="mt-1 truncate text-[10px] text-fg-tertiary">{sub}</div>
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
                    className={`h-full ${colorMap[color] || 'bg-fg-tertiary'} rounded-token-full transition-[width] duration-700`}
                    style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%` }}
                />
            </div>
        </div>
    );
}
