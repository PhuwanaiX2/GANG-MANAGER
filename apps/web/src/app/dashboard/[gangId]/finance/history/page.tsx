export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db, transactions } from '@gang/database';
import { loadFinanceContext } from '../FinanceData';
import {
    FinanceAccessDenied,
    FinanceFeatureDisabled,
    FinanceLockedPanel,
    FinanceShell,
} from '../FinanceShell';

const TransactionTable = nextDynamic(() => import('../TransactionTable').then((mod) => mod.TransactionTable));

interface Props {
    params: Promise<{ gangId: string }>;
    searchParams: Promise<{ page?: string }>;
}

const ITEMS_PER_PAGE = 20;

export default async function FinanceHistoryPage(props: Props) {
    const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
    const { gangId } = params;
    const page = Math.max(1, Number(searchParams.page) || 1);
    const offset = (page - 1) * ITEMS_PER_PAGE;

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

    const [historyTransactions, totalTransactionsResult] = await Promise.all([
        db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                sql`${transactions.status} != 'PENDING'`,
                sql`${transactions.status} != 'REJECTED'`,
            ),
            columns: {
                id: true,
                type: true,
                description: true,
                amount: true,
                balanceAfter: true,
                approvedAt: true,
                createdAt: true,
            },
            orderBy: desc(transactions.approvedAt),
            limit: ITEMS_PER_PAGE,
            offset,
            with: {
                member: {
                    columns: { name: true },
                },
                createdBy: {
                    columns: { name: true },
                },
            },
        }),
        db
            .select({ count: count() })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                sql`${transactions.status} != 'PENDING'`,
                sql`${transactions.status} != 'REJECTED'`,
            )),
    ]);

    const totalItems = Number(totalTransactionsResult[0]?.count || 0);

    return (
        <FinanceShell context={context}>
            <div className="animate-fade-in-up">
                <TransactionTable
                    transactions={historyTransactions}
                    currentPage={page}
                    totalPages={Math.ceil(totalItems / ITEMS_PER_PAGE)}
                    totalItems={totalItems}
                    itemsPerPage={ITEMS_PER_PAGE}
                />
            </div>
        </FinanceShell>
    );
}
