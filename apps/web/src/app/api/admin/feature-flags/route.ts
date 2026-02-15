import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, FeatureFlagService } from '@gang/database';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

// GET — list all feature flags
export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    // Ensure defaults exist
    await FeatureFlagService.seed(db);

    const flags = await FeatureFlagService.getAll(db);
    return NextResponse.json(flags);
}

// PATCH — toggle a feature flag
export async function PATCH(request: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
        return NextResponse.json({ error: 'ไม่มีสิทธิ์เข้าถึง' }, { status: 403 });
    }

    const body = await request.json();
    const { key, enabled } = body;

    if (!key || typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'ต้องระบุ key และ enabled (boolean)' }, { status: 400 });
    }

    await FeatureFlagService.toggle(db, key, enabled, session.user.discordId);

    return NextResponse.json({ success: true, key, enabled });
}
