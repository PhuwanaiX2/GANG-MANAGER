import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';
import { db, waiveCollectionDebt } from '@gang/database';

const Schema = z.object({
    memberId: z.string().min(1),
    batchId: z.string().min(1),
});

const GANG_FEE_SETTLE_BAD_REQUEST_MESSAGES = [
    'จำนวนเงินไม่ถูกต้อง',
    'กรุณาระบุสมาชิก',
];

const GANG_FEE_SETTLE_NOT_FOUND_MESSAGE = 'ไม่พบหนี้เก็บเงินแก๊งที่ยังค้างอยู่';

function isGangFeeSettleBadRequest(message: string) {
    return GANG_FEE_SETTLE_BAD_REQUEST_MESSAGES.some((entry) => message.includes(entry));
}

async function requireGangFeeSettleAccess(gangId: string) {
    try {
        return {
            access: await requireGangAccess({ gangId, minimumRole: 'TREASURER' }),
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

export async function POST(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    let gangId = params.gangId;
    let actorDiscordId = 'unknown';

    try {
        const { access, response } = await requireGangFeeSettleAccess(gangId);
        if (!access) {
            return response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionUser = (access.session as { user?: { discordId?: string; name?: string | null } } | null | undefined)?.user;
        actorDiscordId = sessionUser?.discordId || 'unknown';

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:finance:gang-fee:settle',
            limit: 20,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('gang-fee-settle', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const tierCheck = await checkTierAccess(gangId, 'gangFee');
        if (!tierCheck.allowed) {
            return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
        }

        const body = await request.json();
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid data', details: parsed.error }, { status: 400 });
        }

        const { memberId, batchId } = parsed.data;

        const result = await waiveCollectionDebt(db, {
            gangId,
            memberId,
            batchId,
            actorId: access.member.id,
            actorName: access.member.name || sessionUser?.name || 'Unknown',
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        const message = error instanceof Error ? error.message : '';

        if (message.includes(GANG_FEE_SETTLE_NOT_FOUND_MESSAGE)) {
            logWarn('api.finance.gang_fee_settle.not_found', {
                gangId,
                actorDiscordId,
                reason: message,
            });
            return NextResponse.json({ error: message }, { status: 404 });
        }

        if (isGangFeeSettleBadRequest(message)) {
            logWarn('api.finance.gang_fee_settle.rejected', {
                gangId,
                actorDiscordId,
                reason: message,
            });
            return NextResponse.json({ error: message }, { status: 400 });
        }

        if (message.includes('Concurrency Conflict')) {
            logWarn('api.finance.gang_fee_settle.conflict', {
                gangId,
                actorDiscordId,
            });
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }

        logError('api.finance.gang_fee_settle.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
