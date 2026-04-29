import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, licenses, auditLogs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';


export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:licenses:patch',
        limit: 20,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-license-patch', params.id, adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const currentLicense = await db.query.licenses.findFirst({ where: eq(licenses.id, params.id) });
    if (!currentLicense) {
        return NextResponse.json({ error: 'ไม่พบ License' }, { status: 404 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (typeof body.isActive === 'boolean') updates.isActive = body.isActive;
    if (body.tier) updates.tier = body.tier;
    if (body.maxMembers) updates.maxMembers = body.maxMembers;

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'ไม่มีข้อมูลให้อัปเดต' }, { status: 400 });
    }

    await db.update(licenses).set(updates).where(eq(licenses.id, params.id));

    const fallbackGang = await db.query.gangs.findFirst({ columns: { id: true } });
    if (fallbackGang) {
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: fallbackGang.id,
            actorId: adminDiscordId,
            actorName: session?.user?.name || 'Admin',
            action: 'ADMIN_UPDATE_LICENSE',
            targetType: 'license',
            targetId: params.id,
            oldValue: JSON.stringify({ isActive: currentLicense.isActive, tier: currentLicense.tier, maxMembers: currentLicense.maxMembers }),
            newValue: JSON.stringify(updates),
            details: JSON.stringify({ licenseKey: currentLicense.key, adminAction: true }),
        });
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:licenses:delete',
        limit: 10,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-license-delete', params.id, adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const currentLicense = await db.query.licenses.findFirst({ where: eq(licenses.id, params.id) });
    if (!currentLicense) {
        return NextResponse.json({ error: 'ไม่พบ License' }, { status: 404 });
    }

    await db.delete(licenses).where(eq(licenses.id, params.id));

    const fallbackGang = await db.query.gangs.findFirst({ columns: { id: true } });
    if (fallbackGang) {
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: fallbackGang.id,
            actorId: adminDiscordId,
            actorName: session?.user?.name || 'Admin',
            action: 'ADMIN_DELETE_LICENSE',
            targetType: 'license',
            targetId: params.id,
            oldValue: JSON.stringify({ key: currentLicense.key, tier: currentLicense.tier, durationDays: currentLicense.durationDays, isActive: currentLicense.isActive }),
            details: JSON.stringify({ adminAction: true }),
        });
    }

    return NextResponse.json({ success: true });
}
