import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, auditLogs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

// PATCH — update gang tier / status from admin
export async function PATCH(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    // Get current gang state for audit log
    const currentGang = await db.query.gangs.findFirst({
        where: eq(gangs.id, params.gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true, isActive: true, name: true },
    });

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.subscriptionTier && ['FREE', 'TRIAL', 'PRO', 'PREMIUM'].includes(body.subscriptionTier)) {
        updates.subscriptionTier = body.subscriptionTier;
    }
    if (body.subscriptionExpiresAt !== undefined) {
        updates.subscriptionExpiresAt = body.subscriptionExpiresAt ? new Date(body.subscriptionExpiresAt) : null;
    }
    if (typeof body.isActive === 'boolean') {
        updates.isActive = body.isActive;
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 });
    }

    updates.updatedAt = new Date();

    await db.update(gangs).set(updates).where(eq(gangs.id, params.gangId));

    // Admin audit log
    try {
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: params.gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Admin',
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
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true });
}
