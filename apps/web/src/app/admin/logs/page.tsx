export const dynamic = 'force-dynamic';

import { db, auditLogs, gangs } from '@gang/database';
import { sql, desc, eq } from 'drizzle-orm';
import { ActivityLog } from './ActivityLog';

export default async function AdminLogsPage() {
    // Get all audit logs with gang names
    const logs = await db.select({
        id: auditLogs.id,
        gangId: auditLogs.gangId,
        actorId: auditLogs.actorId,
        actorName: auditLogs.actorName,
        action: auditLogs.action,
        targetType: auditLogs.targetType,
        targetId: auditLogs.targetId,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
        gangName: gangs.name,
    })
    .from(auditLogs)
    .leftJoin(gangs, eq(auditLogs.gangId, gangs.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(500);

    // Stats
    const totalResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs);
    const total = totalResult[0]?.count || 0;

    const adminActionsResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs)
        .where(sql`${auditLogs.action} LIKE 'ADMIN%'`);
    const adminActions = adminActionsResult[0]?.count || 0;

    const todayResult = await db.select({ count: sql<number>`count(*)` }).from(auditLogs)
        .where(sql`${auditLogs.createdAt} >= datetime('now', '-1 day')`);
    const todayCount = todayResult[0]?.count || 0;

    // Unique action types
    const actionTypes = await db.selectDistinct({ action: auditLogs.action }).from(auditLogs).limit(50);
    const uniqueActions = actionTypes.map(a => a.action);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">Activity Log</h1>
                <p className="text-gray-500 text-sm mt-1">ดูกิจกรรมทั้งหมดที่เกิดขึ้นในระบบ — filter ตามประเภท, แก๊ง, ช่วงเวลา</p>
            </div>

            <ActivityLog
                logs={JSON.parse(JSON.stringify(logs))}
                stats={{ total, adminActions, todayCount }}
                actionTypes={uniqueActions}
            />
        </div>
    );
}
