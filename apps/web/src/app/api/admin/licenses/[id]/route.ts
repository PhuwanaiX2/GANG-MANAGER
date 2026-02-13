import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, licenses } from '@gang/database';
import { eq } from 'drizzle-orm';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

// PATCH — toggle active / update license
export async function PATCH(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive;
    if (body.tier) updates.tier = body.tier;
    if (body.maxMembers) updates.maxMembers = body.maxMembers;

    await db.update(licenses).set(updates).where(eq(licenses.id, params.id));

    return NextResponse.json({ success: true });
}

// DELETE — delete license
export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    await db.delete(licenses).where(eq(licenses.id, params.id));

    return NextResponse.json({ success: true });
}
