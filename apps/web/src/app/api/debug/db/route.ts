import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members } from '@gang/database';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Block in production OR if debug routes are not explicitly enabled
        if (process.env.NODE_ENV === 'production' || process.env.ENABLE_DEBUG_ROUTES !== 'true') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        const session = await getServerSession(authOptions);

        // 1. Authentication Check
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Authorization Check (Simple Environment Variable List)
        // If ADMIN_DISCORD_IDS is not set, NO ONE can access this route (Fail Safe)
        const adminIds = process.env.ADMIN_DISCORD_IDS?.split(',') || [];
        if (!adminIds.includes(session.user.discordId)) {
            console.warn(`[Security] Unauthorized access attempt to /api/debug/db by ${session.user.discordId}`);
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const allGangs = await db.query.gangs.findMany();
        const allMembers = await db.query.members.findMany();

        // Check for orphaned members
        const gangIds = new Set(allGangs.map(g => g.id));
        const orphanedMembers = allMembers.filter(m => !gangIds.has(m.gangId));

        return NextResponse.json({
            gangs: allGangs.map(g => ({ id: g.id, name: g.name, guildId: g.discordGuildId })),
            members: allMembers.map(m => ({
                id: m.id,
                name: m.name,
                gangId: m.gangId,
                isOrphaned: !gangIds.has(m.gangId)
            })),
            summary: {
                totalGangs: allGangs.length,
                totalMembers: allMembers.length,
                orphanedMembers: orphanedMembers.length,
            }
        });
    } catch (error) {
        console.error('Debug DB Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
