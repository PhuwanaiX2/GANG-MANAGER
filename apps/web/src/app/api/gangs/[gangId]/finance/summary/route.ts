import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGangPermissions } from '@/lib/permissions';
import { db, transactions, members, financeCollectionBatches, financeCollectionMembers } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId } = params;

        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isOwner && !permissions.isTreasurer) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const [monthlySummary, monthlyCollectionDue, memberRows, loanSummaryRaw, collectionDueRaw] = await Promise.all([
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
                    sql`${transactions.createdAt} >= date('now', '-6 months')`
                ))
                .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
                .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`),

            db
                .select({
                    month: sql<string>`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`,
                    totalDue: sql<number>`COALESCE(sum(${financeCollectionBatches.totalAmountDue}), 0)`,
                    count: sql<number>`count(*)`,
                })
                .from(financeCollectionBatches)
                .where(and(
                    eq(financeCollectionBatches.gangId, gangId),
                    sql`${financeCollectionBatches.createdAt} >= date('now', '-6 months')`
                ))
                .groupBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`)
                .orderBy(sql`strftime('%Y-%m', ${financeCollectionBatches.createdAt})`),

            db.query.members.findMany({
                where: and(
                    eq(members.gangId, gangId),
                    eq(members.isActive, true),
                    eq(members.status, 'APPROVED')
                ),
                columns: {
                    id: true,
                    name: true,
                    balance: true,
                    discordAvatar: true,
                },
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

        // Reshape into monthly objects
        const monthlyMap = new Map<string, { month: string; income: number; expense: number; loan: number; repayment: number; penalty: number; deposit: number; gangFee: number; txCount: number }>();

        for (const row of monthlySummary) {
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
                case 'DEPOSIT': entry.deposit = row.total; break;
                case 'PENALTY': entry.penalty = row.total; break;
            }
        }

        for (const row of monthlyCollectionDue) {
            const month = row.month;
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, { month, income: 0, expense: 0, loan: 0, repayment: 0, penalty: 0, deposit: 0, gangFee: 0, txCount: 0 });
            }
            const entry = monthlyMap.get(month)!;
            entry.gangFee = Number(row.totalDue) || 0;
            entry.txCount += row.count;
        }

        const months = Array.from(monthlyMap.values());

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

        const topDebtors = memberRows
            .map((member) => {
                const loan = loanMap.get(member.id)?.loan || 0;
                const repayment = loanMap.get(member.id)?.repayment || 0;
                const loanDebt = Math.max(0, loan - repayment);
                const collectionDue = collectionDueMap.get(member.id) || 0;
                const debtExposure = Math.max(Math.abs(Number(member.balance) || 0), loanDebt + collectionDue);
                return {
                    ...member,
                    loanDebt,
                    collectionDue,
                    debtExposure,
                };
            })
            .filter((member) => member.debtExposure > 0 && (member.loanDebt > 0 || member.collectionDue > 0 || member.balance < 0))
            .sort((a, b) => b.debtExposure - a.debtExposure)
            .slice(0, 10);

        return NextResponse.json({
            months,
            topDebtors,
        });

    } catch (error) {
        console.error('Finance Summary API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
