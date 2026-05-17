export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, members, transactions, financeCollectionMembers } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { MembersTable } from '@/components/MembersTable';
import { AlertTriangle, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Badge, OpsMetricCard, OpsPageHeader } from '@/components/ui';
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
            <OpsPageHeader
                eyebrow="Roster Command"
                title="คนในแก๊ง"
                description="ดูสมาชิก ยศ สถานะ และยอดเงินรายคน กดชื่อเพื่อเปิดประวัติเต็ม"
                icon={Users}
                tone="accent"
                compact
                meta={pendingMembers > 0 ? (
                    <Badge tone="warning" variant="soft" size="md">
                        มีสมาชิกใหม่รออนุมัติ {pendingMembers} คน
                    </Badge>
                ) : null}
            />

            <section className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <OpsMetricCard label="ทั้งหมด" value={visibleMembers.length} icon={Users} helper="สมาชิกที่เห็นได้" />
                <OpsMetricCard label="Active" value={activeMembers} icon={ShieldCheck} tone="success" helper="พร้อมใช้งาน" />
                <OpsMetricCard label="ค้างเงิน" value={debtMembers} icon={AlertTriangle} tone="warning" helper="ต้องตามต่อ" />
                <OpsMetricCard label="เครดิต" value={creditMembers} icon={Wallet} tone="info" helper="จ่ายเกิน/ฝากไว้" />
            </section>

            <MembersTable members={visibleMembers} gangId={gangId} canManageMembers={canManageMembers} />
        </div>
    );
}
