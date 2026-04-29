import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';
import { db, transactions, members, auditLogs } from '@gang/database';

function uuid() {
    const runtime = globalThis as typeof globalThis & {
        crypto?: {
            randomUUID?: () => string;
        };
    };

    if (runtime.crypto?.randomUUID) {
        return runtime.crypto.randomUUID();
    }

    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const FINANCE_STATUS_MESSAGES = {
    LOAN: 'เบิก/ยืมเงิน',
    REPAYMENT: 'ชำระหนี้ยืมเข้ากองกลาง',
    DEPOSIT: 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต',
} as const;

const TRANSACTION_CONFLICT_PARTIALS = ['รายการนี้', 'ไม่ใช่สถานะ'];

let discordRest: REST | null = null;

function getDiscordRest() {
    if (!discordRest) {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) {
            throw new Error('DISCORD_BOT_TOKEN is not set');
        }

        discordRest = new REST({ version: '10' }).setToken(token);
    }

    return discordRest;
}

function buildFinanceDmText(approved: boolean, type: string, amount: number) {
    const typeText =
        FINANCE_STATUS_MESSAGES[type as keyof typeof FINANCE_STATUS_MESSAGES] ||
        'รายการการเงิน';

    return approved
        ? `✅ คำขอ${typeText} ฿${amount.toLocaleString()} ของคุณได้รับอนุมัติแล้วครับ`
        : `❌ คำขอ${typeText} ฿${amount.toLocaleString()} ของคุณถูกปฏิเสธครับ`;
}

function isTransactionConflict(message: string) {
    return TRANSACTION_CONFLICT_PARTIALS.some((entry) => message.includes(entry));
}

async function sendFinanceDM(
    memberId: string,
    approved: boolean,
    type: string,
    amount: number,
    approverName: string,
    context: {
        gangId: string;
        transactionId: string;
        actorDiscordId: string;
    }
) {
    try {
        const member = await db.query.members.findFirst({
            where: eq(members.id, memberId),
            columns: { discordId: true, name: true },
        });
        if (!member?.discordId) {
            return;
        }

        const dmChannel = await getDiscordRest().post(Routes.userChannels(), {
            body: { recipient_id: member.discordId },
        }) as { id: string };

        await getDiscordRest().post(Routes.channelMessages(dmChannel.id), {
            body: {
                content: buildFinanceDmText(approved, type, amount),
            },
        });
    } catch (error) {
        logWarn('api.finance.transaction.dm_failed', {
            ...context,
            memberId,
            approved,
            type,
            amount,
            approverName,
        });
        logError('api.finance.transaction.dm_error', error, {
            ...context,
            memberId,
            approved,
            type,
            amount,
            approverName,
        });
    }
}

async function requireFinanceTransactionAccess(gangId: string) {
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

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; transactionId: string }> }
) {
    const params = await props.params;
    const { gangId, transactionId } = params;
    let actorDiscordId = 'unknown';

    try {
        const { access, response } = await requireFinanceTransactionAccess(gangId);
        if (!access) {
            return response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionUser = (access.session as { user?: { discordId?: string; name?: string | null } } | null | undefined)?.user;
        actorDiscordId = sessionUser?.discordId || 'unknown';

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:finance:transaction:patch',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('finance-transaction-patch', gangId, transactionId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const body = await request.json();
        const action = body?.action;
        if (action !== 'APPROVE' && action !== 'REJECT') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        if (action === 'APPROVE') {
            const tierCheck = await checkTierAccess(gangId, 'finance');
            if (!tierCheck.allowed) {
                return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
            }
        }

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });
        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.status !== 'PENDING') {
            const statusLabel = transaction.status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
            return NextResponse.json(
                {
                    error: `รายการนี้ถูก${statusLabel}ไปแล้ว`,
                    alreadyProcessed: true,
                    currentStatus: transaction.status,
                },
                { status: 409 }
            );
        }

        if (action === 'REJECT') {
            await db.update(transactions)
                .set({
                    status: 'REJECTED',
                    approvedById: access.member.id,
                    approvedAt: new Date(),
                })
                .where(eq(transactions.id, transactionId));

            await db.insert(auditLogs).values({
                id: uuid(),
                gangId,
                actorId: actorDiscordId,
                actorName: sessionUser?.name || 'Unknown',
                action: 'FINANCE_REJECT',
                targetId: transactionId,
                details: JSON.stringify({ reason: 'Manual Rejection' }),
                createdAt: new Date(),
            });

            if (transaction.memberId) {
                await sendFinanceDM(
                    transaction.memberId,
                    false,
                    transaction.type,
                    transaction.amount,
                    sessionUser?.name || 'Admin',
                    { gangId, transactionId, actorDiscordId }
                );
            }

            return NextResponse.json({ success: true, status: 'REJECTED' });
        }

        const { FinanceService } = await import('@gang/database');
        await FinanceService.approveTransaction(db, {
            transactionId,
            actorId: access.member.id,
            actorName: sessionUser?.name || 'Unknown',
        });

        if (transaction.memberId) {
            await sendFinanceDM(
                transaction.memberId,
                true,
                transaction.type,
                transaction.amount,
                sessionUser?.name || 'Admin',
                { gangId, transactionId, actorDiscordId }
            );
        }

        return NextResponse.json({ success: true, status: 'APPROVED' });
    } catch (error: any) {
        const message = error instanceof Error ? error.message : '';

        if (message.includes('Concurrency Conflict')) {
            logWarn('api.finance.transaction.conflict', {
                gangId,
                transactionId,
                actorDiscordId,
            });
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }

        if (isTransactionConflict(message)) {
            logWarn('api.finance.transaction.rejected', {
                gangId,
                transactionId,
                actorDiscordId,
                reason: message,
            });
            return NextResponse.json({ error: message }, { status: 409 });
        }

        logError('api.finance.transaction.failed', error, {
            gangId,
            transactionId,
            actorDiscordId,
        });

        return NextResponse.json({
            error: message || 'Internal Server Error',
        }, { status: message ? 400 : 500 });
    }
}
