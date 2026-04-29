import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, FeatureFlagService } from '@gang/database';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:feature-flags:get',
        limit: 30,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-feature-flags-get', adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    await FeatureFlagService.seed(db);
    const flags = await FeatureFlagService.getAll(db);
    return NextResponse.json(flags);
}

export async function PATCH(request: NextRequest) {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:feature-flags:patch',
        limit: 20,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-feature-flags-patch', adminDiscordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const body = await request.json();
    const { key, enabled } = body;

    if (!key || typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'ต้องระบุ key และ enabled (boolean)' }, { status: 400 });
    }

    await FeatureFlagService.toggle(db, key, enabled, adminDiscordId);
    return NextResponse.json({ success: true, key, enabled });
}
