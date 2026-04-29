import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
    analyzeBackupImpact,
    buildRestorePlan,
    previewBackupPayload,
    type ExistingBackupIds,
    type RestorePlanMode,
} from '@/lib/adminBackupPreview';
import {
    attendanceRecords,
    attendanceSessions,
    auditLogs,
    db,
    gangs,
    gangRoles,
    gangSettings,
    leaveRequests,
    licenses,
    members,
    transactions,
} from '@gang/database';
import { and, eq, lt } from 'drizzle-orm';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError } from '@/lib/logger';
import { isAdminDiscordId } from '@/lib/adminAuth';

function isAdmin(discordId: string) {
    return isAdminDiscordId(discordId);
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:backup:get',
        limit: 5,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-backup-get', adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const rawGangs = await db.select().from(gangs);
    const allData = {
        timestamp: new Date().toISOString(),
        gangs: rawGangs,
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

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:backup:post',
        limit: 10,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-backup-post', adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const body = await request.json();
    const { action, gangId, olderThanDays, backupJson, fileName, strategy } = body as {
        action: 'purge_audit_logs' | 'purge_old_attendance' | 'delete_gang_data' | 'purge_inactive_members' | 'preview_restore' | 'preview_restore_plan';
        gangId?: string;
        olderThanDays?: number;
        backupJson?: string;
        fileName?: string;
        strategy?: RestorePlanMode;
    };

    if (action === 'preview_restore' || action === 'preview_restore_plan') {
        if (!backupJson || typeof backupJson !== 'string' || backupJson.trim().length === 0) {
            return NextResponse.json({ error: 'กรุณาอัปโหลดไฟล์ Backup JSON' }, { status: 400 });
        }

        let parsed: unknown;
        try {
            parsed = JSON.parse(backupJson);
        } catch {
            return NextResponse.json({ error: 'ไฟล์ Backup ไม่ใช่ JSON ที่ถูกต้อง' }, { status: 400 });
        }

        try {
            const preview = previewBackupPayload(parsed, fileName || 'backup.json');
            const [
                liveGangs,
                liveGangSettings,
                liveGangRoles,
                liveMembers,
                liveAttendanceSessions,
                liveAttendanceRecords,
                liveLeaveRequests,
                liveTransactions,
                liveAuditLogs,
                liveLicenses,
            ] = await Promise.all([
                db.select({ id: gangs.id }).from(gangs),
                db.select({ id: gangSettings.id }).from(gangSettings),
                db.select({ id: gangRoles.id }).from(gangRoles),
                db.select({ id: members.id }).from(members),
                db.select({ id: attendanceSessions.id }).from(attendanceSessions),
                db.select({ id: attendanceRecords.id }).from(attendanceRecords),
                db.select({ id: leaveRequests.id }).from(leaveRequests),
                db.select({ id: transactions.id }).from(transactions),
                db.select({ id: auditLogs.id }).from(auditLogs),
                db.select({ id: licenses.id }).from(licenses),
            ]);

            const existingIds: ExistingBackupIds = {
                gangs: liveGangs.map((row) => row.id),
                gangSettings: liveGangSettings.map((row) => row.id),
                gangRoles: liveGangRoles.map((row) => row.id),
                members: liveMembers.map((row) => row.id),
                attendanceSessions: liveAttendanceSessions.map((row) => row.id),
                attendanceRecords: liveAttendanceRecords.map((row) => row.id),
                leaveRequests: liveLeaveRequests.map((row) => row.id),
                transactions: liveTransactions.map((row) => row.id),
                auditLogs: liveAuditLogs.map((row) => row.id),
                licenses: liveLicenses.map((row) => row.id),
            };
            const impact = analyzeBackupImpact(parsed, existingIds);

            if (action === 'preview_restore_plan') {
                if (strategy !== 'create_only' && strategy !== 'upsert_existing') {
                    return NextResponse.json({ error: 'ต้องระบุ strategy ของ restore plan ให้ถูกต้อง' }, { status: 400 });
                }

                if (!preview.isValid) {
                    return NextResponse.json({ error: 'ไฟล์ Backup ยังไม่ผ่านการตรวจสอบเบื้องต้น จึงสร้าง restore plan ไม่ได้' }, { status: 400 });
                }

                const plan = buildRestorePlan(preview, impact, strategy);
                return NextResponse.json({ success: true, action, preview: { ...preview, impact }, plan });
            }

            return NextResponse.json({ success: true, action, preview: { ...preview, impact } });
        } catch (error) {
            logError('api.admin.backup.preview.failed', error, {
                actorDiscordId: adminDiscordId,
                action,
                fileName,
            });
            return NextResponse.json({ error: 'ไม่สามารถวิเคราะห์ผลกระทบของ Backup ได้' }, { status: 500 });
        }
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (olderThanDays || 90));

    let deletedCount = 0;

    try {
        switch (action) {
            case 'purge_audit_logs': {
                const result = await db.delete(auditLogs).where(lt(auditLogs.createdAt, cutoff));
                deletedCount = result.rowsAffected;
                break;
            }

            case 'purge_old_attendance': {
                const oldSessions = await db.select({ id: attendanceSessions.id })
                    .from(attendanceSessions)
                    .where(lt(attendanceSessions.createdAt, cutoff));
                const sessionIds = oldSessions.map((s) => s.id);

                if (sessionIds.length > 0) {
                    for (const sid of sessionIds) {
                        await db.delete(attendanceRecords).where(eq(attendanceRecords.sessionId, sid));
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

                const gangMembers = await db.select({ id: members.id })
                    .from(members)
                    .where(eq(members.gangId, gangId));
                const memberIds = gangMembers.map((m) => m.id);

                for (const mid of memberIds) {
                    await db.delete(attendanceRecords).where(eq(attendanceRecords.memberId, mid));
                }

                const sessions = await db.select({ id: attendanceSessions.id })
                    .from(attendanceSessions)
                    .where(eq(attendanceSessions.gangId, gangId));
                for (const session of sessions) {
                    await db.delete(attendanceRecords).where(eq(attendanceRecords.sessionId, session.id));
                }

                await db.delete(attendanceSessions).where(eq(attendanceSessions.gangId, gangId));
                await db.delete(transactions).where(eq(transactions.gangId, gangId));
                await db.delete(leaveRequests).where(eq(leaveRequests.gangId, gangId));
                await db.delete(auditLogs).where(eq(auditLogs.gangId, gangId));
                await db.delete(gangRoles).where(eq(gangRoles.gangId, gangId));
                await db.delete(members).where(eq(members.gangId, gangId));
                await db.delete(gangSettings).where(eq(gangSettings.gangId, gangId));
                await db.delete(gangs).where(eq(gangs.id, gangId));

                deletedCount = 1;
                break;
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        return NextResponse.json({ success: true, action, deletedCount });
    } catch (error) {
        logError('api.admin.backup.purge.failed', error, {
            actorDiscordId: adminDiscordId,
            action,
            gangId,
            olderThanDays,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
