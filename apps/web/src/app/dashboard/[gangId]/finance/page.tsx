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
    const [gang, pendingRequestCountResult, openDueTotalResult, financeMemberOptions] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { balance: true, subscriptionTier: true, subscriptionExpiresAt: true }
        }),
        db.select({ count: count() })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'PENDING')
            )),
        db.select({
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                sql`${financeCollectionMembers.status} IN ('OPEN', 'PARTIAL')`
            )),
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true },
        }),
    ]);

    if (!gang) redirect('/dashboard');
    const balance = gang.balance || 0;
    const tier = resolveEffectiveSubscriptionTier(gang.subscriptionTier || 'FREE', gang.subscriptionExpiresAt);
    const hasFinance = canAccessFeature(tier, 'finance');
    const hasExportCSV = canAccessFeature(tier, 'exportCSV');
    const hasMonthlySummary = canAccessFeature(tier, 'monthlySummary');
    const tierConfig = getTierConfig(tier);
    const basePendingRequestCount = Number(pendingRequestCountResult[0]?.count || 0);
    const baseOpenCollectionDueTotal = Number(openDueTotalResult[0]?.total || 0);

    if (!hasFinance) {
        return (
            <div className="animate-fade-in space-y-6">
                <FinanceCommandHeader
                    gangId={gangId}
                    hasFinance={false}
                    hasExportCSV={hasExportCSV}
                    balance={balance}
                    openCollectionDueTotal={null}
                    pendingRequestCount={null}
                    tierName={tierConfig.name}
                    memberOptions={financeMemberOptions}
                />

                <div data-testid="finance-locked-banner" className="bg-status-warning-subtle border border-status-warning rounded-token-2xl p-6 flex items-start gap-4 shadow-token-sm">
                    <div className="p-2 bg-bg-elevated rounded-token-xl shrink-0 border border-border-subtle">
                        <Lock className="w-5 h-5 text-fg-warning" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-fg-warning mb-1">ฟีเจอร์การเงินอยู่ในแพลน Premium</h3>
                        <p className="text-sm text-fg-secondary mb-4">แพลนปัจจุบัน: <strong className="text-fg-primary">{tierConfig.name}</strong> — {PAYMENT_PAUSED_COPY.lockedFeature}</p>
                        <a href={`/dashboard/${gangId}/billing`} className="inline-flex items-center gap-2 px-4 py-2 bg-status-warning hover:brightness-110 text-fg-inverse text-xs font-bold rounded-token-xl transition-all shadow-token-sm">
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
        const [pendingRequests, recentApproved, gangFeeDebts] = await Promise.all([
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
            pendingRequests,
            recentApproved,
            gangFeeDebts,
            batchMemberCounts,
        };
    }

    const groupedRecentApproved = overviewData?.recentApproved
        ? groupRecentFinanceTransactions(overviewData.recentApproved as any[], 8)
        : [];
    const openCollectionDueTotal = baseOpenCollectionDueTotal;
    const pendingRequestCount = basePendingRequestCount;

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
            <FinanceCommandHeader
                gangId={gangId}
                hasFinance={hasFinance}
                hasExportCSV={hasExportCSV}
                balance={balance}
                openCollectionDueTotal={openCollectionDueTotal}
                pendingRequestCount={pendingRequestCount}
                tierName={tierConfig.name}
                memberOptions={financeMemberOptions}
            />

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
                        <a href={`/dashboard/${gangId}/billing`} className="inline-flex items-center gap-2 px-4 py-2 bg-status-warning hover:brightness-110 text-fg-inverse text-xs font-bold rounded-token-xl transition-all shadow-token-sm">
                            <Zap className="w-4 h-4" /> {PAYMENT_PAUSED_COPY.detailsActionLabel}
                        </a>
                    </div>
                </div>
            )}

            {/* Overview Tab Content */}
            {tab === 'overview' && overviewData && (
                <div id="finance-overview" className="space-y-4 scroll-mt-6">
                    {/* Pending Requests + Recent Transactions */}
                    <div id="finance-pending" className={`grid grid-cols-1 gap-4 scroll-mt-6 ${(overviewData.pendingRequests || []).length > 0 ? 'lg:grid-cols-2' : ''}`}>
                        <LoanRequestList gangId={gangId} requests={overviewData.pendingRequests} />

                        {/* Recent Transactions */}
                        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm flex flex-col">
                            <div className="p-4 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
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
                                    <>
                                    <div className="grid gap-3 p-4 md:hidden">
                                        {groupedRecentApproved.map((t: any) => {
                                            const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type);
                                            const isDueOnly = t.type === 'GANG_FEE';
                                            const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                            const title = t.type === 'GANG_FEE' && t.__batchCount
                                                ? `ตั้งยอดเก็บเงินแก๊ง: ${t.__batchCount} คน`
                                                : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(t.type)
                                                    ? `${t.member?.name || '-'} ${t.type === 'LOAN' ? 'ยืมจากกองกลาง' : t.type === 'REPAYMENT' ? 'ชำระหนี้ยืม' : t.type === 'DEPOSIT' ? 'ชำระค่าเก็บเงินแก๊ง/ฝากเครดิต' : 'ค่าปรับ'}`
                                                    : t.description;

                                            return (
                                                <div key={t.id} className="rounded-token-xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`shrink-0 rounded-token-lg border p-2 ${isDueOnly ? 'bg-accent-subtle text-accent-bright border-border-accent' : isIncome ? 'bg-status-success-subtle text-fg-success border-status-success' : 'bg-status-danger-subtle text-fg-danger border-status-danger'}`}>
                                                            {isDueOnly ? <Banknote className="h-4 w-4" /> : isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <p className="line-clamp-2 text-sm font-bold text-fg-primary">{title}</p>
                                                                <span className={`shrink-0 text-sm font-black tabular-nums ${isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger'}`}>
                                                                    {isDueOnly ? `฿${Math.abs(t.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                                                </span>
                                                            </div>
                                                            <p className="mt-1 text-xs text-fg-tertiary tabular-nums">
                                                                {effectiveAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </p>
                                                            {isDueOnly && (
                                                                <p className="mt-2 text-[11px] text-accent-bright/80">ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="hidden overflow-x-auto md:block">
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
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-fg-tertiary space-y-3">
                                        <Banknote className="w-8 h-8 opacity-20" />
                                        <p className="text-sm">ยังไม่มีธุรกรรม</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div id="finance-debts" className="scroll-mt-6">
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
                    <a href={`/dashboard/${gangId}/billing`} className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-accent-fg hover:bg-accent-hover text-sm font-semibold rounded-token-xl transition-colors shadow-token-sm">
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

function FinanceCommandHeader({
    gangId,
    hasFinance,
    hasExportCSV,
    balance,
    openCollectionDueTotal,
    pendingRequestCount,
    tierName,
    memberOptions,
}: {
    gangId: string;
    hasFinance: boolean;
    hasExportCSV: boolean;
    balance: number;
    openCollectionDueTotal: number | null;
    pendingRequestCount: number | null;
    tierName: string;
    memberOptions: Array<{ id: string; name: string }>;
}) {
    const statCards = [
        {
            label: 'เงินกองกลางจริง',
            value: `฿${balance.toLocaleString()}`,
            hint: 'อนุมัติแล้ว',
            icon: Wallet,
            accent: 'text-fg-success',
            bar: 'bg-status-success',
        },
        {
            label: 'ค้างเก็บ',
            value: openCollectionDueTotal === null ? '-' : `฿${openCollectionDueTotal.toLocaleString()}`,
            hint: 'ยังไม่ใช่เงินเข้า',
            icon: Banknote,
            accent: 'text-fg-warning',
            bar: 'bg-status-warning',
        },
        {
            label: 'รอตรวจ',
            value: pendingRequestCount === null ? '-' : pendingRequestCount.toLocaleString(),
            hint: 'รออนุมัติ',
            icon: Clock,
            accent: pendingRequestCount ? 'text-fg-danger' : 'text-fg-tertiary',
            bar: pendingRequestCount ? 'bg-status-danger' : 'bg-bg-muted',
        },
        {
            label: 'แพลน',
            value: tierName,
            hint: hasFinance ? 'ใช้งานได้' : 'ล็อกฟีเจอร์',
            icon: Zap,
            accent: hasFinance ? 'text-accent-bright' : 'text-fg-tertiary',
            bar: hasFinance ? 'bg-accent' : 'bg-bg-muted',
        },
    ];
    const quickLinks = [
        {
            href: '#finance-pending',
            label: 'ตรวจคำขอ',
            hint: pendingRequestCount === null ? 'คิวรอตรวจ' : `${pendingRequestCount} รายการ`,
        },
        {
            href: '#finance-debts',
            label: 'คนค้างเงิน',
            hint: openCollectionDueTotal === null ? 'ดูยอดค้าง' : `฿${openCollectionDueTotal.toLocaleString()}`,
        },
        {
            href: `/dashboard/${gangId}/finance?tab=history`,
            label: 'ประวัติ',
            hint: 'รายการที่อนุมัติแล้ว',
        },
        {
            href: `/dashboard/${gangId}/finance?tab=summary`,
            label: 'สรุป',
            hint: 'แนวโน้มและคนเสี่ยง',
        },
    ];

    return (
        <section className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle/95 shadow-token-sm">
            <div className="grid gap-3 p-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-5">
                <div className="min-w-0 space-y-2.5 sm:space-y-3">
                    <div className="inline-flex w-fit items-center gap-2 rounded-token-full border border-border-subtle bg-bg-elevated px-3 py-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary shadow-token-xs">
                        Finance Control
                    </div>
                    <div>
                        <h1 className="font-heading text-xl font-black tracking-tight text-fg-primary sm:text-3xl">การเงินแก๊ง</h1>
                        <p className="sr-only">
                            ดูยอดจริง คำขอรอตรวจ และยอดค้างเก็บโดยไม่ปนกัน ค้างเก็บจะไม่ถูกนับเป็นเงินเข้าแก๊งจนกว่าจะชำระจริง
                        </p>
                    </div>
                    <FinanceTabs />
                </div>

                <FinanceClient gangId={gangId} initialMembers={memberOptions} hasFinance={hasFinance} hasExportCSV={hasExportCSV} />
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border-subtle bg-bg-muted/50 p-2.5 sm:p-3 xl:grid-cols-4">
                {statCards.map((card) => {
                    const Icon = card.icon;
                    return (
                        <div key={card.label} className="relative min-h-[74px] overflow-hidden rounded-token-xl border border-border-subtle bg-bg-elevated px-3 py-2.5 shadow-token-xs sm:min-h-[82px] sm:py-3">
                            <div className={`absolute inset-y-3 left-0 w-0.5 rounded-r-token-full ${card.bar}`} />
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">{card.label}</p>
                                    <p className={`mt-1 truncate text-lg font-black tracking-tight tabular-nums sm:text-xl ${card.accent}`}>{card.value}</p>
                                    <p className="mt-0.5 truncate text-[11px] font-semibold text-fg-tertiary">{card.hint}</p>
                                </div>
                                <div className="hidden rounded-token-lg border border-border-subtle bg-bg-muted/80 p-2 text-fg-tertiary sm:flex">
                                    <Icon className="h-4 w-4" />
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="hidden gap-2 overflow-x-auto border-t border-border-subtle bg-bg-subtle px-3 py-3 sm:flex">
                {quickLinks.map((link) => (
                    <a
                        key={link.href}
                        href={link.href}
                        className="inline-flex min-h-10 min-w-fit items-center gap-2 rounded-token-xl border border-border-subtle bg-bg-elevated px-3 text-xs font-black text-fg-secondary shadow-token-xs transition-colors hover:border-border hover:bg-bg-muted hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                        <span>{link.label}</span>
                        <span className="hidden rounded-token-full bg-bg-muted px-2 py-0.5 text-[10px] font-black text-fg-tertiary ring-1 ring-border-subtle sm:inline-flex">{link.hint}</span>
                    </a>
                ))}
            </div>
        </section>
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
    return (
        <section className="hidden rounded-token-xl border border-border-subtle bg-bg-muted/80 px-4 py-3 shadow-token-xs sm:block">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle p-2 text-fg-secondary">
                        <Banknote className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-widest text-fg-tertiary">Ledger Rule</p>
                        <p className="mt-0.5 text-sm font-bold text-fg-primary">กฎหลัก: ค้างเก็บยังไม่ใช่เงินเข้า</p>
                        <p className="mt-1 hidden text-xs leading-5 text-fg-tertiary sm:block">ยอดที่ตั้งให้สมาชิกจ่ายเป็นคิวเก็บเงินเท่านั้น เงินกองกลางจริงคือรายการที่อนุมัติและชำระแล้ว</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs sm:min-w-[520px]">
                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-fg-tertiary">จริง</span>
                        <span className="mt-1 block truncate font-black text-fg-success tabular-nums">฿{balance.toLocaleString()}</span>
                    </div>
                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ค้าง</span>
                        <span className="mt-1 block truncate font-black text-fg-warning tabular-nums">{openCollectionDueTotal === null ? '-' : `฿${openCollectionDueTotal.toLocaleString()}`}</span>
                    </div>
                    <div className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2">
                        <span className="block text-[10px] font-black uppercase tracking-widest text-fg-tertiary">รอตรวจ</span>
                        <span className="mt-1 block truncate font-black text-fg-primary tabular-nums">{pendingRequestCount === null ? '-' : pendingRequestCount.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
