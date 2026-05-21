export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { and, eq, sql } from 'drizzle-orm';
import {
    db,
    financeCollectionBatches,
    financeCollectionMembers,
    members,
    transactions,
} from '@gang/database';
import { loadFinanceContext } from '../FinanceData';
import {
    FinanceAccessDenied,
    FinanceFeatureDisabled,
    FinanceLockedPanel,
    FinanceShell,
    FinanceSummaryLockedPanel,
} from '../FinanceShell';

const SummaryClient = nextDynamic(() => import('../SummaryClient').then((mod) => mod.SummaryClient));

interface Props {
    params: Promise<{ gangId: string }>;
    searchParams: Promise<{ range?: string }>;
}

type MonthSummary = {
    month: string;
    income: number;
    expense: number;
    loan: number;
    repayment: number;
    penalty: number;
    deposit: number;
    gangFee: number;
    txCount: number;
};

export default async function FinanceSummaryPage(props: Props) {
    const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
    const { gangId } = params;
    const summaryRange = ['3', '6', '12', 'all'].includes(searchParams.range || '') ? searchParams.range! : '6';

    const financeResult = await loadFinanceContext(gangId);
    if (financeResult.status === 'feature-disabled') return <FinanceFeatureDisabled />;
    if (financeResult.status === 'forbidden') return <FinanceAccessDenied />;

    const { context } = financeResult;

    if (!context.hasFinance) {
        return (
            <FinanceShell context={context}>
                <FinanceLockedPanel context={context} />
            </FinanceShell>
        );
    }

    if (!context.hasMonthlySummary) {
        return (
            <FinanceShell context={context}>
                <FinanceSummaryLockedPanel context={context} />
            </FinanceShell>
        );
    }

    const rangeTransactionFilter = summaryRange !== 'all'
        ? [sql`${transactions.createdAt} >= date('now', '-${sql.raw(summaryRange)} months')`]
        : [];
    const rangeCollectionFilter = summaryRange !== 'all'
        ? [sql`${financeCollectionBatches.createdAt} >= date('now', '-${sql.raw(summaryRange)} months')`]
        : [];

    const [monthlySummaryRaw, monthlyCollectionRaw, memberRows, loanSummaryRaw, collectionDueRaw] = await Promise.all([
        db
            .select({
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
                ...rangeTransactionFilter,
            ))
            .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
            .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`),

        db
            .select({
                month: sql<string>`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`,
                totalDue: sql<number>`COALESCE(sum(${financeCollectionBatches.totalAmountDue}), 0)`,
            })
            .from(financeCollectionBatches)
            .where(and(
                eq(financeCollectionBatches.gangId, gangId),
                ...rangeCollectionFilter,
            ))
            .groupBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`)
            .orderBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`),

        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED'),
            ),
            columns: {
                id: true,
                name: true,
                balance: true,
                discordAvatar: true,
            },
        }),

        db
            .select({
                memberId: transactions.memberId,
                type: transactions.type,
                total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
            })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.status, 'APPROVED'),
                sql`${transactions.memberId} IS NOT NULL`,
                sql`${transactions.type} IN ('LOAN', 'REPAYMENT')`,
            ))
            .groupBy(transactions.memberId, transactions.type),

        db
            .select({
                memberId: financeCollectionMembers.memberId,
                total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
            })
            .from(financeCollectionMembers)
            .where(eq(financeCollectionMembers.gangId, gangId))
            .groupBy(financeCollectionMembers.memberId),
    ]);

    const monthlyMap = new Map<string, MonthSummary>();
    for (const row of monthlySummaryRaw) {
        const month = row.month;
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, createEmptyMonth(month));
        }
        const entry = monthlyMap.get(month)!;
        entry.txCount += Number(row.count) || 0;
        switch (row.type) {
            case 'INCOME':
                entry.income = Number(row.total) || 0;
                break;
            case 'EXPENSE':
                entry.expense = Number(row.total) || 0;
                break;
            case 'LOAN':
                entry.loan = Number(row.total) || 0;
                break;
            case 'REPAYMENT':
                entry.repayment = Number(row.total) || 0;
                break;
            case 'PENALTY':
                entry.penalty = Number(row.total) || 0;
                break;
            case 'DEPOSIT':
                entry.deposit = Number(row.total) || 0;
                break;
        }
    }

    for (const row of monthlyCollectionRaw) {
        const month = row.month;
        if (!monthlyMap.has(month)) {
            monthlyMap.set(month, createEmptyMonth(month));
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
        .sort((a, b) => {
            const aValue = Math.max(Math.abs(a.balance), a.loanDebt + a.collectionDue);
            const bValue = Math.max(Math.abs(b.balance), b.loanDebt + b.collectionDue);
            return bValue - aValue;
        })
        .slice(0, 50);

    return (
        <FinanceShell context={context}>
            <SummaryClient
                months={Array.from(monthlyMap.values())}
                topMembers={topMembers}
                currentRange={summaryRange}
            />
        </FinanceShell>
    );
}

function createEmptyMonth(month: string): MonthSummary {
    return {
        month,
        income: 0,
        expense: 0,
        loan: 0,
        repayment: 0,
        penalty: 0,
        deposit: 0,
        gangFee: 0,
        txCount: 0,
    };
}
