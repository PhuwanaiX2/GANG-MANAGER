import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { buildRateLimitSubject, enforceRouteRateLimit, getClientIp } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';

const MAX_BODY_LENGTH = 12_000;

const clientEventSchema = z.object({
    level: z.enum(['error', 'warn']).default('error'),
    event: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9_.:-]+$/),
    page: z.string().trim().max(300).optional(),
    timestamp: z.string().trim().max(80).optional(),
    error: z.unknown().optional(),
    context: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
    const clientIp = getClientIp(request);
    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:client-events',
        limit: 30,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('client-events', clientIp),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_LENGTH) {
        return NextResponse.json({ error: 'Payload Too Large' }, { status: 413 });
    }

    let parsedBody: unknown;
    try {
        parsedBody = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = clientEventSchema.safeParse(parsedBody);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Invalid client event' }, { status: 400 });
    }

    let actorDiscordId: string | undefined;
    try {
        const session = await getServerSession(authOptions);
        actorDiscordId = session?.user?.discordId;
    } catch (error) {
        logWarn('api.client_events.session_lookup_failed', {
            clientIp,
            error,
        });
    }

    const eventContext = {
        actorDiscordId,
        clientIp,
        clientEvent: parsed.data.event,
        page: parsed.data.page,
        clientTimestamp: parsed.data.timestamp,
        clientContext: parsed.data.context,
    };

    if (parsed.data.level === 'warn') {
        logWarn('client.warn.reported', {
            ...eventContext,
            warning: parsed.data.error,
        });
        return NextResponse.json({ success: true });
    }

    logError('client.error.reported', parsed.data.error ?? 'Client reported an error', eventContext);
    return NextResponse.json({ success: true });
}
