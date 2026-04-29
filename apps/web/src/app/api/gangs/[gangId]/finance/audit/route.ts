import { NextRequest, NextResponse } from 'next/server';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { logError } from '@/lib/logger';
import { db, auditLogs } from '@gang/database';
import { eq, desc, and } from 'drizzle-orm';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

async function requireFinanceAuditAccess(gangId: string) {
    try {
        return {
            access: await requireGangAccess({ gangId, minimumRole: 'MEMBER' }),
            response: null,
        };
    } catch (error) {
        if (isGangAccessError(error)) {
            return {
                access: null,
                response: NextResponse.json(
                    { error: error.status === 401 ? 'Unauthorized' : 'Forbidden' },
                    { status: error.status === 401 ? 401 : 403 }
                ),
            };
        }

        throw error;
    }
}

export async function GET(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId = 'unknown';

    try {
        const { access, response } = await requireFinanceAuditAccess(gangId);
        if (!access) {
            return response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionUser = (access.session as { user?: { discordId?: string } } | null | undefined)?.user;
        actorDiscordId = sessionUser?.discordId || 'unknown';

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:finance:audit',
            limit: 120,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('finance-audit', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const tierCheck = await checkTierAccess(gangId, 'finance');
        if (!tierCheck.allowed) {
            return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
        }

        // Fetch logs with actor info
        const logs = await db.query.auditLogs.findMany({
            where: and(
                eq(auditLogs.gangId, gangId)
            ),
            orderBy: [desc(auditLogs.createdAt)],
            limit: 50, // Limit to last 50 actions
        });

        // Enrich with member names manually (or we could use relation if set up)
        // Since we only have Discord ID in logs, we try to find member in this gang
        // Optimization: Fetch all members involved at once? Or just return IDs and let frontend handle?
        // Let's try to map names if possible, but for now raw data is fine.

        return NextResponse.json(logs);

    } catch (error) {
        logError('api.finance.audit.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
