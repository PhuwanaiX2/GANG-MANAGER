import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, transactions, attendanceRecords, attendanceSessions } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

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

        if (!member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 404 });
        }

        // Fetch member's transactions (last 20)
        const myTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, member.id),
                sql`${transactions.status} != 'REJECTED'`
            ),
            orderBy: desc(transactions.createdAt),
            limit: 20,
        });

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
        const penaltyResult = await db.select({ sum: sql<number>`sum(${transactions.amount})` })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, member.id),
                eq(transactions.type, 'PENALTY'),
                eq(transactions.status, 'APPROVED')
            ));

        return NextResponse.json({
            member: {
                id: member.id,
                name: member.name,
                discordUsername: member.discordUsername,
                discordAvatar: member.discordAvatar,
                gangRole: member.gangRole,
                balance: member.balance,
                joinedAt: member.createdAt,
            },
            transactions: myTransactions,
            attendance: {
                total: totalSessions[0]?.count || 0,
                present: attendedSessions[0]?.count || 0,
                absent: absentSessions[0]?.count || 0,
                leave: leaveSessions[0]?.count || 0,
            },
            totalPenalties: penaltyResult[0]?.sum || 0,
        });

    } catch (error) {
        console.error('My Profile API Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
