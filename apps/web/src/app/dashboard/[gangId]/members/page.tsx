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
        <div className="animate-fade-in space-y-6">
            <div className="relative overflow-hidden rounded-token-3xl border border-border-subtle bg-bg-subtle p-5 shadow-token-md sm:p-6">
                <div className="pointer-events-none absolute -right-20 -top-24 h-60 w-60 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 left-8 h-52 w-52 rounded-token-full bg-status-info-subtle blur-3xl" />
                <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-3xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-accent-subtle border border-border-accent mb-3 shadow-token-sm">
                            <span className="w-1.5 h-1.5 rounded-token-full bg-accent-bright animate-pulse" />
                            <span className="text-accent-bright text-[10px] font-black tracking-widest uppercase">People Command</span>
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-fg-primary font-heading">คนในแก๊ง</h1>
                        <p className="mt-2 text-sm leading-6 text-fg-secondary">
                            ใช้หน้านี้เพื่อดูว่าใครยังอยู่ในแก๊ง ใครรออนุมัติ ใครมีหนี้/เครดิต และกดเข้าโปรไฟล์เพื่อดูประวัติเช็คชื่อ การลา และการเงินรายคน
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[520px]">
                        <div className="rounded-token-2xl border border-border-subtle bg-bg-muted/78 px-3 py-3 shadow-token-sm">
                            <div className="mb-1 flex items-center gap-2">
                                <Users className="w-4 h-4 text-fg-tertiary" />
                                <span className="text-fg-secondary text-[10px] font-black uppercase tracking-widest">ทั้งหมด</span>
                            </div>
                            <span className="text-2xl font-black text-fg-primary tabular-nums leading-none">{visibleMembers.length}</span>
                        </div>
                        <div className="rounded-token-2xl border border-status-success bg-status-success-subtle px-3 py-3 shadow-token-sm">
                            <div className="mb-1 flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-fg-success" />
                                <span className="text-fg-success text-[10px] font-black uppercase tracking-widest">Active</span>
                            </div>
                            <span className="text-2xl font-black text-fg-primary tabular-nums leading-none">{activeMembers}</span>
                        </div>
                        <div className="rounded-token-2xl border border-status-warning bg-status-warning-subtle px-3 py-3 shadow-token-sm">
                            <div className="mb-1 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-fg-warning" />
                                <span className="text-fg-warning text-[10px] font-black uppercase tracking-widest">ค้างเงิน</span>
                            </div>
                            <span className="text-2xl font-black text-fg-primary tabular-nums leading-none">{debtMembers}</span>
                        </div>
                        <div className="rounded-token-2xl border border-status-info bg-status-info-subtle px-3 py-3 shadow-token-sm">
                            <div className="mb-1 flex items-center gap-2">
                                <Wallet className="w-4 h-4 text-fg-info" />
                                <span className="text-fg-info text-[10px] font-black uppercase tracking-widest">เครดิต</span>
                            </div>
                            <span className="text-2xl font-black text-fg-primary tabular-nums leading-none">{creditMembers}</span>
                        </div>
                    </div>
                </div>
                {pendingMembers > 0 && (
                    <div className="relative z-10 mt-5">
                        <Badge tone="warning" variant="soft" size="md">
                            มีสมาชิกใหม่รออนุมัติ {pendingMembers} คน
                        </Badge>
                    </div>
                )}
            </div>

            <MembersTable members={visibleMembers} gangId={gangId} canManageMembers={canManageMembers} />
        </div>
    );
}
