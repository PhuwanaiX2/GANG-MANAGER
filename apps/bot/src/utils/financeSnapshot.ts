import { db, financeCollectionMembers, getOutstandingLoanDebt, members } from '@gang/database';
import { and, eq, sql } from 'drizzle-orm';

export async function getMemberFinanceSnapshot(gangId: string, memberId: string) {
    const [loanDebt, collectionDueRows, memberRows] = await Promise.all([
        getOutstandingLoanDebt(db, gangId, memberId),
        db.select({
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                eq(financeCollectionMembers.memberId, memberId)
            )),
        db.select({ balance: members.balance })
            .from(members)
            .where(and(
                eq(members.gangId, gangId),
                eq(members.id, memberId)
            ))
            .limit(1),
    ]);

    const normalizedLoanDebt = Number(loanDebt || 0);
    const normalizedCollectionDue = Number(collectionDueRows[0]?.total || 0);
    const legacyBalanceDebt = normalizedLoanDebt + normalizedCollectionDue > 0
        ? 0
        : Math.max(0, -(Number(memberRows[0]?.balance) || 0));

    return {
        loanDebt: normalizedLoanDebt,
        collectionDue: normalizedCollectionDue,
        legacyBalanceDebt,
    };
}
