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
} from 'lucide-react';
import { MemberActivityClient } from '../members/[memberId]/MemberActivityClient';

interface Props {
    params: { gangId: string };
}

export default async function MyProfilePage({ params }: Props) {
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
        db.select({ sum: sql<number>`COALESCE(sum(${transactions.amount}), 0)` })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, member.id),
                eq(transactions.type, 'PENALTY'),
                eq(transactions.status, 'APPROVED')
            )),
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { balance: true }
        }),
        db.select({
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
            .groupBy(transactions.type),
        db.select({
            total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
        })
            .from(financeCollectionMembers)
            .where(and(
                eq(financeCollectionMembers.gangId, gangId),
                eq(financeCollectionMembers.memberId, member.id)
            )),
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
        db.query.transactions.findMany({
            where: and(
                eq(transactions.memberId, member.id),
                eq(transactions.status, 'APPROVED')
            ),
            orderBy: desc(transactions.approvedAt),
        }),
    ]);

    const totalSessions = totalSessionsResult[0]?.count || 0;
    const present = presentResult[0]?.count || 0;
    const absent = absentResult[0]?.count || 0;
    const leave = leaveResult[0]?.count || 0;
    const totalPenalties = penaltyResult[0]?.sum || 0;
    const attendanceRate = totalSessions > 0 ? Math.round((present / totalSessions) * 100) : 0;
    const balance = member.balance || 0;
    const gangBalance = gangResult?.balance || 0;
    const totalLoan = Number(loanSummaryRaw.find((row) => row.type === 'LOAN')?.total || 0);
    const totalRepayment = Number(loanSummaryRaw.find((row) => row.type === 'REPAYMENT')?.total || 0);
    const loanDebt = Math.max(0, totalLoan - totalRepayment);
    const collectionDue = Number(collectionDueRaw[0]?.total || 0);
    const totalOutstanding = loanDebt + collectionDue;
    const memberFinanceLabel = totalOutstanding > 0 ? 'ยอดค้างกับกองกลาง' : balance > 0 ? 'เครดิต/สำรองจ่ายกับกองกลาง' : 'สถานะกับกองกลาง';
    const memberFinanceSubtext = totalOutstanding > 0
        ? `หนี้ยืม ฿${loanDebt.toLocaleString()} • ค้างเก็บเงิน ฿${collectionDue.toLocaleString()}`
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
            <div className="mb-8 animate-fade-in relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 mb-3">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-blue-500 text-[10px] font-black tracking-widest uppercase">My Profile</span>
                </div>
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white mb-2 drop-shadow-sm">ยอดของฉัน</h1>
            </div>

            {/* Profile Card */}
            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 mb-8 backdrop-blur-sm animate-fade-in-up relative z-10">
                <div className="flex items-center gap-6">
                    <img
                        src={member.discordAvatar || '/avatars/0.png'}
                        alt={member.name}
                        className="w-20 h-20 rounded-2xl border-2 border-white/10 shadow-xl"
                    />
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">{member.name}</h2>
                        <div className="flex items-center gap-3 mt-2">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-discord-primary/10 border border-discord-primary/20 text-discord-primary text-xs font-bold">
                                <Shield className="w-3.5 h-3.5" />
                                {roleLabels[member.gangRole || 'MEMBER']}
                            </span>
                            <span className="text-gray-500 text-xs font-medium">
                                @{member.discordUsername}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-fade-in-up relative z-10">
                <div className={`bg-white/[0.02] border p-5 rounded-2xl ${totalOutstanding > 0 ? 'border-red-500/20' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <div className={`p-1.5 rounded-lg ${totalOutstanding > 0 ? 'bg-red-500/10' : 'bg-emerald-500/10'}`}>
                            <Wallet className={`w-4 h-4 ${totalOutstanding > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                        </div>
                        <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">{memberFinanceLabel}</span>
                    </div>
                    <div className={`text-2xl font-black tabular-nums ${totalOutstanding > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                        {totalOutstanding > 0 ? '' : balance > 0 ? '+' : ''}฿{Math.abs(totalOutstanding > 0 ? totalOutstanding : balance).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">{memberFinanceSubtext}</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-discord-primary/10">
                            <Wallet className="w-4 h-4 text-discord-primary" />
                        </div>
                        <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">ยอดกองกลาง</span>
                    </div>
                    <div className="text-2xl font-black text-white tabular-nums">
                        ฿{gangBalance.toLocaleString()}
                    </div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/10">
                            <CalendarCheck className="w-4 h-4 text-blue-500" />
                        </div>
                        <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">เข้างาน</span>
                    </div>
                    <div className="text-2xl font-black text-white tabular-nums">{attendanceRate}%</div>
                    <div className="text-[10px] text-gray-600 mt-1">มา {present} / ขาด {absent} / ลา {leave}</div>
                </div>
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg bg-orange-500/10">
                            <TrendingDown className="w-4 h-4 text-orange-500" />
                        </div>
                        <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">ค่าปรับสะสม</span>
                    </div>
                    <div className="text-2xl font-black text-orange-400 tabular-nums">฿{totalPenalties.toLocaleString()}</div>
                </div>
            </div>

            {/* Activity Timeline (reuse MemberActivityClient) */}
            <div className="animate-fade-in-up relative z-10">
                <MemberActivityClient
                    member={member}
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
