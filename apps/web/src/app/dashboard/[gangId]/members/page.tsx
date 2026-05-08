export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, members, transactions, financeCollectionMembers } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { MembersTable } from '@/components/MembersTable';
import { AlertTriangle, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui';
import { checkTierAccess } from '@/lib/tierGuard';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function MembersPage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;
    const financeTierCheck = await checkTierAccess(gangId, 'finance');
    const hasFinance = financeTierCheck.allowed;

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
        hasFinance ? db.select({
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
            .groupBy(transactions.memberId, transactions.type) : Promise.resolve([]),
        hasFinance ? db.select({
            memberId: financeCollectionMembers.memberId,
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
        })
            .from(financeCollectionMembers)
            .where(eq(financeCollectionMembers.gangId, gangId))
            .groupBy(financeCollectionMembers.memberId) : Promise.resolve([]),
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
            balance: hasFinance ? member.balance : 0,
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
    const debtMembers = hasFinance
        ? visibleMembers.filter((member) => (member.loanDebt || 0) + (member.collectionDue || 0) > 0).length
        : 0;
    const creditMembers = hasFinance
        ? visibleMembers.filter((member) => (member.balance || 0) > 0).length
        : 0;

    return (
        <div className="animate-fade-in space-y-4">
            <section className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                        <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 shadow-token-sm">
                            <span className="h-1.5 w-1.5 rounded-token-full bg-accent-bright" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Roster Command</span>
                        </div>
                        <h1 className="font-heading text-2xl font-black tracking-tight text-fg-primary sm:text-3xl">คนในแก๊ง</h1>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-fg-secondary sm:text-sm">
                            ดูสมาชิก ยศ สถานะ และยอดเงินรายคน กดชื่อเพื่อเปิดประวัติเต็ม
                        </p>
                    </div>
                    <div className="grid grid-cols-4 gap-2 lg:min-w-[500px]">
                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-2 py-2.5 shadow-inner sm:px-3">
                            <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
                                <Users className="h-3.5 w-3.5 text-fg-tertiary sm:h-4 sm:w-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-fg-secondary sm:text-[10px]">ทั้งหมด</span>
                            </div>
                            <span className="text-lg font-black leading-none text-fg-primary tabular-nums sm:text-xl">{visibleMembers.length}</span>
                        </div>
                        <div className="rounded-token-xl border border-status-success bg-status-success-subtle px-2 py-2.5 shadow-inner sm:px-3">
                            <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
                                <ShieldCheck className="h-3.5 w-3.5 text-fg-success sm:h-4 sm:w-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-fg-success sm:text-[10px]">Active</span>
                            </div>
                            <span className="text-lg font-black leading-none text-fg-primary tabular-nums sm:text-xl">{activeMembers}</span>
                        </div>
                        <div className="rounded-token-xl border border-status-warning bg-status-warning-subtle px-2 py-2.5 shadow-inner sm:px-3">
                            <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 text-fg-warning sm:h-4 sm:w-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-fg-warning sm:text-[10px]">ค้างเงิน</span>
                            </div>
                            <span className="text-lg font-black leading-none text-fg-primary tabular-nums sm:text-xl">{debtMembers}</span>
                        </div>
                        <div className="rounded-token-xl border border-status-info bg-status-info-subtle px-2 py-2.5 shadow-inner sm:px-3">
                            <div className="mb-1 flex items-center gap-1.5 sm:gap-2">
                                <Wallet className="h-3.5 w-3.5 text-fg-info sm:h-4 sm:w-4" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-fg-info sm:text-[10px]">เครดิต</span>
                            </div>
                            <span className="text-lg font-black leading-none text-fg-primary tabular-nums sm:text-xl">{creditMembers}</span>
                        </div>
                    </div>
                </div>
                {pendingMembers > 0 && (
                    <div className="mt-3">
                        <Badge tone="warning" variant="soft" size="md">
                            มีสมาชิกใหม่รออนุมัติ {pendingMembers} คน
                        </Badge>
                    </div>
                )}
            </section>

            <MembersTable members={visibleMembers} gangId={gangId} canManageMembers={canManageMembers} />
        </div>
    );
}
