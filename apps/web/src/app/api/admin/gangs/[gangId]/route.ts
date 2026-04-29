import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, auditLogs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';

const ADMIN_TRIAL_DAYS = 7;

export async function PATCH(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:gangs:patch',
        limit: 15,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-gang-patch', params.gangId, adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const currentGang = await db.query.gangs.findFirst({
        where: eq(gangs.id, params.gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true, isActive: true, name: true },
    });

    const body = await request.json();
    const updates: Record<string, any> = {};
    const requestedTier = typeof body.subscriptionTier === 'string' ? body.subscriptionTier : null;

    if (requestedTier && ['FREE', 'TRIAL', 'PREMIUM'].includes(requestedTier)) {
        updates.subscriptionTier = requestedTier;
    }
    if (body.subscriptionExpiresAt !== undefined) {
        updates.subscriptionExpiresAt = body.subscriptionExpiresAt ? new Date(body.subscriptionExpiresAt) : null;
    }
    if (typeof body.isActive === 'boolean') {
        updates.isActive = body.isActive;
    }

    if (requestedTier === 'FREE') {
        updates.subscriptionExpiresAt = null;
    }

    if (requestedTier === 'TRIAL' && body.subscriptionExpiresAt === undefined) {
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + ADMIN_TRIAL_DAYS);
        updates.subscriptionExpiresAt = defaultExpiry;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 });
    }

    updates.updatedAt = new Date();

    await db.update(gangs).set(updates).where(eq(gangs.id, params.gangId));

    try {
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: params.gangId,
            actorId: adminDiscordId,
            actorName: session?.user?.name || 'Admin',
            action: 'ADMIN_UPDATE_GANG',
            targetType: 'gang',
            targetId: params.gangId,
            oldValue: currentGang ? JSON.stringify({
                tier: currentGang.subscriptionTier,
                expiresAt: currentGang.subscriptionExpiresAt,
                isActive: currentGang.isActive,
            }) : null,
            newValue: JSON.stringify(updates),
            details: JSON.stringify({ gangName: currentGang?.name, adminAction: true }),
        });
    } catch {
        // non-critical audit logging failure
    }

    return NextResponse.json({ success: true });
}
