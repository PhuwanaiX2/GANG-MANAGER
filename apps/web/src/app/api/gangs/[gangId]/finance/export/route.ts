import { NextRequest, NextResponse } from 'next/server';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { logError } from '@/lib/logger';
import { db, transactions, gangs, financeCollectionSettlements } from '@gang/database';
import { eq, and, desc, inArray, or, sql, type SQL } from 'drizzle-orm';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

const getLedgerEffect = (type: string) => {
    if (type === 'GANG_FEE') return 'DUE_ONLY';
    if (['INCOME', 'REPAYMENT', 'DEPOSIT'].includes(type)) return 'CASH_INFLOW';
    if (['EXPENSE', 'LOAN', 'PENALTY'].includes(type)) return 'CASH_OUTFLOW_OR_MEMBER_DEBT';
    return 'OTHER';
};

function summarizeSettlementSources(transaction: any, settlementRows: any[]) {
    const matchingRows = settlementRows.filter((row) => {
        if (row.transactionId === transaction.id) return true;

        return transaction.type === 'GANG_FEE'
            && transaction.batchId
            && transaction.memberId
            && row.batchId === transaction.batchId
            && row.memberId === transaction.memberId;
    });

    if (matchingRows.length === 0) return '-';

    const totalsBySource = new Map<string, number>();
    for (const row of matchingRows) {
        const source = row.source || 'DEPOSIT';
        totalsBySource.set(source, (totalsBySource.get(source) || 0) + (Number(row.amount) || 0));
    }

    return Array.from(totalsBySource.entries())
        .map(([source, amount]) => `${source}:${amount}`)
        .join('|');
}

export async function GET(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId: string | null = null;

    try {
        try {
            const access = await requireGangAccess({ gangId, minimumRole: 'TREASURER' });
            actorDiscordId = access.member.discordId;
        } catch (error) {
            if (isGangAccessError(error)) {
                return new NextResponse(error.status === 401 ? 'Unauthorized' : 'Forbidden', {
                    status: error.status === 401 ? 401 : 403,
                });
            }

            throw error;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:finance:export',
            limit: 20,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('finance-export', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        // Tier Check: Export CSV requires the Premium plan
        const tierCheck = await checkTierAccess(gangId, 'exportCSV');
        if (!tierCheck.allowed) {
            return new NextResponse(`Forbidden: ${tierCheck.message}`, { status: 403 });
        }

        // Fetch all approved transactions
        const allTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                sql`${transactions.status} != 'REJECTED'`
            ),
            orderBy: desc(transactions.createdAt),
            with: { member: true, createdBy: true },
        });

        const transactionIds = allTransactions
            .map((transaction) => transaction.id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0);
        const batchIds = Array.from(new Set(
            allTransactions
                .map((transaction) => transaction.batchId)
                .filter((id): id is string => typeof id === 'string' && id.length > 0)
        ));
        const settlementConditions: SQL[] = [];
        if (transactionIds.length > 0) {
            settlementConditions.push(inArray(financeCollectionSettlements.transactionId, transactionIds));
        }
        if (batchIds.length > 0) {
            settlementConditions.push(inArray(financeCollectionSettlements.batchId, batchIds));
        }
        const settlementRows = settlementConditions.length > 0
            ? await db.query.financeCollectionSettlements.findMany({
                where: settlementConditions.length === 1 ? settlementConditions[0] : or(...settlementConditions),
            })
            : [];

        // Get gang name for filename
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { name: true }
        });

        // Build CSV
        const headers = ['ID', 'Date', 'Type', 'LedgerEffect', 'SettlementSource', 'Description', 'Amount', 'Status', 'Member', 'CreatedBy', 'BalanceBefore', 'BalanceAfter', 'SettledAt'];
        const rows = allTransactions.map(t => [
            t.id,
            new Date(t.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            t.type,
            getLedgerEffect(t.type),
            summarizeSettlementSources(t, settlementRows),
            `"${(t.description || '').replace(/"/g, '""')}"`,
            t.amount,
            t.status,
            (t as any).member?.name || '-',
            (t as any).createdBy?.name || 'System',
            t.balanceBefore,
            t.balanceAfter,
            t.settledAt ? new Date(t.settledAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-',
        ]);

        // Add BOM for Thai character support in Excel
        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const filename = `${gang?.name || 'gang'}_transactions_${new Date().toISOString().split('T')[0]}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        logError('api.finance.export.failed', error, { gangId, actorDiscordId });
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
