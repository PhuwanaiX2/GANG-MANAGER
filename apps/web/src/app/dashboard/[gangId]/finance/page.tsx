export const dynamic = 'force-dynamic';

import nextDynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
    db,
    financeCollectionMembers,
    transactions,
} from '@gang/database';
import {
    ArrowDownLeft,
    ArrowUpRight,
    Banknote,
    Clock,
} from 'lucide-react';
import { groupRecentFinanceTransactions } from '@/lib/financeTransactions';
import { loadFinanceContext } from './FinanceData';
import {
    FinanceAccessDenied,
    FinanceFeatureDisabled,
    FinanceLockedPanel,
    FinanceShell,
} from './FinanceShell';

const LoanRequestList = nextDynamic(() => import('./LoanRequestList').then((mod) => mod.LoanRequestList));
const GangFeeDebtsClient = nextDynamic(() => import('./GangFeeDebtsClient').then((mod) => mod.GangFeeDebtsClient));

interface Props {
    params: Promise<{ gangId: string }>;
    searchParams: Promise<{ page?: string; tab?: string; range?: string }>;
}

type RecentTransaction = {
    id: string;
    type: string;
    amount: number;
    description: string;
    createdById?: string | null;
    approvedAt?: Date | string | null;
    createdAt: Date | string;
    member?: { name: string } | null;
    __batchCount?: number;
};

export default async function FinanceOverviewPage(props: Props) {
    const [params, searchParams] = await Promise.all([props.params, props.searchParams]);
    const { gangId } = params;

    if (searchParams.tab === 'history') {
        const query = searchParams.page ? `?page=${encodeURIComponent(searchParams.page)}` : '';
        redirect(`/dashboard/${gangId}/finance/history${query}`);
    }

    if (searchParams.tab === 'summary') {
        const query = searchParams.range ? `?range=${encodeURIComponent(searchParams.range)}` : '';
        redirect(`/dashboard/${gangId}/finance/summary${query}`);
    }

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

    const [pendingRequests, recentApproved, gangFeeDebts] = await Promise.all([
        db.query.transactions.findMany({
            where: and(eq(transactions.gangId, gangId), eq(transactions.status, 'PENDING')),
            columns: {
                id: true,
                type: true,
                amount: true,
                description: true,
                createdAt: true,
            },
            orderBy: desc(transactions.createdAt),
            with: {
                member: {
                    columns: { name: true, discordAvatar: true },
                },
            },
        }),
        db.query.transactions.findMany({
            where: and(eq(transactions.gangId, gangId), eq(transactions.status, 'APPROVED')),
            columns: {
                id: true,
                type: true,
                amount: true,
                description: true,
                createdById: true,
                approvedAt: true,
                createdAt: true,
            },
            orderBy: desc(transactions.approvedAt),
            limit: 30,
            with: {
                member: {
                    columns: { name: true },
                },
            },
        }),
        db.query.financeCollectionMembers.findMany({
            where: and(
                eq(financeCollectionMembers.gangId, gangId),
                sql`${financeCollectionMembers.status} IN ('OPEN', 'PARTIAL')`,
            ),
            orderBy: desc(financeCollectionMembers.createdAt),
            limit: 50,
            columns: {
                memberId: true,
                batchId: true,
                amountDue: true,
                amountCredited: true,
                amountSettled: true,
                amountWaived: true,
                createdAt: true,
            },
            with: {
                member: {
                    columns: { name: true },
                },
                batch: {
                    columns: {
                        id: true,
                        description: true,
                        totalMembers: true,
                        createdAt: true,
                    },
                },
            },
        }),
    ]);

    const batchMemberCounts: Record<string, number> = {};
    for (const row of gangFeeDebts as any[]) {
        if (row.batch?.id && typeof row.batch?.totalMembers === 'number') {
            batchMemberCounts[row.batch.id] = row.batch.totalMembers;
        }
    }

    const groupedRecentApproved = groupRecentFinanceTransactions(recentApproved as RecentTransaction[], 8);

    return (
        <FinanceShell context={context}>
            <div id="finance-overview" className="space-y-4 scroll-mt-6">
                <div
                    id="finance-pending"
                    className={`grid grid-cols-1 gap-4 scroll-mt-6 ${pendingRequests.length > 0 ? 'lg:grid-cols-2' : ''}`}
                >
                    <LoanRequestList gangId={gangId} requests={pendingRequests} />
                    <RecentTransactionPanel transactions={groupedRecentApproved} />
                </div>

                <div id="finance-debts" className="scroll-mt-6">
                    <GangFeeDebtsClient
                        gangId={gangId}
                        debts={(gangFeeDebts || []).map((row: any) => ({
                            memberId: row.memberId,
                            memberName: row.member?.name || '-',
                            batchId: row.batchId || row.batch?.id || '-',
                            description: row.batch?.description || 'ตั้งยอดเก็บเงินแก๊ง',
                            amount: Math.max(
                                0,
                                (Number(row.amountDue) || 0)
                                - (Number(row.amountCredited) || 0)
                                - (Number(row.amountSettled) || 0)
                                - (Number(row.amountWaived) || 0),
                            ),
                            createdAt: new Date(row.batch?.createdAt || row.createdAt).toISOString(),
                        }))}
                        totalMembersInBatch={batchMemberCounts}
                    />
                </div>
            </div>
        </FinanceShell>
    );
}

