import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, licenses } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

function isAdmin(discordId: string) {
    return ADMIN_IDS.includes(discordId);
}

// GET — list all licenses
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !isAdmin(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const all = await db.query.licenses.findMany({
        orderBy: desc(licenses.createdAt),
    });

    return NextResponse.json(all);
}

// POST — create a new license
export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !isAdmin(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const body = await request.json();
    const { tier, maxMembers, expiresAt, durationDays } = body;

    if (!tier || !['PRO', 'PREMIUM'].includes(tier)) {
        return NextResponse.json({ error: 'Tier ต้องเป็น PRO หรือ PREMIUM' }, { status: 400 });
    }

    const days = durationDays && Number(durationDays) > 0 ? Number(durationDays) : 30;

    const key = `${tier}-${nanoid(12).toUpperCase()}`;
    const id = nanoid();

    await db.insert(licenses).values({
        id,
        key,
        tier,
        durationDays: days,
        isActive: true,
        maxMembers: maxMembers || (tier === 'PRO' ? 25 : 50),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    const created = await db.query.licenses.findFirst({ where: eq(licenses.id, id) });
    return NextResponse.json(created, { status: 201 });
}
