import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, createCollectionBatch, members, gangs } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { logToDiscord } from '@/lib/discordLogger';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';

let _discordRest: REST | null = null;
function getDiscordRest() {
    if (!_discordRest) {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) throw new Error('DISCORD_BOT_TOKEN is not set');
        _discordRest = new REST({ version: '10' }).setToken(token);
    }
    return _discordRest;
}

const Schema = z.object({
    amount: z.number().int().positive().max(100000000),
    description: z.string().min(1),
    memberIds: z.array(z.string()).optional(),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId } = params;

        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isTreasurer && !permissions.isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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

        const { amount, description, memberIds } = parsed.data;

        const actorMember = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true },
        });

        if (!actorMember?.id) {
            return NextResponse.json({ error: 'Approver member record not found' }, { status: 400 });
        }

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

        // Filter by memberIds if provided
        const finalMembers = memberIds && memberIds.length > 0
            ? targetMembers.filter(m => memberIds.includes(m.id))
            : targetMembers;

        if (finalMembers.length === 0) {
            return NextResponse.json({ error: 'ไม่พบสมาชิกที่เลือก' }, { status: 400 });
        }

        const finalDescription = `ตั้งยอดเก็บเงินแก๊ง: ${description.trim()}`;
        const result = await createCollectionBatch(db, {
            gangId,
            title: description.trim(),
            description: finalDescription,
            amountPerMember: amount,
            memberIds: finalMembers.map(m => m.id),
            actorId: actorMember.id,
            actorName: actorMember.name || session.user.name || 'Unknown',
        });

        // Announcement (best-effort)
        try {
            const gang = await db.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { name: true },
                with: {
                    settings: {
                        columns: { announcementChannelId: true }
                    }
                }
            });

            const channelId = gang?.settings?.announcementChannelId;
            if (channelId) {
                const content = `@everyone\n\n` +
                    `# � ประกาศเก็บเงินแก๊ง${gang?.name ? ` ${gang.name}` : ''}\n` +
                    `## จำนวน ฿${amount.toLocaleString()} ต่อคน\n` +
                    `## 📝 ${description.trim()}`;

                await getDiscordRest().post(Routes.channelMessages(channelId), {
                    body: { content }
                });
            }
        } catch (err) {
            console.error('Gang fee announcement failed:', err);
        }

        return NextResponse.json({ success: true, count: result.count, batchId: result.batchId, totalAmountDue: result.totalAmountDue });
    } catch (error: any) {
        console.error('Gang Fee API Error:', error);
        if (error.message?.includes('จำนวนเงินไม่ถูกต้อง') || error.message?.includes('กรุณาระบุสมาชิก') || error.message?.includes('ไม่พบสมาชิกที่เลือก')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message?.includes('Concurrency Conflict')) {
            await logToDiscord(`[Gang Fee Create] OCC Conflict — gangId: ${params.gangId}`, error);
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }
        await logToDiscord(`[Gang Fee Create] Unexpected error — gangId: ${params.gangId}`, error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
