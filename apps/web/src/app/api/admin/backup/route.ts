import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, attendanceSessions, attendanceRecords, transactions, leaveRequests, auditLogs, gangRoles, gangSettings, licenses } from '@gang/database';
import { eq, and, lt, sql } from 'drizzle-orm';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

function isAdmin(discordId: string) {
    return ADMIN_IDS.includes(discordId);
}

// GET — download full backup as JSON
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !isAdmin(session.user.discordId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allData = {
        timestamp: new Date().toISOString(),
        gangs: await db.select().from(gangs),
        gangSettings: await db.select().from(gangSettings),
        gangRoles: await db.select().from(gangRoles),
        members: await db.select().from(members),
        attendanceSessions: await db.select().from(attendanceSessions),
        attendanceRecords: await db.select().from(attendanceRecords),
        leaveRequests: await db.select().from(leaveRequests),
        transactions: await db.select().from(transactions),
        auditLogs: await db.select().from(auditLogs),
        licenses: await db.select().from(licenses),
    };

    return new NextResponse(JSON.stringify(allData, null, 2), {
        headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`,
        },
    });
}

// POST — purge old data (audit logs, old attendance, inactive members)
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !isAdmin(session.user.discordId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { action, gangId, olderThanDays } = body as {
        action: 'purge_audit_logs' | 'purge_old_attendance' | 'delete_gang_data' | 'purge_inactive_members';
        gangId?: string;
        olderThanDays?: number;
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (olderThanDays || 90));

    let deletedCount = 0;

    try {
        switch (action) {
            case 'purge_audit_logs': {
                const result = await db.delete(auditLogs)
                    .where(lt(auditLogs.createdAt, cutoff));
                deletedCount = result.rowsAffected;
                break;
            }

            case 'purge_old_attendance': {
                const oldSessions = await db.select({ id: attendanceSessions.id })
                    .from(attendanceSessions)
                    .where(lt(attendanceSessions.createdAt, cutoff));
                const sessionIds = oldSessions.map(s => s.id);

                if (sessionIds.length > 0) {
                    for (const sid of sessionIds) {
                        await db.delete(attendanceRecords)
                            .where(eq(attendanceRecords.sessionId, sid));
                    }
                    const result = await db.delete(attendanceSessions)
                        .where(lt(attendanceSessions.createdAt, cutoff));
                    deletedCount = result.rowsAffected;
                }
                break;
            }

            case 'purge_inactive_members': {
                const where = gangId
                    ? and(eq(members.isActive, false), eq(members.gangId, gangId))
                    : eq(members.isActive, false);
                const result = await db.delete(members).where(where!);
                deletedCount = result.rowsAffected;
                break;
            }

            case 'delete_gang_data': {
                if (!gangId) {
                    return NextResponse.json({ error: 'ต้องระบุ gangId' }, { status: 400 });
                }
                // Delete all related data for a gang
                const gangMembers = await db.select({ id: members.id })
                    .from(members)
                    .where(eq(members.gangId, gangId));
                const memberIds = gangMembers.map(m => m.id);

                // Delete attendance records for gang members
                for (const mid of memberIds) {
                    await db.delete(attendanceRecords)
                        .where(eq(attendanceRecords.memberId, mid));
                }

                // Delete sessions
                const sessions = await db.select({ id: attendanceSessions.id })
                    .from(attendanceSessions)
                    .where(eq(attendanceSessions.gangId, gangId));
                for (const s of sessions) {
                    await db.delete(attendanceRecords)
                        .where(eq(attendanceRecords.sessionId, s.id));
                }
                await db.delete(attendanceSessions)
                    .where(eq(attendanceSessions.gangId, gangId));

                // Delete other
                await db.delete(transactions).where(eq(transactions.gangId, gangId));
                await db.delete(leaveRequests).where(eq(leaveRequests.gangId, gangId));
                await db.delete(auditLogs).where(eq(auditLogs.gangId, gangId));
                await db.delete(gangRoles).where(eq(gangRoles.gangId, gangId));
                await db.delete(members).where(eq(members.gangId, gangId));
                await db.delete(gangSettings).where(eq(gangSettings.gangId, gangId));
                await db.delete(gangs).where(eq(gangs.id, gangId));

                deletedCount = 1; // 1 gang
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true, action, deletedCount });

    } catch (error) {
        console.error('[Admin] Purge error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