function RecentTransactionPanel({ transactions: rows }: { transactions: RecentTransaction[] }) {
    return (
        <section className="flex flex-col overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-muted px-4 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-fg-tertiary" />
                    <h3 className="font-heading text-sm font-bold tracking-wide text-fg-primary">ธุรกรรมล่าสุด</h3>
                </div>
            </div>

            {rows.length === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-3 p-8 text-center text-fg-tertiary">
                    <Banknote className="h-8 w-8 opacity-30" />
                    <p className="text-sm font-medium">ยังไม่มีธุรกรรม</p>
                </div>
            ) : (
                <>
                    <div className="grid gap-2.5 p-3 md:hidden">
                        {rows.map((transaction) => (
                            <RecentMobileCard key={transaction.id} transaction={transaction} />
                        ))}
                    </div>

                    <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-[620px] w-full text-left">
                            <thead className="border-b border-border-subtle bg-bg-muted">
                                <tr>
                                    <th className="px-4 py-3 text-xs font-bold text-fg-tertiary">รายการ</th>
                                    <th className="px-4 py-3 text-xs font-bold text-fg-tertiary whitespace-nowrap">วันที่</th>
                                    <th className="px-4 py-3 text-right text-xs font-bold text-fg-tertiary">จำนวน</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {rows.map((transaction) => (
                                    <RecentTableRow key={transaction.id} transaction={transaction} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </section>
    );
}

function RecentMobileCard({ transaction }: { transaction: RecentTransaction }) {
    const meta = getRecentMeta(transaction);

    return (
        <article className="rounded-token-2xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-xs">
            <div className="flex items-start gap-3">
                <div className={`shrink-0 rounded-token-lg border p-2 ${meta.iconTone}`}>
                    {meta.icon}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-black text-fg-primary">{meta.title}</p>
                    {meta.subTitle && <p className="mt-1 line-clamp-2 text-[11px] text-fg-tertiary">{meta.subTitle}</p>}
                    <p className="mt-2 text-[11px] font-semibold text-fg-tertiary">{formatBangkokDateTime(meta.effectiveAt)}</p>
                </div>
                <p className={`shrink-0 text-right font-mono text-sm font-black tabular-nums ${meta.amountTone}`}>
                    {meta.amountLabel}
                </p>
            </div>
        </article>
    );
}

function RecentTableRow({ transaction }: { transaction: RecentTransaction }) {
    const meta = getRecentMeta(transaction);

    return (
        <tr className="transition-colors hover:bg-bg-muted">
            <td className="px-4 py-3 align-middle">
                <div className="flex min-w-0 items-center gap-3">
                    <div className={`shrink-0 rounded-token-lg border p-1.5 ${meta.iconTone}`}>
                        {meta.icon}
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-fg-primary">{meta.title}</div>
                        {meta.subTitle && <div className="mt-0.5 truncate text-[11px] text-fg-tertiary">{meta.subTitle}</div>}
                    </div>
                </div>
            </td>
            <td className="whitespace-nowrap px-4 py-3 align-middle text-xs text-fg-tertiary">
                {formatBangkokDateTime(meta.effectiveAt)}
            </td>
            <td className="whitespace-nowrap px-4 py-3 text-right align-middle">
                <span className={`text-sm font-semibold tracking-wide ${meta.amountTone}`}>
                    {meta.amountLabel}
                </span>
            </td>
        </tr>
    );
}

function getRecentMeta(transaction: RecentTransaction) {
    const isIncome = ['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(transaction.type);
    const isDueOnly = transaction.type === 'GANG_FEE';
    const effectiveAt = new Date(transaction.approvedAt || transaction.createdAt);
    const amount = Number(transaction.amount) || 0;

    const title = isDueOnly && transaction.__batchCount
        ? `ตั้งยอดเก็บเงินแก๊ง: ${transaction.__batchCount} คน`
        : ['LOAN', 'REPAYMENT', 'DEPOSIT', 'PENALTY'].includes(transaction.type)
            ? `${transaction.member?.name || '-'} ${getTypeLabel(transaction.type)}`
            : transaction.description;

    return {
        effectiveAt,
        title,
        subTitle: isDueOnly ? 'ยังไม่เข้ากองกลางจนกว่าจะมีการชำระจริง' : undefined,
        icon: isDueOnly
            ? <Banknote className="h-4 w-4" />
            : isIncome
                ? <ArrowUpRight className="h-4 w-4" />
                : <ArrowDownLeft className="h-4 w-4" />,
        iconTone: isDueOnly
            ? 'border-border-accent bg-accent-subtle text-accent-bright'
            : isIncome
                ? 'border-status-success bg-status-success-subtle text-fg-success'
                : 'border-status-danger bg-status-danger-subtle text-fg-danger',
        amountTone: isDueOnly ? 'text-accent-bright' : isIncome ? 'text-fg-success' : 'text-fg-danger',
        amountLabel: isDueOnly
            ? `฿${Math.abs(amount).toLocaleString()}`
            : `${isIncome ? '+' : '-'}฿${Math.abs(amount).toLocaleString()}`,
    };
}

function getTypeLabel(type: string) {
    switch (type) {
        case 'LOAN':
            return 'ยืมจากกองกลาง';
        case 'REPAYMENT':
            return 'ชำระหนี้ยืม';
        case 'DEPOSIT':
            return 'ชำระค่าเก็บเงินแก๊ง/ฝากเครดิต';
        case 'PENALTY':
            return 'ค่าปรับ';
        default:
            return type;
    }
}

function formatBangkokDateTime(value: Date) {
    return value.toLocaleString('th-TH', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
    });
}
