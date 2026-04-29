export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, attendanceRecords, leaveRequests, transactions, attendanceSessions, financeCollectionMembers } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { MemberActivityClient } from './MemberActivityClient';
import { checkTierAccess } from '@/lib/tierGuard';

interface Props {
    params: Promise<{ gangId: string; memberId: string }>;
}

export default async function MemberDetailPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId, memberId } = params;

    // Get gang
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
    });

    if (!gang) redirect('/dashboard');

    // Get member with all related data
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.id, memberId),
            eq(members.gangId, gangId)
        ),
    });

    if (!member) redirect(`/dashboard/${gangId}/members`);

    const financeTierCheck = await checkTierAccess(gangId, 'finance');
    const hasFinance = financeTierCheck.allowed;

    const [memberAttendance, memberLeaves, memberTransactions, loanSummaryRaw, collectionDueRaw] = await Promise.all([
        db.query.attendanceRecords.findMany({
            where: eq(attendanceRecords.memberId, memberId),
            with: {
                session: true,
            },
            orderBy: desc(attendanceRecords.createdAt),
        }),
        db.query.leaveRequests.findMany({
            where: eq(leaveRequests.memberId, memberId),
            orderBy: desc(leaveRequests.requestedAt),
        }),
        hasFinance ? db.query.transactions.findMany({
            where: and(
                eq(transactions.memberId, memberId),
                eq(transactions.status, 'APPROVED')
            ),
            orderBy: desc(transactions.approvedAt),
        }) : Promise.resolve([]),
        hasFinance ? db.select({
            type: transactions.type,
            total: sql<number>`COALESCE(sum(${transactions.amount}), 0)`,
        })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, memberId),
                eq(transactions.status, 'APPROVED'),
                sql`${transactions.type} IN ('LOAN', 'REPAYMENT')`
            ))
            .groupBy(transactions.type) : Promise.resolve([]),
        hasFinance ? db.select({
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                eq(financeCollectionMembers.memberId, memberId)
            )) : Promise.resolve([]),
    ]);

    const memberTransactionsWithBalance = (() => {
        const sorted = [...(memberTransactions as any[])].sort((a, b) => {
            const aAt = new Date(a.approvedAt || a.createdAt).getTime();
            const bAt = new Date(b.approvedAt || b.createdAt).getTime();
            return bAt - aAt;
        });

        let runningAfter = member.balance || 0;
        const calcMemberDelta = (t: any) => {
            const amt = Number(t.amount) || 0;
            switch (t.type) {
                case 'LOAN':
                case 'GANG_FEE':
                case 'PENALTY':
                    return -amt;
                case 'REPAYMENT':
                case 'DEPOSIT':
                    return amt;
                default:
                    return 0;
            }
        };

        return sorted.map((t) => {
            const delta = calcMemberDelta(t);
            const memberBalanceAfter = runningAfter;
            const memberBalanceBefore = memberBalanceAfter - delta;
            runningAfter = memberBalanceBefore;
            return {
                ...t,
                memberBalanceBefore,
                memberBalanceAfter,
            };
        });
    })();

    const totalLoan = Number(loanSummaryRaw.find((row) => row.type === 'LOAN')?.total || 0);
    const totalRepayment = Number(loanSummaryRaw.find((row) => row.type === 'REPAYMENT')?.total || 0);
    const loanDebt = Math.max(0, totalLoan - totalRepayment);
    const collectionDue = Number(collectionDueRaw[0]?.total || 0);

    return (
        <MemberActivityClient
            member={{ ...member, balance: hasFinance ? member.balance : 0 }}
            attendance={memberAttendance}
            leaves={memberLeaves}
            transactions={memberTransactionsWithBalance as any}
            gangId={gangId}
            financeSummary={{
                loanDebt,
                collectionDue,
                availableCredit: hasFinance ? Math.max(0, Number(member.balance) || 0) : 0,
            }}
        />
    );
}
