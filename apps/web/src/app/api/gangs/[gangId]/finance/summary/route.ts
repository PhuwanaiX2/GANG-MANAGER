import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGangPermissions } from '@/lib/permissions';
import { db, transactions, members } from '@gang/database';
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

        // Monthly summary for the last 6 months
        const monthlySummary = await db
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
                sql`${transactions.createdAt} >= date('now', '-6 months')`
            ))
            .groupBy(sql`strftime('%Y-%m', ${transactions.createdAt})`, transactions.type)
            .orderBy(sql`strftime('%Y-%m', ${transactions.createdAt})`);

        // Reshape into monthly objects
        const monthlyMap = new Map<string, { month: string; income: number; expense: number; loan: number; repayment: number; penalty: number; txCount: number }>();

        for (const row of monthlySummary) {
            const month = row.month;
            if (!monthlyMap.has(month)) {
                monthlyMap.set(month, { month, income: 0, expense: 0, loan: 0, repayment: 0, penalty: 0, txCount: 0 });
            }
            const entry = monthlyMap.get(month)!;
            entry.txCount += row.count;

            switch (row.type) {
                case 'INCOME': entry.income = row.total; break;
                case 'EXPENSE': entry.expense = row.total; break;
                case 'LOAN': entry.loan = row.total; break;
                case 'REPAYMENT': entry.repayment = row.total; break;
                case 'PENALTY': entry.penalty = row.total; break;
            }
        }

        const months = Array.from(monthlyMap.values());

        // Top debtors (members with negative balance)
        const topDebtors = await db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                sql`${members.balance} < 0`
            ),
            orderBy: sql`${members.balance} ASC`,
            limit: 10,
            columns: {
                id: true,
                name: true,
                balance: true,
                discordAvatar: true,
            },
        });

        return NextResponse.json({
            months,
            topDebtors,
        });

    } catch (error) {
        console.error('Finance Summary API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
