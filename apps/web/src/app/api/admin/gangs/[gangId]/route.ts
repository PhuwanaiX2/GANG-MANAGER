import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs } from '@gang/database';
import { eq } from 'drizzle-orm';

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

    return NextResponse.json({ success: true });
}
