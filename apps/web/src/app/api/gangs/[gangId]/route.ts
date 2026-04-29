
import { NextRequest, NextResponse } from 'next/server';
import { db, gangs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError } from '@/lib/logger';
import { z } from 'zod';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

const UpdateGangSchema = z.object({
    name: z.string().min(1, 'Gang name is required').max(50, 'Gang name is too long').optional(),
    logoUrl: z.string().url('URL ไม่ถูกต้อง').max(500).nullable().optional(),
});

export async function PUT(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId: string | null = null;

    try {
        try {
            const access = await requireGangAccess({ gangId, minimumRole: 'OWNER' });
            actorDiscordId = access.member.discordId;
        } catch (error) {
            if (isGangAccessError(error)) {
                if (error.status === 401) {
                    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
                }

                return NextResponse.json({ error: 'Forbidden: Only Owner can update gang settings' }, { status: 403 });
            }

            throw error;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:gangs:update',
            limit: 20,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('gang-update', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const body = await request.json();
        const validation = UpdateGangSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid data', details: validation.error }, { status: 400 });
        }

        const { name, logoUrl } = validation.data;

        const updates: Record<string, any> = { updatedAt: new Date() };
        if (name !== undefined) updates.name = name;
        if (logoUrl !== undefined) updates.logoUrl = logoUrl;

        // Update Gang
        await db.update(gangs)
            .set(updates)
            .where(eq(gangs.id, gangId));

        return NextResponse.json({ success: true, name, logoUrl });

    } catch (error) {
        logError('api.gangs.update.failed', error, { gangId, actorDiscordId });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
