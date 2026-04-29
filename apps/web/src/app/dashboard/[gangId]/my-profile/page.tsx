export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, transactions, attendanceRecords, attendanceSessions, leaveRequests, financeCollectionMembers } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
    Wallet,
    CalendarCheck,
    TrendingDown,
    Shield,
    UserCircle2,
} from 'lucide-react';
import { MemberActivityClient } from '../members/[memberId]/MemberActivityClient';
import { Card, Badge } from '@/components/ui';
import { checkTierAccess } from '@/lib/tierGuard';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default async function MyProfilePage(props: Props) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Find member
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

    // Parallel fetch: stats + activity data (for MemberActivityClient)
    const [
        totalSessionsResult,
        presentResult,
        absentResult,
        leaveResult,
        penaltyResult,
        gangResult,
        loanSummaryRaw,
        collectionDueRaw,
        memberAttendance,
        memberLeaves,
        memberTransactions,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` })
            .from(attendanceSessions)
            .where(and(
                eq(attendanceSessions.gangId, gangId),
                eq(attendanceSessions.status, 'CLOSED')
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(attendanceRecords)
            .where(and(
                eq(attendanceRecords.memberId, member.id),
                eq(attendanceRecords.status, 'PRESENT')
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(attendanceRecords)
            .where(and(
                eq(attendanceRecords.memberId, member.id),
                eq(attendanceRecords.status, 'ABSENT')
            )),
        db.select({ count: sql<number>`count(*)` })
            .from(attendanceRecords)
            .where(and(
                eq(attendanceRecords.memberId, member.id),
                eq(attendanceRecords.status, 'LEAVE')
            )),
        hasFinance ? db.select({ sum: sql<number>`COALESCE(sum(${transactions.amount}), 0)` })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, member.id),
                eq(transactions.type, 'PENALTY'),
                eq(transactions.status, 'APPROVED')
            )) : Promise.resolve([{ sum: 0 }]),
        hasFinance ? db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { balance: true }
        }) : Promise.resolve({ balance: 0 }),
        hasFinance ? db.select({
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
            .groupBy(transactions.type) : Promise.resolve([]),
        hasFinance ? db.select({
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                eq(financeCollectionMembers.memberId, member.id)
            )) : Promise.resolve([]),
        // Activity data for timeline
        db.query.attendanceRecords.findMany({
            where: eq(attendanceRecords.memberId, member.id),
            with: { session: true },
            orderBy: desc(attendanceRecords.createdAt),
        }),
        db.query.leaveRequests.findMany({
            where: eq(leaveRequests.memberId, member.id),
            orderBy: desc(leaveRequests.requestedAt),
        }),
        hasFinance ? db.query.transactions.findMany({
            where: and(
                eq(transactions.memberId, member.id),
                eq(transactions.status, 'APPROVED')
            ),
            orderBy: desc(transactions.approvedAt),
        }) : Promise.resolve([]),
    ]);

    const totalSessions = totalSessionsResult[0]?.count || 0;
    const present = presentResult[0]?.count || 0;
    const absent = absentResult[0]?.count || 0;
    const leave = leaveResult[0]?.count || 0;
    const totalPenalties = penaltyResult[0]?.sum || 0;
    const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;
    const balance = hasFinance ? member.balance || 0 : 0;
    const gangBalance = gangResult?.balance || 0;
    const totalLoan = Number(loanSummaryRaw.find((row) => row.type === 'LOAN')?.total || 0);
    const totalRepayment = Number(loanSummaryRaw.find((row) => row.type === 'REPAYMENT')?.total || 0);
    const loanDebt = Math.max(0, totalLoan - totalRepayment);
    const collectionDue = Number(collectionDueRaw[0]?.total || 0);
    const totalOutstanding = loanDebt + collectionDue;
    const memberFinanceLabel = totalOutstanding > 0 ? 'ยอดค้างกับกองกลาง' : balance > 0 ? 'เครดิต/สำรองจ่ายกับกองกลาง' : 'สถานะกับกองกลาง';
    const memberFinanceSubtext = totalOutstanding > 0
        ? `หนี้ยืม ฿${loanDebt.toLocaleString()} • ค้างเก็บเงินแก๊ง ฿${collectionDue.toLocaleString()}`
        : balance > 0
            ? 'คุณมีเครดิตหรือสำรองจ่ายแทนแก๊งไว้'
            : 'ขณะนี้ไม่มียอดค้างหรือเครดิตคงเหลือ';

    const memberTransactionsWithBalance = (() => {
        const sorted = [...(memberTransactions as any[])].sort((a, b) => {
            const aAt = new Date(a.approvedAt || a.createdAt).getTime();
            const bAt = new Date(b.approvedAt || b.createdAt).getTime();
            return bAt - aAt;
        });

        let runningAfter = balance;
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

    const roleLabels: Record<string, string> = {
        OWNER: 'หัวหน้าแก๊ง',
        ADMIN: 'รองหัวหน้า',
        TREASURER: 'เหรัญญิก',
        MEMBER: 'สมาชิก',
    };

    return (
        <>
            {/* Header */}
            <div className="mb-8 animate-fade-in relative z-10 overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-md">
                <div className="absolute -right-20 -top-24 h-56 w-56 rounded-token-full bg-status-info-subtle blur-3xl" />
                <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-status-info to-transparent opacity-50" />
                <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-token-full bg-status-info-subtle border border-status-info mb-3 shadow-token-sm">
                        <span className="w-1.5 h-1.5 rounded-token-full bg-status-info animate-pulse" />
                        <span className="text-fg-info text-[10px] font-black tracking-widest uppercase">My Profile</span>
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-fg-primary mb-2 drop-shadow-sm font-heading">ยอดของฉัน</h1>
                    <p className="max-w-2xl text-sm leading-relaxed text-fg-secondary">
                        มุมมองส่วนตัวสำหรับตรวจยอดค้าง เครดิต ประวัติเช็คชื่อ การลา และรายการเงินที่เกี่ยวข้องกับคุณ
                    </p>
                </div>
            </div>

            {/* Profile Card */}
            <Card variant="subtle" padding="lg" className="mb-8 animate-fade-in-up relative z-10 overflow-hidden shadow-token-sm">
                <div className="absolute -left-16 -bottom-20 h-44 w-44 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="relative z-10 flex flex-col items-start gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-6">
                    {member.discordAvatar ? (
                        <img
                            src={member.discordAvatar}
                            alt={member.name}
                            className="w-20 h-20 rounded-token-2xl border-2 border-border-subtle shadow-token-md shrink-0"
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-token-2xl border-2 border-border-subtle bg-bg-muted flex items-center justify-center shrink-0">
                            <UserCircle2 className="w-10 h-10 text-fg-tertiary" />
                        </div>
                    )}
                        <div className="min-w-0">
                            <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Personal Ledger</p>
                            <h2 className="text-2xl sm:text-3xl font-black text-fg-primary tracking-tight font-heading truncate">{member.name}</h2>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mt-2">
                                <Badge tone="accent" variant="soft" size="md" className="gap-1.5">
                                    <Shield className="w-3.5 h-3.5" />
                                    {roleLabels[member.gangRole || 'MEMBER']}
                                </Badge>
                                <span className="text-fg-tertiary text-xs font-medium truncate">
                                    @{member.discordUsername}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2 sm:w-auto">
                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Attendance</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{attendanceRate}%</p>
                        </div>
                        <div className="rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Records</p>
                            <p className="mt-1 text-xl font-black text-fg-primary tabular-nums">{memberAttendance.length + memberLeaves.length + memberTransactions.length}</p>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up relative z-10">
                <div className={`relative overflow-hidden bg-bg-subtle border p-5 rounded-token-2xl shadow-token-sm transition-colors duration-token-normal ease-token-standard ${totalOutstanding > 0 ? 'border-status-danger' : 'border-border-subtle'}`}>
                    <div className={`absolute -right-10 -top-10 h-24 w-24 rounded-token-full blur-2xl ${totalOutstanding > 0 ? 'bg-status-danger-subtle' : 'bg-status-success-subtle'}`} />
                    <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-token-md ${totalOutstanding > 0 ? 'bg-status-danger-subtle' : 'bg-status-success-subtle'}`}>
                            <Wallet className={`w-4 h-4 ${totalOutstanding > 0 ? 'text-fg-danger' : 'text-fg-success'}`} />
                        </div>
                        <span className="text-fg-secondary text-[10px] font-bold tracking-widest uppercase truncate">{memberFinanceLabel}</span>
                    </div>
                    <div className={`text-2xl font-black tabular-nums ${totalOutstanding > 0 ? 'text-fg-danger' : 'text-fg-success'}`}>
                        {totalOutstanding > 0 ? '' : balance > 0 ? '+' : ''}฿{Math.abs(totalOutstanding > 0 ? totalOutstanding : balance).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-fg-tertiary mt-1 truncate">{memberFinanceSubtext}</div>
                    {totalOutstanding > 0 && (
                        <div className="text-[10px] text-fg-tertiary mt-2 leading-relaxed">
                            หนี้ยืมกับค้างเก็บเงินแก๊งเป็นคนละยอด: ชำระหนี้ยืมด้วยปุ่มชำระหนี้ยืม และชำระยอดเก็บเงินแก๊งด้วยปุ่มเก็บเงินแก๊ง/ฝากเครดิต
                        </div>
                    )}
                    </div>
                </div>
                <div className="relative overflow-hidden bg-bg-subtle border border-border-subtle p-5 rounded-token-2xl shadow-token-sm">
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-token-full bg-accent-subtle blur-2xl" />
                    <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-token-md bg-accent-subtle">
                            <Wallet className="w-4 h-4 text-accent-bright" />
                        </div>
                        <span className="text-fg-secondary text-[10px] font-bold tracking-widest uppercase">ยอดกองกลาง</span>
                    </div>
                    <div className="text-2xl font-black text-fg-primary tabular-nums">
                        ฿{gangBalance.toLocaleString()}
                    </div>
                    </div>
                </div>
                <div className="relative overflow-hidden bg-bg-subtle border border-border-subtle p-5 rounded-token-2xl shadow-token-sm">
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-token-full bg-status-info-subtle blur-2xl" />
                    <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-token-md bg-status-info-subtle">
                            <CalendarCheck className="w-4 h-4 text-fg-info" />
                        </div>
                        <span className="text-fg-secondary text-[10px] font-bold tracking-widest uppercase">เข้างาน</span>
                    </div>
                    <div className="text-2xl font-black text-fg-primary tabular-nums">{attendanceRate}%</div>
                    <div className="text-[10px] text-fg-tertiary mt-1">มา {present} / ขาด {absent} / ลา {leave}</div>
                    </div>
                </div>
                <div className="relative overflow-hidden bg-bg-subtle border border-border-subtle p-5 rounded-token-2xl shadow-token-sm">
                    <div className="absolute -right-10 -top-10 h-24 w-24 rounded-token-full bg-status-warning-subtle blur-2xl" />
                    <div className="relative z-10">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-token-md bg-status-warning-subtle">
                            <TrendingDown className="w-4 h-4 text-fg-warning" />
                        </div>
                        <span className="text-fg-secondary text-[10px] font-bold tracking-widest uppercase">ค่าปรับสะสม</span>
                    </div>
                    <div className="text-2xl font-black text-fg-warning tabular-nums">฿{totalPenalties.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Activity Timeline (reuse MemberActivityClient) */}
            <div className="animate-fade-in-up relative z-10">
                <MemberActivityClient
                    member={{ ...member, balance }}
                    attendance={memberAttendance}
                    leaves={memberLeaves}
                    transactions={memberTransactionsWithBalance as any}
                    gangId={gangId}
                    hideHeader={true}
                    financeSummary={{
                        loanDebt,
                        collectionDue,
                        availableCredit: Math.max(0, balance),
                    }}
                />
            </div>
        </>
    );
}
