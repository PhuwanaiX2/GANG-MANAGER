import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { checkTierAccess } from '@/lib/tierGuard';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';
import { db, createCollectionBatch, members, gangs } from '@gang/database';

const Schema = z.object({
    amount: z.number().int().positive().max(100000000),
    description: z.string().min(1),
    memberIds: z.array(z.string()).optional(),
    collectionType: z.enum(['GANG_FEE', 'FINE']).optional().default('GANG_FEE'),
});

const GANG_FEE_BAD_REQUEST_MESSAGES = [
    'จำนวนเงินไม่ถูกต้อง',
    'กรุณาระบุสมาชิก',
    'ไม่พบสมาชิกที่เลือก',
];

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

function isGangFeeBadRequest(message: string) {
    return GANG_FEE_BAD_REQUEST_MESSAGES.some((entry) => message.includes(entry));
}

async function requireGangFeeAccess(gangId: string) {
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
        const { access, response } = await requireGangFeeAccess(gangId);
        if (!access) {
            return response ?? NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const sessionUser = (access.session as { user?: { discordId?: string; name?: string | null } } | null | undefined)?.user;
        actorDiscordId = sessionUser?.discordId || 'unknown';

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:finance:gang-fee:create',
            limit: 15,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('gang-fee-create', gangId, actorDiscordId),
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

        const { amount, description, memberIds, collectionType } = parsed.data;

        const targetMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true },
        });

        if (targetMembers.length === 0) {
            return NextResponse.json({ error: 'ไม่พบสมาชิกในแก๊ง' }, { status: 400 });
        }

        const finalMembers = memberIds && memberIds.length > 0
            ? targetMembers.filter((member) => memberIds.includes(member.id))
            : targetMembers;

        if (finalMembers.length === 0) {
            return NextResponse.json({ error: 'ไม่พบสมาชิกที่เลือก' }, { status: 400 });
        }

        const descriptionPrefix = collectionType === 'FINE'
            ? 'ค่าปรับสมาชิก'
            : 'ตั้งยอดเก็บเงินแก๊ง';
        const finalDescription = `${descriptionPrefix}: ${description.trim()}`;
        const result = await createCollectionBatch(db, {
            gangId,
            title: description.trim(),
            description: finalDescription,
            amountPerMember: amount,
            memberIds: finalMembers.map((member) => member.id),
            actorId: access.member.id,
            actorName: access.member.name || sessionUser?.name || 'Unknown',
        });

        try {
            const gang = await db.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { name: true },
                with: {
                    settings: {
                        columns: { announcementChannelId: true },
                    },
                },
            });

            const channelId = gang?.settings?.announcementChannelId;
            if (channelId) {
                const announcementTitle = collectionType === 'FINE'
                    ? 'ประกาศค่าปรับสมาชิก'
                    : 'ประกาศเก็บเงินแก๊ง';
                const content =
                    `@everyone\n\n` +
                    `# ${announcementTitle}${gang?.name ? ` ${gang.name}` : ''}\n` +
                    `## จำนวน ฿${amount.toLocaleString()} ต่อคน\n` +
                    `## 📝 ${description.trim()}`;

                await getDiscordRest().post(Routes.channelMessages(channelId), {
                    body: { content },
                });
            }
        } catch (announcementError) {
            logWarn('api.finance.gang_fee.announcement_failed', {
                gangId,
                actorDiscordId,
                error: announcementError,
            });
        }

        return NextResponse.json({
            success: true,
            count: result.count,
            batchId: result.batchId,
            totalAmountDue: result.totalAmountDue,
            collectionType,
        });
    } catch (error: any) {
        const message = error instanceof Error ? error.message : '';

        if (isGangFeeBadRequest(message)) {
            logWarn('api.finance.gang_fee.rejected', {
                gangId,
                actorDiscordId,
                reason: message,
            });
            return NextResponse.json({ error: message }, { status: 400 });
        }

        if (message.includes('Concurrency Conflict')) {
            logWarn('api.finance.gang_fee.conflict', {
                gangId,
                actorDiscordId,
            });
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }

        logError('api.finance.gang_fee.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
