import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, count, eq, sql } from 'drizzle-orm';
import {
    canAccessFeature,
    db,
    financeCollectionMembers,
    gangs,
    getTierConfig,
    resolveEffectiveSubscriptionTier,
    transactions,
} from '@gang/database';
import { authOptions } from '@/lib/auth';
import { getGangPermissionFlagsForDiscordId } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';

export type FinanceContext = {
    gangId: string;
    balance: number;
    tierName: string;
    hasFinance: boolean;
    hasExportCSV: boolean;
    hasMonthlySummary: boolean;
    openCollectionDueTotal: number;
    pendingRequestCount: number;
};

export type FinanceContextResult =
    | { status: 'feature-disabled' }
    | { status: 'forbidden' }
    | { status: 'ok'; context: FinanceContext };

export async function loadFinanceContext(gangId: string): Promise<FinanceContextResult> {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const financeEnabled = await isFeatureEnabled('finance');
    if (!financeEnabled) {
        return { status: 'feature-disabled' };
    }

    const permissions = await getGangPermissionFlagsForDiscordId({
        gangId,
        discordId: session.user.discordId,
    });

    if (!permissions.isOwner && !permissions.isTreasurer) {
        return { status: 'forbidden' };
    }

    const [gang, pendingRequestCountResult, openDueTotalResult] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: {
                balance: true,
                subscriptionTier: true,
                subscriptionExpiresAt: true,
            },
        }),
        db
            .select({ count: count() })
            .from(transactions)
            .where(and(eq(transactions.gangId, gangId), eq(transactions.status, 'PENDING'))),
        db
            .select({
                total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
            })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                sql`${financeCollectionMembers.status} IN ('OPEN', 'PARTIAL')`,
            )),
    ]);

    if (!gang) redirect('/dashboard');

    const tier = resolveEffectiveSubscriptionTier(gang.subscriptionTier || 'FREE', gang.subscriptionExpiresAt);
    const tierConfig = getTierConfig(tier);

    return {
        status: 'ok',
        context: {
            gangId,
            balance: Number(gang.balance || 0),
            tierName: tierConfig.name,
            hasFinance: canAccessFeature(tier, 'finance'),
            hasExportCSV: canAccessFeature(tier, 'exportCSV'),
            hasMonthlySummary: canAccessFeature(tier, 'monthlySummary'),
            pendingRequestCount: Number(pendingRequestCountResult[0]?.count || 0),
            openCollectionDueTotal: Number(openDueTotalResult[0]?.total || 0),
        },
    };
}
