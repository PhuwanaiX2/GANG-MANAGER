import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { db, gangs, members } from '@gang/database';
import { authOptions } from '@/lib/auth';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { getDiscordGuildMembers } from '@/lib/discord-api';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError } from '@/lib/logger';

export async function GET(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        try {
            await requireGangAccess({ gangId, minimumRole: 'ADMIN' });
        } catch (error) {
            if (isGangAccessError(error)) {
                return error.status === 401
                    ? new NextResponse('Unauthorized', { status: 401 })
                    : NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
            }
            throw error;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:discord-members:list',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('discord-members-list', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { discordGuildId: true },
        });

        if (!gang?.discordGuildId) {
            return NextResponse.json({ error: 'ไม่พบ Discord server ของแก๊งนี้' }, { status: 404 });
        }

        const linkedMembers = await db.query.members.findMany({
            where: eq(members.gangId, gangId),
            columns: { discordId: true },
        });
        const linkedDiscordIds = new Set(
            linkedMembers
                .map((member) => member.discordId)
                .filter((discordId): discordId is string => Boolean(discordId))
        );

        const discordMembers = await getDiscordGuildMembers(gang.discordGuildId);
        const availableMembers = discordMembers
            .filter((member) => !linkedDiscordIds.has(member.id))
            .map((member) => ({
                id: member.id,
                username: member.username,
                displayName: member.displayName,
                globalName: member.globalName,
                avatarUrl: member.avatarUrl,
            }));

        return NextResponse.json({ members: availableMembers });
    } catch (error) {
        logError('api.discord_members.list.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
