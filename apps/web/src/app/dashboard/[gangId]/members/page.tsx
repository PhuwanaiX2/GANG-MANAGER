export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, members, transactions, financeCollectionMembers } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { MembersTable } from '@/components/MembersTable';
import { Users, ShieldCheck } from 'lucide-react';

interface Props {
    params: { gangId: string };
}

export default async function MembersPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Parallelize data fetching
    const [allMembersRaw, currentUserMember, loanSummaryRaw, collectionDueRaw] = await Promise.all([
        db.query.members.findMany({
            where: eq(members.gangId, gangId),
            orderBy: (members, { asc }) => [asc(members.name)],
        }),
        // Security check: Is current user a member?
        db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
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

    if (!currentUserMember) {
        redirect('/dashboard');
    }

    if (currentUserMember.status !== 'APPROVED') {
        redirect(`/dashboard/${gangId}`);
    }

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

    const allMembers = allMembersRaw.map((member) => {
        const loan = loanMap.get(member.id)?.loan || 0;
        const repayment = loanMap.get(member.id)?.repayment || 0;
        return {
            ...member,
            loanDebt: Math.max(0, loan - repayment),
            collectionDue: collectionDueMap.get(member.id) || 0,
        };
    });

    const canManageMembers = ['OWNER', 'ADMIN'].includes(currentUserMember.gangRole || '');
    const visibleMembers = canManageMembers
        ? allMembers
        : allMembers.filter((member) => member.status === 'APPROVED');
    const activeMembers = visibleMembers.filter((member) => member.isActive && member.status === 'APPROVED').length;
    const pendingMembers = canManageMembers
        ? visibleMembers.filter((member) => member.status === 'PENDING').length
        : 0;

    return (
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white font-heading mb-2">สมาชิกในระบบ</h1>
                    <div className="flex items-center gap-3 text-sm text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-zinc-500" />
                            <span>ทั้งหมด {visibleMembers.length} คน</span>
                        </div>
                        <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-zinc-300">ประจำการ {activeMembers} คน</span>
                        </div>
                        {pendingMembers > 0 && (
                            <>
                                <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                                <div className="flex items-center gap-1.5 text-amber-400">
                                    <span>รออนุมัติ {pendingMembers} คน</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <MembersTable members={visibleMembers} gangId={gangId} canManageMembers={canManageMembers} />
        </div>
    );
}
