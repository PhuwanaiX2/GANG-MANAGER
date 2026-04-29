import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, auditLogs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';

const ADMIN_TRIAL_DAYS = 7;
const ERROR_FORBIDDEN = '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e2a\u0e34\u0e17\u0e18\u0e34\u0e4c\u0e40\u0e02\u0e49\u0e32\u0e16\u0e36\u0e07';
const ERROR_NO_UPDATE_DATA = '\u0e44\u0e21\u0e48\u0e21\u0e35\u0e02\u0e49\u0e2d\u0e21\u0e39\u0e25\u0e43\u0e2b\u0e49\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15';

export async function PATCH(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: ERROR_FORBIDDEN }, { status: 403 });
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

    if (requestedTier === 'PREMIUM' && body.subscriptionExpiresAt === undefined) {
        updates.subscriptionExpiresAt = null;
    }

    if (requestedTier === 'TRIAL' && body.subscriptionExpiresAt === undefined) {
        const defaultExpiry = new Date();
        defaultExpiry.setDate(defaultExpiry.getDate() + ADMIN_TRIAL_DAYS);
        updates.subscriptionExpiresAt = defaultExpiry;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: ERROR_NO_UPDATE_DATA }, { status: 400 });
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
