export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { and, desc, eq, sql } from 'drizzle-orm';
import {
    Activity,
    CalendarCheck,
    FileText,
    Shield,
    TrendingDown,
    UserCircle2,
    Wallet,
} from 'lucide-react';
import {
    attendanceRecords,
    attendanceSessions,
    db,
    financeCollectionMembers,
    gangs,
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

const roleLabels: Record<string, string> = {
    OWNER: 'หัวหน้าแก๊ง',
    ADMIN: 'รองหัวหน้า',
    TREASURER: 'เหรัญญิก',
    ATTENDANCE_OFFICER: 'เจ้าหน้าที่เช็คชื่อ',
    MEMBER: 'สมาชิก',
};

const financeLabel = (loanDebt: number, collectionDue: number, balance: number) => {
    const totalOutstanding = loanDebt + collectionDue;
    if (totalOutstanding > 0) return 'ยอดค้างกับกองกลาง';
    if (balance > 0) return 'เครดิต/สำรองจ่าย';
    return 'สถานะการเงิน';
};

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
            columns: { balance: true },
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

    const totalSessions = Number(totalSessionsResult[0]?.count || 0);
    const present = Number(presentResult[0]?.count || 0);
    const absent = Number(absentResult[0]?.count || 0);
    const leave = Number(leaveResult[0]?.count || 0);
    const totalPenalties = Number(penaltyResult[0]?.sum || 0);
    const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;
    const balance = hasFinance ? Number(member.balance || 0) : 0;
    const gangBalance = hasFinance ? Number(gangResult?.balance || 0) : 0;
    const totalLoan = Number(loanSummaryRaw.find((row) => row.type === 'LOAN')?.total || 0);
    const totalRepayment = Number(loanSummaryRaw.find((row) => row.type === 'REPAYMENT')?.total || 0);
    const loanDebt = Math.max(0, totalLoan - totalRepayment);
    const collectionDue = Number(collectionDueRaw[0]?.total || 0);
    const totalOutstanding = loanDebt + collectionDue;
    const activityCount = memberAttendance.length + memberLeaves.length + memberTransactions.length;
    const pendingLeaves = memberLeaves.filter((request) => request.status === 'PENDING').length;

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

    const primaryFinanceValue = totalOutstanding > 0 ? totalOutstanding : balance;
    const primaryFinanceTone = totalOutstanding > 0
        ? 'text-fg-danger'
        : balance > 0
            ? 'text-fg-success'
            : 'text-fg-secondary';
    const primaryFinanceSubtext = totalOutstanding > 0
        ? `หนี้ยืม ฿${loanDebt.toLocaleString()} / ค้างเก็บ ฿${collectionDue.toLocaleString()}`
        : balance > 0
            ? 'มีเครดิตหรือยอดสำรองจ่ายคงเหลือ'
            : 'ไม่มีหนี้หรือเครดิตคงเหลือ';

    return (
        <div className="animate-fade-in space-y-6">
            <section className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm sm:p-6">
                <div className="absolute -right-20 -top-24 h-60 w-60 rounded-token-full bg-status-info-subtle blur-3xl" />
                <div className="absolute -bottom-24 left-10 h-52 w-52 rounded-token-full bg-accent-subtle blur-3xl" />
                <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
                        {member.discordAvatar ? (
                            <img
                                src={member.discordAvatar}
                                alt={member.name}
                                className="h-20 w-20 shrink-0 rounded-token-2xl border-2 border-border-subtle object-cover shadow-token-md"
                            />
                        ) : (
                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-token-2xl border-2 border-border-subtle bg-bg-muted shadow-token-md">
                                <UserCircle2 className="h-10 w-10 text-fg-tertiary" />
                            </div>
                        )}

                        <div className="min-w-0">
                            <div className="mb-2 inline-flex items-center gap-2 rounded-token-full border border-status-info bg-status-info-subtle px-3 py-1 shadow-token-sm">
                                <span className="h-1.5 w-1.5 rounded-token-full bg-status-info" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-fg-info">My Profile</span>
                            </div>
                            <h1 className="truncate font-heading text-3xl font-black tracking-tight text-fg-primary sm:text-5xl">
                                {member.name}
                            </h1>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-fg-tertiary">
                                <span className="inline-flex items-center gap-1.5 rounded-token-full border border-border-subtle bg-bg-muted px-3 py-1 text-fg-secondary">
                                    <Shield className="h-3.5 w-3.5" />
                                    {roleLabels[member.gangRole || 'MEMBER'] || member.gangRole || 'สมาชิก'}
                                </span>
                                {member.discordUsername && <span>@{member.discordUsername}</span>}
                                {member.discordId && <span className="font-mono tabular-nums">ID {member.discordId}</span>}
                            </div>
                            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-fg-secondary">
                                โปรไฟล์ส่วนตัวสำหรับเช็คสถานะการเงิน การเช็คชื่อ การลา และประวัติกิจกรรมของคุณในแก๊งแบบเดียวกับหน้าสมาชิก
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 lg:min-w-[360px]">
                        <div className="rounded-token-xl border border-status-success/30 bg-status-success-subtle px-3 py-3 text-center shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-success">มา</p>
                            <p className="mt-1 text-xl font-black tabular-nums text-fg-primary">{present}</p>
                        </div>
                        <div className="rounded-token-xl border border-status-danger/30 bg-status-danger-subtle px-3 py-3 text-center shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-danger">ขาด</p>
                            <p className="mt-1 text-xl font-black tabular-nums text-fg-primary">{absent}</p>
                        </div>
                        <div className="rounded-token-xl border border-status-info/30 bg-status-info-subtle px-3 py-3 text-center shadow-inner">
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-info">เรต</p>
                            <p className="mt-1 text-xl font-black tabular-nums text-fg-primary">{attendanceRate}%</p>
                        </div>
                    </div>
                </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className={`relative overflow-hidden rounded-token-2xl border bg-bg-subtle p-5 shadow-token-sm ${totalOutstanding > 0 ? 'border-status-danger/50' : 'border-border-subtle'}`}>
                    <div className={`absolute -right-12 -top-12 h-28 w-28 rounded-token-full blur-2xl ${totalOutstanding > 0 ? 'bg-status-danger-subtle' : 'bg-status-success-subtle'}`} />
                    <div className="relative z-10">
                        <div className="mb-2 flex items-center gap-2">
                            <Wallet className={`h-4 w-4 ${totalOutstanding > 0 ? 'text-fg-danger' : 'text-fg-success'}`} />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                                {financeLabel(loanDebt, collectionDue, balance)}
                            </p>
                        </div>
                        <p className={`text-2xl font-black tabular-nums ${primaryFinanceTone}`}>
                            {totalOutstanding > 0 ? '' : balance > 0 ? '+' : ''}฿{Math.abs(primaryFinanceValue).toLocaleString()}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-fg-tertiary">{primaryFinanceSubtext}</p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                    <div className="absolute -right-12 -top-12 h-28 w-28 rounded-token-full bg-accent-subtle blur-2xl" />
                    <div className="relative z-10">
                        <div className="mb-2 flex items-center gap-2">
                            <Wallet className="h-4 w-4 text-accent-bright" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">กองกลาง</p>
                        </div>
                        <p className="text-2xl font-black tabular-nums text-fg-primary">฿{gangBalance.toLocaleString()}</p>
                        <p className="mt-1 text-xs font-semibold text-fg-tertiary">ยอดรวมของแก๊งที่ระบบอนุมัติแล้ว</p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                    <div className="absolute -right-12 -top-12 h-28 w-28 rounded-token-full bg-status-info-subtle blur-2xl" />
                    <div className="relative z-10">
                        <div className="mb-2 flex items-center gap-2">
                            <CalendarCheck className="h-4 w-4 text-fg-info" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">เช็คชื่อ</p>
                        </div>
                        <p className="text-2xl font-black tabular-nums text-fg-primary">{attendanceRate}%</p>
                        <p className="mt-1 text-xs font-semibold text-fg-tertiary">มา {present} / ขาด {absent} / ลา {leave}</p>
                    </div>
                </div>

                <div className="relative overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                    <div className="absolute -right-12 -top-12 h-28 w-28 rounded-token-full bg-status-warning-subtle blur-2xl" />
                    <div className="relative z-10">
                        <div className="mb-2 flex items-center gap-2">
                            <TrendingDown className="h-4 w-4 text-fg-warning" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ค่าปรับสะสม</p>
                        </div>
                        <p className="text-2xl font-black tabular-nums text-fg-warning">฿{totalPenalties.toLocaleString()}</p>
                        <p className="mt-1 text-xs font-semibold text-fg-tertiary">เฉพาะรายการที่อนุมัติแล้ว</p>
                    </div>
                </div>
            </section>

            <section className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                        <Activity className="h-4 w-4 text-fg-info" />
                        Activity
                    </div>
                    <p className="text-xl font-black tabular-nums text-fg-primary">{activityCount.toLocaleString()} รายการ</p>
                    <p className="mt-1 text-xs font-semibold text-fg-tertiary">รวมเช็คชื่อ การลา และรายการเงินของคุณ</p>
                </div>
                <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                        <FileText className="h-4 w-4 text-accent-bright" />
                        Leave Queue
                    </div>
                    <p className="text-xl font-black tabular-nums text-fg-primary">{pendingLeaves.toLocaleString()} คำขอ</p>
                    <p className="mt-1 text-xs font-semibold text-fg-tertiary">คำขอลาที่กำลังรออนุมัติ</p>
                </div>
                <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                        <Shield className="h-4 w-4 text-fg-success" />
                        Status
                    </div>
                    <p className="text-xl font-black text-fg-primary">{member.status === 'APPROVED' ? 'พร้อมใช้งาน' : member.status}</p>
                    <p className="mt-1 text-xs font-semibold text-fg-tertiary">สถานะสมาชิกที่ใช้กับสิทธิ์บนเว็บและ Discord</p>
                </div>
            </section>

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
    );
}
