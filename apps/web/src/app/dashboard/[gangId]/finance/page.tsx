export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, transactions, members, financeCollectionBatches, financeCollectionMembers, canAccessFeature, getTierConfig } from '@gang/database';
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

import { getGangPermissions } from '@/lib/permissions';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { FeatureDisabledBanner } from '@/components/FeatureDisabledBanner';
import { TransactionTable } from './TransactionTable';
import { FinanceClient } from './FinanceClient';
import { LoanRequestList } from './LoanRequestList';
import { FinanceTabs } from './FinanceTabs';
import { GangFeeDebtsClient } from './GangFeeDebtsClient';
import { SummaryClient } from './SummaryClient';

interface Props {
    params: { gangId: string };
    searchParams: { page?: string; tab?: string; range?: string };
}

export default async function FinancePage({ params, searchParams }: Props) {
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
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isTreasurer) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-rose-500/10 rounded-full flex items-center justify-center mb-4 border border-rose-500/20">
                    <AlertTriangle className="w-8 h-8 text-rose-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2 font-heading tracking-tight">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-zinc-400 max-w-md text-sm">
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
            columns: { balance: true, subscriptionTier: true }
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
    const tier = gang.subscriptionTier || 'FREE';
    const hasFinance = canAccessFeature(tier, 'finance');
    const hasExportCSV = canAccessFeature(tier, 'exportCSV');
    const hasMonthlySummary = canAccessFeature(tier, 'monthlySummary');
    const tierConfig = getTierConfig(tier);

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
                limit: 8,
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

    const groupedRecentApproved = (() => {
        if (!overviewData?.recentApproved) return [];

        const out: any[] = [];
        const feeGroups = new Map<string, { base: any; count: number; total: number; latestAt: number }>();

        // We only have 8 rows here; grouping is best-effort without changing query limits.
        for (const t of overviewData.recentApproved as any[]) {
            if (t.type !== 'GANG_FEE') {
                out.push(t);
                continue;
            }

            const effectiveAt = new Date(t.approvedAt || t.createdAt);
            const minuteBucket = effectiveAt.toISOString().slice(0, 16);
            const key = `${t.createdById || ''}|${t.description}|${t.amount}|${minuteBucket}`;
            const existing = feeGroups.get(key);
            if (!existing) {
                feeGroups.set(key, {
                    base: t,
                    count: 1,
                    total: Number(t.amount) || 0,
                    latestAt: effectiveAt.getTime(),
                });
            } else {
                existing.count += 1;
                existing.total += Number(t.amount) || 0;
                existing.latestAt = Math.max(existing.latestAt, effectiveAt.getTime());
            }
        }

        const groupedFees = Array.from(feeGroups.values())
            .sort((a, b) => b.latestAt - a.latestAt)
            .map((g) => ({
                ...g.base,
                id: `gang_fee_${g.base.id}`,
                amount: g.total,
                __batchCount: g.count,
                member: undefined,
                approvedAt: new Date(g.latestAt),
            }));

        const merged = [...out, ...groupedFees].sort((a, b) => {
            const aAt = new Date((a as any).approvedAt || (a as any).createdAt).getTime();
            const bAt = new Date((b as any).approvedAt || (b as any).createdAt).getTime();
            return bAt - aAt;
        });

        return merged.slice(0, 8);
    })();

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
                    <h1 className="text-3xl font-bold tracking-tight text-white font-heading mb-3">การเงิน</h1>
                    <FinanceTabs />
                </div>
                <FinanceClient gangId={gangId} members={activeMembers} hasFinance={hasFinance} hasExportCSV={hasExportCSV} />
            </div>

            {/* Tier Gate Banner */}
            {!hasFinance && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex items-start gap-4">
                    <div className="p-2 bg-amber-500/10 rounded-xl shrink-0">
                        <Lock className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-amber-500 mb-1">ฟีเจอร์การเงินต้องใช้แพลน Premium</h3>
                        <p className="text-sm text-zinc-400 mb-4">แพลนปัจจุบัน: <strong className="text-zinc-200">{tierConfig.name}</strong> — อัปเกรดเพื่อใช้งานระบบการเงิน บันทึกรายการ ยืม/ชำระหนี้ และเก็บเงินแก๊ง</p>
                        <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-xl transition-colors shadow-sm">
                            <Zap className="w-4 h-4" /> อัปเกรดแพลน
                        </a>
                    </div>
                </div>
            )}

            {/* Overview Tab Content */}
            {tab === 'overview' && overviewData && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {/* Income Card */}
                        <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-emerald-500/30 transition-all shadow-sm">
                            <div className="text-zinc-500 text-xs font-semibold tracking-wide uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                                    <ArrowUpRight className="w-4 h-4" />
                                </div>
                                Income Total
                            </div>
                            <div className="text-3xl font-bold text-emerald-400 tracking-tight">
                                +฿{overviewData.income.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-zinc-500">รายรับสะสมทั้งหมดที่เข้ากองกลางจริง (รวมชำระหนี้/นำเงินเข้า)</div>
                        </div>

                        {/* Expense Card */}
                        <div className="bg-[#0A0A0A] border border-white/10 p-6 rounded-2xl relative overflow-hidden group hover:border-rose-500/30 transition-all shadow-sm">
                            <div className="text-zinc-500 text-xs font-semibold tracking-wide uppercase mb-3 flex items-center gap-2">
                                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500">
                                    <ArrowDownLeft className="w-4 h-4" />
                                </div>
                                Expense Total
                            </div>
                            <div className="text-3xl font-bold text-rose-500 tracking-tight">
                                -฿{overviewData.expense.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-zinc-500">รายจ่ายสะสมทั้งหมด</div>
                        </div>

                        {/* Net Balance Card */}
                        <div className="bg-gradient-to-br from-[#111] to-[#0A0A0A] border border-white/10 p-6 rounded-2xl relative overflow-hidden group shadow-sm sm:col-span-2 lg:col-span-1">
                            <div className="absolute -top-6 -right-6 p-8 opacity-20 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-500">
                                <Wallet className="w-24 h-24 text-white" />
                            </div>
                            <div className="text-zinc-400 text-xs font-semibold tracking-wide uppercase mb-3 flex items-center gap-2 relative z-10">
                                <div className="p-1.5 rounded-lg bg-white/10 text-white backdrop-blur-sm">
                                    <Wallet className="w-4 h-4" />
                                </div>
                                Net Balance
                            </div>
                            <div className="text-4xl font-bold tracking-tight text-white relative z-10">
                                ฿{balance.toLocaleString()}
                            </div>
                            <div className="mt-2 text-xs text-zinc-500 relative z-10">ยอดคงเหลือในแก๊งปัจจุบัน</div>
                        </div>
                    </div>

                    {/* Pending Requests + Recent Transactions */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <LoanRequestList gangId={gangId} requests={overviewData.pendingRequests} />

                        {/* Recent Transactions */}
                        <div className="bg-[#0A0A0A] border border-white/10 rounded-2xl overflow-hidden shadow-sm flex flex-col">
                            <div className="p-5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-zinc-400" />
                                    <h3 className="font-semibold text-white tracking-wide font-heading">ธุรกรรมล่าสุด</h3>
                                </div>
                                <Link
                                    href={`/dashboard/${gangId}/finance?tab=history`}
                                    className="text-xs text-zinc-400 hover:text-white transition-colors font-medium tracking-wide"
                                >
                                    ดูทั้งหมด →
                                </Link>
                            </div>

                            <div className="flex-1 overflow-auto">
                                {groupedRecentApproved && groupedRecentApproved.length > 0 ? (
                                    <div className="divide-y divide-white/5">
                                        {groupedRecentApproved.map((t: any) => {
                                            const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(t.type);
                                            const isDueOnly = t.type === 'GANG_FEE';
                                            const effectiveAt = new Date(t.approvedAt || t.createdAt);
                                            return (
                                                <div key={t.id} className="flex items-center gap-4 px-5 py-4 hover:bg-[#111] transition-colors">
                                                    <div className={`shrink-0 p-2 rounded-lg ${isDueOnly ? 'bg-purple-500/10 text-purple-400' : isIncome ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                        {isDueOnly ? <Banknote className="w-4 h-4" /> : isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-zinc-200 truncate">
                                                            {t.type === 'GANG_FEE' && t.__batchCount
                                                                ? `ตั้งยอดเก็บเงินแก๊ง: ${t.__batchCount} คน`
                                                                : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(t.type)
                                                                    ? `${t.member?.name || '-'} ${t.type === 'LOAN' ? 'ยืมจากกองกลาง' : t.type === 'REPAYMENT' ? 'ชำระหนี้' : t.type === 'DEPOSIT' ? 'นำเงินเข้า' : 'ค่าปรับ'}`
                                                                    : t.description
                                                            }
                                                        </div>
                                                        <div className="text-xs text-zinc-500 mt-0.5">
                                                            {effectiveAt.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </div>
                                                        {isDueOnly && (
                                                            <div className="text-[11px] text-purple-400/80 mt-1">ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง</div>
                                                        )}
                                                    </div>
                                                    <span className={`shrink-0 font-semibold text-sm tracking-wide ${isDueOnly ? 'text-purple-400' : isIncome ? 'text-emerald-400' : 'text-rose-500'}`}>
                                                        {isDueOnly ? `฿${Math.abs(t.amount).toLocaleString()}` : `${isIncome ? '+' : '-'}฿${Math.abs(t.amount).toLocaleString()}`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-zinc-500 space-y-3">
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
                <div className="bg-[#0A0A0A] border border-indigo-500/20 rounded-2xl p-10 text-center flex flex-col items-center justify-center border-dashed">
                    <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-5">
                        <Lock className="w-8 h-8 text-indigo-400" />
                    </div>
                    <h3 className="font-bold text-white text-xl mb-2 font-heading tracking-tight">สรุปรายเดือนต้องใช้แพลน PREMIUM</h3>
                    <p className="text-sm text-zinc-400 mb-6 max-w-md">แพลนปัจจุบัน: <strong className="text-zinc-200">{tierConfig.name}</strong> — อัปเกรดเพื่อดูสรุปรายรับ-รายจ่ายแยกตามเดือน ข้อมูลสถิติเชิงลึก และอื่นๆ อีกมากมาย</p>
                    <a href={`/dashboard/${gangId}/settings?tab=subscription`} className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold rounded-xl transition-colors shadow-lg shadow-indigo-500/20">
                        <Zap className="w-4 h-4" /> อัปเกรดเป็น PREMIUM
                    </a>
                </div>
            )}
            {tab === 'summary' && hasMonthlySummary && summaryData && (
                <SummaryClient months={summaryData.months} topMembers={summaryData.topMembers} currentRange={summaryRange} />
            )}
        </div>
    );
}
