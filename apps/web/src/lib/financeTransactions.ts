type FinanceTransactionLike = {
    id: string;
    type: string;
    amount: number;
    description?: string | null;
    createdById?: string | null;
    approvedAt?: Date | string | null;
    createdAt?: Date | string | null;
    member?: unknown;
    [key: string]: unknown;
};

function getTransactionTime(transaction: FinanceTransactionLike) {
    return new Date(transaction.approvedAt || transaction.createdAt || 0).getTime();
}

export function groupRecentFinanceTransactions<T extends FinanceTransactionLike>(transactions: T[], limit: number) {
    const passthrough: T[] = [];
    const feeGroups = new Map<string, { base: T; count: number; total: number; latestAt: number }>();

    for (const transaction of transactions) {
        if (transaction.type !== 'GANG_FEE') {
            passthrough.push(transaction);
            continue;
        }

        const effectiveAt = new Date(transaction.approvedAt || transaction.createdAt || 0);
        const minuteBucket = effectiveAt.toISOString().slice(0, 16);
        const key = `${transaction.createdById || ''}|${transaction.description || ''}|${transaction.amount}|${minuteBucket}`;
        const existing = feeGroups.get(key);

        if (!existing) {
            feeGroups.set(key, {
                base: transaction,
                count: 1,
                total: Number(transaction.amount) || 0,
                latestAt: effectiveAt.getTime(),
            });
            continue;
        }

        existing.count += 1;
        existing.total += Number(transaction.amount) || 0;
        existing.latestAt = Math.max(existing.latestAt, effectiveAt.getTime());
    }

    const groupedFees = Array.from(feeGroups.values())
        .sort((a, b) => b.latestAt - a.latestAt)
        .map((group) => ({
            ...group.base,
            id: `gang_fee_${group.base.id}`,
            amount: group.total,
            __batchCount: group.count,
            member: undefined,
            approvedAt: new Date(group.latestAt),
        }));

    return [...passthrough, ...groupedFees]
        .sort((a, b) => getTransactionTime(b as FinanceTransactionLike) - getTransactionTime(a as FinanceTransactionLike))
        .slice(0, limit);
}
