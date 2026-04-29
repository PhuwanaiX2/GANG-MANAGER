export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, transactions, members, financeCollectionBatches, financeCollectionMembers, canAccessFeature, getTierConfig, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq, desc, and, count, sql } from 'drizzle-orm';
import {
    Wallet,
    ArrowUpRight,
    ArrowDownLeft,
    AlertTriangle,
    History,
    Clock,
    Lock,
    Zap,
    Banknote
} from 'lucide-react';
import Link from 'next/link';
import { AutoRefresh } from '@/components/AutoRefresh';

import { getGangPermissionFlagsForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { TransactionTable } from './TransactionTable';
import { FinanceClient } from './FinanceClient';
import { LoanRequestList } from './LoanRequestList';
import { FinanceTabs } from './FinanceTabs';
import { GangFeeDebtsClient } from './GangFeeDebtsClient';
import { SummaryClient } from './SummaryClient';
import { groupRecentFinanceTransactions } from '@/lib/financeTransactions';
import { PAYMENT_PAUSED_COPY } from '@/lib/paymentReadiness';

interface Props {
    params: Promise<{ gangId: string }>;
    searchParams: Promise<{ page?: string; tab?: string; range?: string }>;
}

export default async function FinancePage(props: Props) {
    const searchParams = await props.searchParams;
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;
    const tab = searchParams.tab || 'overview';
    const summaryRange = ['3', '6', '12', 'all'].includes(searchParams.range || '') ? searchParams.range! : '6';

    // Global feature flag check
    const financeEnabled = await isFeatureEnabled('finance');
    if (!financeEnabled) {
        return (
            <>
                <FeatureDisabledBanner featureName="ระบบการเงิน" />
            </>
        );
    }

    // Pagination for History Tab
    const page = Number(searchParams.page) || 1;
    const ITEMS_PER_PAGE = 20;
    const offset = (page - 1) * ITEMS_PER_PAGE;

    // Check Permissions (OWNER or TREASURER)
    const permissions = await getGangPermissionFlagsForDiscordId({ gangId, discordId: session.user.discordId });
    if (!permissions.isOwner && !permissions.isTreasurer) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-status-danger-subtle rounded-token-full flex items-center justify-center mb-4 border border-status-danger">
                    <AlertTriangle className="w-8 h-8 text-fg-danger" />
                </div>
                <h1 className="text-2xl font-bold text-fg-primary mb-2 font-heading tracking-tight">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-fg-secondary max-w-md text-sm">
                    เฉพาะหัวหน้าแก๊ง หรือ เหรัญญิก เท่านั้น
                    <br />ที่สามารถจัดการการเงินได้
                </p>
            </div>
        );
    }

    // Common Data
    const [gang, activeMembers] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { balance: true, subscriptionTier: true, subscriptionExpiresAt: true }
        }),
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true },
            orderBy: desc(members.name),
        })
    ]);

    if (!gang) redirect('/dashboard');
    const balance = gang.balance || 0;
    const tier = resolveEffectiveSubscriptionTier(gang.subscriptionTier || 'FREE', gang.subscriptionExpiresAt);
    const hasFinance = canAccessFeature(tier, 'finance');
    const hasExportCSV = canAccessFeature(tier, 'exportCSV');
    const hasMonthlySummary = canAccessFeature(tier, 'monthlySummary');
    const tierConfig = getTierConfig(tier);

    if (!hasFinance) {
        return (
            <div className="animate-fade-in space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-fg-primary font-heading mb-3">การเงิน</h1>
                        <FinanceTabs />
                    </div>
                    <FinanceClient gangId={gangId} members={activeMembers} hasFinance={false} hasExportCSV={hasExportCSV} />
                </div>

                <div data-testid="finance-locked-banner" className="bg-status-warning-subtle border border-status-warning rounded-token-2xl p-6 flex items-start gap-4 shadow-token-sm">
                    <div className="p-2 bg-bg-elevated rounded-token-xl shrink-0 border border-border-subtle">
                        <Lock className="w-5 h-5 text-fg-warning" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-fg-warning mb-1">ฟีเจอร์การเงินอยู่ในแพลน Premium</h3>
                        <p className="text-sm text-fg-secondary mb-4">แพลนปัจจุบัน: <strong className="text-fg-primary">{tierConfig.name}</strong> — {PAYMENT_PAUSED_COPY.lockedFeature}</p>
                        <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-2 px-4 py-2 bg-status-warning hover:brightness-110 text-fg-inverse text-xs font-bold rounded-token-xl transition-all shadow-token-sm">
                            <Zap className="w-4 h-4" /> {PAYMENT_PAUSED_COPY.detailsActionLabel}
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    // --- Overview Data Fetching ---
    let overviewData = null;
    if (tab === 'overview') {
        const [incomeResult, expenseResult, pendingRequests, recentApproved, gangFeeDebts] = await Promise.all([
            // Calculate Total Income (Aggregated)
            db.select({ sum: sql<number>`sum(${transactions.amount})` })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED'),
                    sql`${transactions.type} IN ('INCOME', 'REPAYMENT', 'DEPOSIT')`
                )),
            // Calculate Total Expense (Aggregated)
            db.select({ sum: sql<number>`sum(${transactions.amount})` })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED'),
                    sql`${transactions.type} IN ('EXPENSE', 'LOAN')`
                )),
            // Pending Requests
            db.query.transactions.findMany({
                where: and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'PENDING')
                ),
                orderBy: desc(transactions.createdAt),
                with: { member: true, createdBy: true },
            }),
            // Recent approved transactions for mini-history
            db.query.transactions.findMany({
                where: and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.status, 'APPROVED')
                ),
                orderBy: desc(transactions.approvedAt),
                limit: 30,
                with: { member: true },
            }),

            // Unsettled gang fee debts
            db.query.financeCollectionMembers.findMany({
                where: and(
                    eq(financeCollectionMembers.gangId, gangId),
                    sql`${financeCollectionMembers.status} IN ('OPEN', 'PARTIAL')`
                ),
                orderBy: desc(financeCollectionMembers.createdAt),
                limit: 50,
                with: {
                    member: true,
                    batch: {
                        columns: {
                            id: true,
                            description: true,
                            totalMembers: true,
                            createdAt: true,
                        }
                    }
                },
            }),
        ]);

        // Build batch member count map
        const batchMemberCounts: Record<string, number> = {};
        for (const row of gangFeeDebts as any[]) {
            if (row.batch?.id && typeof row.batch?.totalMembers === 'number') {
                batchMemberCounts[row.batch.id] = row.batch.totalMembers;
            }
        }

        overviewData = {
            income: incomeResult[0]?.sum || 0,
            expense: expenseResult[0]?.sum || 0,
            pendingRequests,
            recentApproved,
            gangFeeDebts,
            batchMemberCounts,
        };
    }

    const groupedRecentApproved = overviewData?.recentApproved
        ? groupRecentFinanceTransactions(overviewData.recentApproved as any[], 8)
        : [];
    const openCollectionDueTotal = overviewData?.gangFeeDebts
        ? (overviewData.gangFeeDebts as any[]).reduce((sum, row) => {
            const remaining = Math.max(
                0,
                (Number(row.amountDue) || 0)
                - (Number(row.amountCredited) || 0)
                - (Number(row.amountSettled) || 0)
                - (Number(row.amountWaived) || 0)
            );
            return sum + remaining;
        }, 0)
        : null;
    const pendingRequestCount = overviewData?.pendingRequests?.length ?? null;

    // --- History Data Fetching ---
    let historyData = null;
    if (tab === 'history') {
        const [historyTransactions, totalTransactionsResult] = await Promise.all([
            db.query.transactions.findMany({
                where: and(
                    eq(transactions.gangId, gangId),
                    sql`${transactions.status} != 'PENDING'`,
                    sql`${transactions.status} != 'REJECTED'`
                ),
                orderBy: desc(transactions.approvedAt),
                limit: ITEMS_PER_PAGE,
                offset: offset,
                with: { member: true, createdBy: true },
            }),
            db.select({ count: count() })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    sql`${transactions.status} != 'PENDING'`,
                    sql`${transactions.status} != 'REJECTED'`
                ))
        ]);

        const totalTransactions = totalTransactionsResult[0]?.count || 0;
        historyData = {
            transactions: historyTransactions,
            totalPages: Math.ceil(totalTransactions / ITEMS_PER_PAGE),
            totalItems: totalTransactions
        };
    }

    // --- Summary Data Fetching ---
    let summaryData = null;
    if (tab === 'summary') {
        const [monthlySummaryRaw, monthlyCollectionRaw, memberRows, loanSummaryRaw, collectionDueRaw] = await Promise.all([
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
                    ...(summaryRange !== 'all' ? [sql`${transactions.createdAt} >= date('now', '-${sql.raw(summaryRange)} months')`] : [])
                ))
                .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
                .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`),

            db.select({
                month: sql<string>`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`,
                totalDue: sql<number>`COALESCE(sum(${financeCollectionBatches.totalAmountDue}), 0)`,
            })
                .from(financeCollectionBatches)
                .where(and(
                    eq(financeCollectionBatches.gangId, gangId),
                    ...(summaryRange !== 'all' ? [sql`${financeCollectionBatches.createdAt} >= date('now', '-${sql.raw(summaryRange)} months')`] : [])
                ))
                .groupBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`)
                .orderBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`),

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
                .where(eq(financeCollectionMembers.gangId, gangId))
                .groupBy(financeCollectionMembers.memberId),
        ]);

        // Reshape monthly data
        const monthlyMap = new Map<string, { month: string; income: number; expense: number; loan: number; repayment: number; penalty: number; deposit: number; gangFee: number; txCount: number }>();
        for (const row of monthlySummaryRaw) {
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

        for (const row of monthlyCollectionRaw) {
            const month = row.month;
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, { month, income: 0, expense: 0, loan: 0, repayment: 0, penalty: 0, deposit: 0, gangFee: 0, txCount: 0 });
            }
            monthlyMap.get(month)!.gangFee = Number(row.totalDue) || 0;
        }

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

        const topMembers = memberRows
            .map((member) => {
                const loan = loanMap.get(member.id)?.loan || 0;
                const repayment = loanMap.get(member.id)?.repayment || 0;
                const loanDebt = Math.max(0, loan - repayment);
                const collectionDue = collectionDueMap.get(member.id) || 0;
                return {
                    ...member,
                    loanDebt,
                    collectionDue,
                };
            })
            .filter((member) => member.balance !== 0 || member.loanDebt > 0 || member.collectionDue > 0)
            .sort((a, b) => Math.max(Math.abs(b.balance), b.loanDebt + b.collectionDue) - Math.max(Math.abs(a.balance), a.loanDebt + a.collectionDue))
            .slice(0, 50);

        summaryData = {
            months: Array.from(monthlyMap.values()),
            topMembers,
        };
    }

    return (
        <div className="animate-fade-in space-y-6">
            <AutoRefresh interval={30} />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-fg-primary font-heading mb-3">การเงิน</h1>
                    <FinanceTabs />
                </div>
                <FinanceClient gangId={gangId} members={activeMembers} hasFinance={hasFinance} hasExportCSV={hasExportCSV} />
            </div>

            <FinanceLedgerGuide
                balance={balance}
                openCollectionDueTotal={openCollectionDueTotal}
                pendingRequestCount={pendingRequestCount}
            />

            {/* Tier Gate Banner */}
            {!hasFinance && (
                <div className="bg-status-warning-subtle border border-status-warning rounded-token-2xl p-6 flex items-start gap-4 shadow-token-sm">
                    <div className="p-2 bg-bg-elevated rounded-token-xl shrink-0 border border-border-subtle">
                        <Lock className="w-5 h-5 text-fg-warning" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-fg-warning mb-1">ฟีเจอร์การเงินอยู่ในแพลน Premium</h3>
                        <p className="text-sm text-fg-secondary mb-4">แพลนปัจจุบัน: <strong className="text-fg-primary">{tierConfig.name}</strong> — {PAYMENT_PAUSED_COPY.lockedFeature}</p>
                        <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-2 px-4 py-2 bg-status-warning hover:brightness-110 text-fg-inverse text-xs font-bold rounded-token-xl transition-all shadow-token-sm">
                            <Zap className="w-4 h-4" /> {PAYMENT_PAUSED_COPY.detailsActionLabel}
                        </a>
                    </div>
                </div>
            )}

            {/* Overview Tab Content */}
            {tab === 'overview' && overviewData && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Income Card */}
                        <div className="bg-bg-subtle border border-border-subtle p-6 rounded-token-2xl relative overflow-hidden group hover:border-status-success transition-all shadow-token-sm">
                            <div className="text-fg-tertiary text-xs font-semibold tracking-wide uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-token-lg bg-status-success-subtle text-fg-success">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                                Income Total
                            </div>
                            <div className="text-3xl font-bold text-fg-success tracking-tight">
                                +฿{overviewData.income.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-fg-tertiary">รายรับสะสมที่เข้ากองกลางจริง (รวมชำระหนี้ยืมและชำระค่าเก็บเงินแก๊ง/ฝากเครดิต)</div>
                        </div>

                        {/* Expense Card */}
                        <div className="bg-bg-subtle border border-border-subtle p-6 rounded-token-2xl relative overflow-hidden group hover:border-status-danger transition-all shadow-token-sm">
                            <div className="text-fg-tertiary text-xs font-semibold tracking-wide uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-token-lg bg-status-danger-subtle text-fg-danger">
                                    <ArrowDownLeft className="w-4 h-4" />
                                </div>
                                Expense Total
                            </div>
                            <div className="text-3xl font-bold text-fg-danger tracking-tight">
                                -฿{overviewData.expense.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-fg-tertiary">รายจ่ายสะสมทั้งหมด</div>
                        </div>

                        {/* Net Balance Card */}
                        <div className="bg-gradient-to-br from-bg-elevated to-bg-subtle border border-border-subtle p-6 rounded-token-2xl relative overflow-hidden group shadow-token-sm sm:col-span-2 lg:col-span-1">
                            <div className="absolute -top-6 -right-6 p-8 opacity-20 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500">
                                <Wallet className="w-24 h-24 text-fg-tertiary" />
                            </div>
                            <div className="text-fg-tertiary text-xs font-semibold tracking-wide uppercase mb-3 flex items-center gap-2 relative z-10">
                                <div className="p-1.5 rounded-token-lg bg-bg-muted text-fg-primary backdrop-blur-sm border border-border-subtle">
                                    <Wallet className="w-4 h-4" />
                                </div>
                                Net Balance
                            </div>
                            <div className="text-4xl font-bold tracking-tight text-fg-primary relative z-10">
                                ฿{balance.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-fg-tertiary relative z-10">ยอดคงเหลือในแก๊งปัจจุบัน</div>
                        </div>
                    </div>

                    {/* Pending Requests + Recent Transactions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <LoanRequestList gangId={gangId} requests={overviewData.pendingRequests} />

                        {/* Recent Transactions */}
                        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm flex flex-col">
                            <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-fg-tertiary" />
                                    <h3 className="font-semibold text-fg-primary tracking-wide font-heading">ธุรกรรมล่าสุด</h3>
                                </div>
                                <Link
                                    href={`/dashboard/${gangId}/finance?tab=history`}
                                    className="text-xs text-fg-tertiary hover:text-fg-primary transition-colors font-medium tracking-wide"
                                >
                                    ดูทั้งหมด →
                                </Link>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {groupedRecentApproved && groupedRecentApproved.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-[620px] w-full text-left">
                                            <thead className="bg-bg-muted border-b border-border-subtle">
                                                <tr>
                                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รายการ</th>
                                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary whitespace-nowrap">วันที่</th>
                                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">จำนวน</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-subtle">
                                                {groupedRecentApproved.map((t: any) => {
                                                    const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type);
                                                    const isDueOnly = t.type === 'GANG_FEE';
                                                    const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                                    return (
                                                        <tr key={t.id} className="hover:bg-bg-muted transition-colors">
                                                            <td className="px-4 py-3 align-middle">
                                                                <div className="flex items-center gap-3 min-w-0">
                                                                    <div className={`shrink-0 p-1.5 rounded-token-lg border ${isDueOnly ? 'bg-accent-subtle text-accent-bright border-border-accent' : isIncome ? 'bg-status-success-subtle text-fg-success border-status-success' : 'bg-status-danger-subtle text-fg-danger border-status-danger'}`}>
                                                                        {isDueOnly ? <Banknote className="w-4 h-4" /> : isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                                                    </div>
                                                                    <div className="min-w-0">
                                                                        <div className="text-sm font-semibold text-fg-primary truncate">
                                                                            {t.type === 'GANG_FEE' && t.__batchCount
                                                                                ? `ตั้งยอดเก็บเงินแก๊ง: ${t.__batchCount} คน`
                                                                                : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(t.type)
                                                                                    ? `${t.member?.name || '-'} ${t.type === 'LOAN' ? 'ยืมจากกองกลาง' : t.type === 'REPAYMENT' ? 'ชำระหนี้ยืม' : t.type === 'DEPOSIT' ? 'ชำระค่าเก็บเงินแก๊ง/ฝากเครดิต' : 'ค่าปรับ'}`
                                                                                    : t.description
                                                                            }
                                                                        </div>
                                                                        {isDueOnly && (
                                                                            <div className="text-[11px] text-accent-bright mt-0.5 opacity-80 truncate">ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง</div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-fg-tertiary">
                                                                {effectiveAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-3 align-middle text-right whitespace-nowrap">
                                                                <span className={`font-semibold text-sm tracking-wide ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                                    {isDueOnly ? `฿${Math.abs(t.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-fg-tertiary space-y-3">
                                        <Banknote className="w-8 h-8 opacity-20" />
                                        <p className="text-sm">ยังไม่มีธุรกรรม</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div>
                        <GangFeeDebtsClient
                            gangId={gangId}
                            debts={(overviewData.gangFeeDebts || []).map((row: any) => ({
                                memberId: row.memberId,
                                memberName: row.member?.name || '-',
                                batchId: row.batchId || row.batch?.id || '-',
                                description: row.batch?.description || 'ตั้งยอดเก็บเงินแก๊ง',
                                amount: Math.max(0, (Number(row.amountDue) || 0) - (Number(row.amountCredited) || 0) - (Number(row.amountSettled) || 0) - (Number(row.amountWaived) || 0)),
                                createdAt: row.batch?.createdAt || row.createdAt,
                            }))}
                            totalMembersInBatch={overviewData.batchMemberCounts || {}}
                        />
                    </div>
                </div>
            )}

            {/* History Tab Content */}
            {tab === 'history' && historyData && (
                <div className="animate-fade-in-up">
                    <TransactionTable
                        transactions={historyData.transactions}
                        currentPage={page}
                        totalPages={historyData.totalPages}
                        totalItems={historyData.totalItems}
                        itemsPerPage={ITEMS_PER_PAGE}
                    />
                </div>
            )}

            {/* Summary Tab Content */}
            {tab === 'summary' && !hasMonthlySummary && (
                <div className="bg-bg-subtle border border-border-accent rounded-token-2xl p-10 text-center flex flex-col items-center justify-center border-dashed shadow-token-sm">
                    <div className="w-16 h-16 bg-accent-subtle rounded-token-full flex items-center justify-center mb-5 border border-border-accent">
                        <Lock className="w-8 h-8 text-accent-bright" />
                    </div>
                    <h3 className="font-bold text-fg-primary text-xl mb-2 font-heading tracking-tight">สรุปรายเดือนอยู่ในแพลน Premium</h3>
                    <p className="text-sm text-fg-secondary mb-6 max-w-md">แพลนปัจจุบัน: <strong className="text-fg-primary">{tierConfig.name}</strong> — {PAYMENT_PAUSED_COPY.lockedFeature}</p>
                    <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-fg hover:bg-accent-hover text-sm font-semibold rounded-token-xl transition-colors shadow-token-sm">
                        <Zap className="w-4 h-4" /> {PAYMENT_PAUSED_COPY.detailsActionLabel}
                    </a>
                </div>
            )}
            {tab === 'summary' && hasMonthlySummary && summaryData && (
                <SummaryClient months={summaryData.months} topMembers={summaryData.topMembers} currentRange={summaryRange} />
            )}
        </div>
    );
}

function FinanceLedgerGuide({
    balance,
    openCollectionDueTotal,
    pendingRequestCount,
}: {
    balance: number;
    openCollectionDueTotal: number | null;
    pendingRequestCount: number | null;
}) {
    const cards = [
        {
            title: 'เงินกองกลางจริง',
            value: `฿${balance.toLocaleString()}`,
            tone: 'success',
            icon: Wallet,
            body: 'เงินที่อนุมัติแล้วและอยู่ในยอดแก๊งตอนนี้ ใช้แยกจากยอดค้างเก็บและเครดิตสมาชิก',
        },
        {
            title: 'ยอดค้างเก็บ',
            value: openCollectionDueTotal === null ? 'ดูในภาพรวม' : `฿${openCollectionDueTotal.toLocaleString()}`,
            tone: 'warning',
            icon: Banknote,
            body: 'GANG_FEE เป็นยอดที่ตั้งให้สมาชิกจ่าย ยังไม่ใช่เงินเข้าแก๊งจนกว่าจะมีการชำระจริง',
        },
        {
            title: 'เครดิตสมาชิก',
            value: 'หักยอดได้',
            tone: 'info',
            icon: ArrowUpRight,
            body: 'เงินที่สมาชิกจ่ายไว้เกินหรือฝากไว้ก่อน สามารถถูกใช้เป็น pre-credit เพื่อลดค้างเก็บรอบถัดไป',
        },
        {
            title: 'คำขอรอตรวจ',
            value: pendingRequestCount === null ? 'ดูรายการ' : `${pendingRequestCount} รายการ`,
            tone: 'danger',
            icon: Clock,
            body: 'รายการ Pending ยังไม่กระทบยอดจริงจนกว่า Owner หรือ Treasurer จะอนุมัติ',
        },
    ];

    const toneClass: Record<string, { box: string; icon: string; text: string }> = {
        success: { box: 'bg-status-success-subtle border-status-success', icon: 'text-fg-success', text: 'text-fg-success' },
        warning: { box: 'bg-status-warning-subtle border-status-warning', icon: 'text-fg-warning', text: 'text-fg-warning' },
        info: { box: 'bg-status-info-subtle border-status-info', icon: 'text-fg-info', text: 'text-fg-info' },
        danger: { box: 'bg-status-danger-subtle border-status-danger', icon: 'text-fg-danger', text: 'text-fg-danger' },
    };

    return (
        <section className="rounded-token-3xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between mb-5">
                <div>
                    <div className="inline-flex items-center gap-2 rounded-token-full border border-border-accent bg-accent-subtle px-3 py-1 text-[10px] font-black uppercase tracking-widest text-accent-bright">
                        Finance Ledger Map
                    </div>
                    <h2 className="mt-3 text-xl font-black tracking-tight text-fg-primary font-heading">อ่านเงินในระบบยังไง</h2>
                    <p className="mt-1 text-sm text-fg-secondary">
                        หน้านี้แยกเงินสดจริง, ยอดค้างเก็บ, เครดิตสมาชิก และคำขอรอตรวจออกจากกัน เพื่อให้ยอดที่ถูกต้องไม่ดูเหมือนบั๊ก
                    </p>
                </div>
                <p className="max-w-sm text-xs text-fg-tertiary">
                    กฎสำคัญ: ยอดค้างเก็บไม่เพิ่มเงินกองกลางทันที และเครดิตที่ใช้หักค้างเก็บคือเงินที่เคยเข้า/ถูกบันทึกไว้ก่อนแล้ว
                </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {cards.map((card) => {
                    const Icon = card.icon;
                    const tone = toneClass[card.tone];
                    return (
                        <div key={card.title} className={`rounded-token-2xl border p-4 ${tone.box}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">{card.title}</p>
                                    <p className={`mt-2 text-2xl font-black tracking-tight tabular-nums ${tone.text}`}>{card.value}</p>
                                </div>
                                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2">
                                    <Icon className={`h-4 w-4 ${tone.icon}`} />
                                </div>
                            </div>
                            <p className="mt-3 text-xs leading-relaxed text-fg-secondary">{card.body}</p>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
