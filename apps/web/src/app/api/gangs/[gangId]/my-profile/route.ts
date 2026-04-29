import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, transactions, attendanceRecords, attendanceSessions, financeCollectionMembers, getOutstandingLoanDebt } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logError } from '@/lib/logger';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { checkTierAccess } from '@/lib/tierGuard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:my-profile',
            limit: 120,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('my-profile', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        // Find member
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        if (!member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        const financeTierCheck = await checkTierAccess(gangId, 'finance');
        const hasFinance = financeTierCheck.allowed;

        // Fetch member's transactions (last 20)
        const myTransactions = hasFinance ? await db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, member.id),
                sql`${transactions.status} != 'REJECTED'`
            ),
            orderBy: desc(transactions.createdAt),
            limit: 20,
        }) : [];

        // Fetch attendance stats
        const [totalSessions, attendedSessions, absentSessions, leaveSessions] = await Promise.all([
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
        ]);

        // Calculate total penalties
        const penaltyResult = hasFinance ? await db.select({ sum: sql<number>`sum(${transactions.amount})` })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, member.id),
                eq(transactions.type, 'PENALTY'),
                eq(transactions.status, 'APPROVED')
            )) : [{ sum: 0 }];

        const [loanDebt, collectionDueRows] = hasFinance ? await Promise.all([
            getOutstandingLoanDebt(db, gangId, member.id),
            db.select({
                total: sql<number>`COALESCE(sum(case when (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) > 0 then (${financeCollectionMembers.amountDue} - ${financeCollectionMembers.amountCredited} - ${financeCollectionMembers.amountSettled} - ${financeCollectionMembers.amountWaived}) else 0 end), 0)`,
            })
                .from(financeCollectionMembers)
                .where(and(
                    eq(financeCollectionMembers.gangId, gangId),
                    eq(financeCollectionMembers.memberId, member.id)
                )),
        ]) : [0, []];

        const collectionDue = Number(collectionDueRows[0]?.total || 0);

        return NextResponse.json({
            member: {
                id: member.id,
                name: member.name,
                discordUsername: member.discordUsername,
                discordAvatar: member.discordAvatar,
                gangRole: member.gangRole,
                balance: hasFinance ? member.balance : 0,
                joinedAt: member.createdAt,
            },
            transactions: myTransactions,
            attendance: {
                total: totalSessions[0]?.count || 0,
                present: attendedSessions[0]?.count || 0,
                absent: absentSessions[0]?.count || 0,
                leave: leaveSessions[0]?.count || 0,
            },
            financeSummary: {
                loanDebt: Number(loanDebt || 0),
                collectionDue,
                availableCredit: hasFinance ? Math.max(0, Number(member.balance) || 0) : 0,
            },
            totalPenalties: penaltyResult[0]?.sum || 0,
        });

    } catch (error) {
        logError('api.my_profile.get.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
