import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, attendanceSessions, attendanceRecords, transactions, leaveRequests, auditLogs, licenses } from '@gang/database';
import { eq, sql, and, gte } from 'drizzle-orm';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
        totalGangsR,
        activeGangsR,
        totalMembersR,
        activeMembersR,
        totalSessionsR,
        recentSessionsR,
        totalRecordsR,
        totalTxR,
        recentTxR,
        totalLeavesR,
        totalAuditR,
        totalLicensesR,
        activeLicensesR,
        usedLicensesR,
        tierBreakdown,
        recentGangsR,
        recentMembersR,
    ] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(gangs),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(eq(gangs.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(members),
        db.select({ count: sql<number>`count(*)` }).from(members).where(eq(members.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(attendanceSessions),
        db.select({ count: sql<number>`count(*)` }).from(attendanceSessions).where(gte(attendanceSessions.createdAt, sevenDaysAgo)),
        db.select({ count: sql<number>`count(*)` }).from(attendanceRecords),
        db.select({ count: sql<number>`count(*)` }).from(transactions),
        db.select({ count: sql<number>`count(*)` }).from(transactions).where(gte(transactions.createdAt, thirtyDaysAgo)),
        db.select({ count: sql<number>`count(*)` }).from(leaveRequests),
        db.select({ count: sql<number>`count(*)` }).from(auditLogs),
        db.select({ count: sql<number>`count(*)` }).from(licenses),
        db.select({ count: sql<number>`count(*)` }).from(licenses).where(eq(licenses.isActive, true)),
        db.select({ count: sql<number>`count(*)` }).from(licenses).where(eq(licenses.isActive, false)),
        db.select({
            tier: gangs.subscriptionTier,
            count: sql<number>`count(*)`,
        }).from(gangs).where(eq(gangs.isActive, true)).groupBy(gangs.subscriptionTier),
        db.select({ count: sql<number>`count(*)` }).from(gangs).where(gte(gangs.createdAt, thirtyDaysAgo)),
        db.select({ count: sql<number>`count(*)` }).from(members).where(gte(members.createdAt, thirtyDaysAgo)),
    ]);

    return NextResponse.json({
        overview: {
            totalGangs: totalGangsR[0]?.count || 0,
            activeGangs: activeGangsR[0]?.count || 0,
            totalMembers: totalMembersR[0]?.count || 0,
            activeMembers: activeMembersR[0]?.count || 0,
            newGangs30d: recentGangsR[0]?.count || 0,
            newMembers30d: recentMembersR[0]?.count || 0,
        },
        attendance: {
            totalSessions: totalSessionsR[0]?.count || 0,
            recentSessions7d: recentSessionsR[0]?.count || 0,
            totalRecords: totalRecordsR[0]?.count || 0,
        },
        finance: {
            totalTransactions: totalTxR[0]?.count || 0,
            recentTransactions30d: recentTxR[0]?.count || 0,
        },
        leaves: {
            totalLeaveRequests: totalLeavesR[0]?.count || 0,
        },
        audit: {
            totalLogs: totalAuditR[0]?.count || 0,
        },
        licenses: {
            total: totalLicensesR[0]?.count || 0,
            active: activeLicensesR[0]?.count || 0,
            used: usedLicensesR[0]?.count || 0,
        },
        tierBreakdown: tierBreakdown.reduce((acc, t) => {
            acc[t.tier] = t.count;
            return acc;
        }, {} as Record<string, number>),
    });
}
