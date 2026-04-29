import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';
import { db, FinanceService } from '@gang/database';

const TransactionSchema = z.object({
    type: z.enum(['INCOME', 'EXPENSE', 'LOAN', 'REPAYMENT', 'DEPOSIT']),
    amount: z.number().int().positive().max(100000000),
    description: z.string().optional(),
    memberId: z.string().optional(),
});

const FINANCE_BAD_REQUEST_EXACT_MESSAGES = new Set([
    'เงินกองกลางไม่พอ',
    'สมาชิกไม่มีหนี้ยืมค้างชำระ',
    'ไม่พบแก๊งนี้ในระบบ',
    'ไม่พบสมาชิกนี้ในระบบ',
]);

const FINANCE_BAD_REQUEST_PARTIAL_MESSAGES = [
    'ยอดชำระเกินจำนวนหนี้',
    'จำนวนเงินไม่ถูกต้อง',
    'กรุณาระบุสมาชิก',
];

function isFinanceBadRequest(message: string) {
    return (
        FINANCE_BAD_REQUEST_EXACT_MESSAGES.has(message) ||
        FINANCE_BAD_REQUEST_PARTIAL_MESSAGES.some((entry) => message.includes(entry))
    );
}

async function requireFinanceMutationAccess(gangId: string) {
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
        const { access, response } = await requireFinanceMutationAccess(gangId);
        if (!access) {
            return response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionUser = (access.session as { user?: { discordId?: string; name?: string | null } } | null | undefined)?.user;
        actorDiscordId = sessionUser?.discordId || 'unknown';

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:finance:create',
            limit: 25,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('finance-create', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const tierCheck = await checkTierAccess(gangId, 'finance');
        if (!tierCheck.allowed) {
            return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
        }

        const body = await request.json();
        const validation = TransactionSchema.safeParse(body);
        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid data', details: validation.error }, { status: 400 });
        }

        const { type, amount, description, memberId } = validation.data;

        if ((type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT') && !memberId) {
            return NextResponse.json({ error: 'กรุณาระบุสมาชิก' }, { status: 400 });
        }

        if ((type === 'INCOME' || type === 'EXPENSE') && (!description || description.trim().length === 0)) {
            return NextResponse.json({ error: 'กรุณาระบุรายละเอียด' }, { status: 400 });
        }

        const standardizedDescription =
            type === 'LOAN'
                ? 'เบิก/ยืมเงิน'
                : type === 'REPAYMENT'
                    ? 'ชำระหนี้ยืมเข้ากองกลาง'
                    : type === 'DEPOSIT'
                        ? 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต'
                        : (description || '').trim();

        const finalMemberId =
            type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT'
                ? memberId || undefined
                : undefined;

        await FinanceService.createTransaction(db, {
            gangId,
            type,
            amount,
            description: standardizedDescription,
            memberId: finalMemberId,
            actorId: access.member.id,
            actorName: sessionUser?.name || 'Unknown',
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        const message = error instanceof Error ? error.message : '';

        if (isFinanceBadRequest(message)) {
            logWarn('api.finance.create.rejected', {
                gangId,
                actorDiscordId,
                reason: message,
            });
            return NextResponse.json({ error: message }, { status: 400 });
        }

        if (message.includes('Concurrency Conflict')) {
            logWarn('api.finance.create.conflict', {
                gangId,
                actorDiscordId,
            });
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }

        logError('api.finance.create.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
