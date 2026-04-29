import { NextResponse } from 'next/server';
import { getDiscordChannels } from '@/lib/discord-api';
import { requireGangAccess, isGangAccessError } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit, getClientIp } from '@/lib/apiRateLimit';
import { logError } from '@/lib/logger';

// GET /api/discord/channels?guildId=...
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId');

    if (!guildId) {
        return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
    }

    try {
        await requireGangAccess({ guildId, minimumRole: 'OWNER' });
        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:discord:channels',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('discord-channels', guildId, getClientIp(request)),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const channels = await getDiscordChannels(guildId);
        return NextResponse.json(channels);
    } catch (error) {
        if (isGangAccessError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        logError('api.discord.channels.failed', error, {
            guildId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
