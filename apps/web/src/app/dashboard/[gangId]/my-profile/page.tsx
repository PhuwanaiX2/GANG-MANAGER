export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
    attendanceRecords,
    db,
    financeCollectionMembers,
    leaveRequests,
    members,
    transactions,
} from '@gang/database';
import { authOptions } from '@/lib/auth';
import { checkTierAccess } from '@/lib/tierGuard';
import { MemberActivityClient } from '../members/[memberId]/MemberActivityClient';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function MyProfilePage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, session.user.discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    });

    if (!member) redirect(`/dashboard/${gangId}`);

    const financeTierCheck = await checkTierAccess(gangId, 'finance');
    const hasFinance = financeTierCheck.allowed;

    const [
        loanSummaryRaw,
        collectionDueRaw,
        memberAttendance,
        memberLeaves,
        memberTransactions,
    ] = await Promise.all([
        hasFinance
            ? db
                .select({
                    type: transactions.type,
                    total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
                })
                .from(transactions)
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.memberId, member.id),
                    eq(transactions.status, 'APPROVED'),
                    sql`${transactions.type} IN ('LOAN', 'REPAYMENT')`
                ))
                .groupBy(transactions.type)
            : Promise.resolve([]),
        hasFinance
            ? db
                .select({
                    total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
                })
                .from(financeCollectionMembers)
                .where(and(
                    eq(financeCollectionMembers.gangId, gangId),
                    eq(financeCollectionMembers.memberId, member.id)
                ))
            : Promise.resolve([]),
        db.query.attendanceRecords.findMany({
            where: eq(attendanceRecords.memberId, member.id),
            with: { session: true },
            orderBy: desc(attendanceRecords.createdAt),
        }),
        db.query.leaveRequests.findMany({
            where: eq(leaveRequests.memberId, member.id),
            orderBy: desc(leaveRequests.requestedAt),
        }),
        hasFinance
            ? db.query.transactions.findMany({
                where: and(
                    eq(transactions.memberId, member.id),
                    eq(transactions.status, 'APPROVED')
                ),
                orderBy: desc(transactions.approvedAt),
            })
            : Promise.resolve([]),
    ]);

    const balance = hasFinance ? Number(member.balance || 0) : 0;
    const totalLoan = Number(loanSummaryRaw.find((row) => row.type === 'LOAN')?.total || 0);
    const totalRepayment = Number(loanSummaryRaw.find((row) => row.type === 'REPAYMENT')?.total || 0);
    const loanDebt = Math.max(0, totalLoan - totalRepayment);
    const collectionDue = Number(collectionDueRaw[0]?.total || 0);

    const memberTransactionsWithBalance = (() => {
        const sorted = [...(memberTransactions as any[])].sort((a, b) => {
            const aAt = new Date(a.approvedAt || a.createdAt).getTime();
            const bAt = new Date(b.approvedAt || b.createdAt).getTime();
            return bAt - aAt;
        });

        let runningAfter = balance;
        const calcMemberDelta = (transaction: any) => {
            const amount = Number(transaction.amount) || 0;
            switch (transaction.type) {
                case 'LOAN':
                case 'GANG_FEE':
                case 'PENALTY':
                    return -amount;
                case 'REPAYMENT':
                case 'DEPOSIT':
                    return amount;
                default:
                    return 0;
            }
        };

        return sorted.map((transaction) => {
            const delta = calcMemberDelta(transaction);
            const memberBalanceAfter = runningAfter;
            const memberBalanceBefore = memberBalanceAfter - delta;
            runningAfter = memberBalanceBefore;
            return {
                ...transaction,
                memberBalanceBefore,
                memberBalanceAfter,
            };
        });
    })();

    return (
        <MemberActivityClient
            member={{ ...member, balance }}
            attendance={memberAttendance}
            leaves={memberLeaves}
            transactions={memberTransactionsWithBalance as any}
            gangId={gangId}
            backHref={null}
            profileLabel="โปรไฟล์ของฉัน"
            financeSummary={{
                loanDebt,
                collectionDue,
                availableCredit: Math.max(0, balance),
            }}
        />
    );
}
