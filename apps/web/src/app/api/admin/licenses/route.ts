import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, licenses, auditLogs } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';


function isAdmin(discordId: string) {
    return isAdminDiscordId(discordId);
}

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:licenses:get',
        limit: 30,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-licenses-get', adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const all = await db.query.licenses.findMany({
        orderBy: desc(licenses.createdAt),
    });

    return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:licenses:post',
        limit: 20,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-licenses-post', adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const body = await request.json() as {
        tier?: 'PREMIUM';
        maxMembers?: number;
        expiresAt?: string | null;
        durationDays?: number;
    };
    const { tier, maxMembers, expiresAt, durationDays } = body;

    if (!tier || tier !== 'PREMIUM') {
        return NextResponse.json({ error: 'Tier ต้องเป็น PREMIUM' }, { status: 400 });
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
        maxMembers: maxMembers || 40,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    const fallbackGang = await db.query.gangs.findFirst({
        columns: { id: true },
    });
    if (fallbackGang) {
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: fallbackGang.id,
            actorId: adminDiscordId,
            actorName: session?.user?.name || 'Admin',
            action: 'ADMIN_CREATE_LICENSE',
            targetType: 'license',
            targetId: id,
            newValue: JSON.stringify({ tier, durationDays: days, maxMembers: maxMembers || 40, expiresAt: expiresAt || null }),
            details: JSON.stringify({ licenseKey: key, adminAction: true }),
        });
    }

    const created = await db.query.licenses.findFirst({ where: eq(licenses.id, id) });
    return NextResponse.json(created, { status: 201 });
}
