import { db, financeCollectionMembers, getOutstandingLoanDebt } from '@gang/database';
import { and, eq, sql } from 'drizzle-orm';

export async function getMemberFinanceSnapshot(gangId: string, memberId: string) {
    const [loanDebt, collectionDueRows] = await Promise.all([
        getOutstandingLoanDebt(db, gangId, memberId),
        db.select({
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                eq(financeCollectionMembers.memberId, memberId)
            )),
    ]);

    return {
        loanDebt: Number(loanDebt || 0),
        collectionDue: Number(collectionDueRows[0]?.total || 0),
    };
}
