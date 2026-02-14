import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, transactions, gangs, members, auditLogs, gangSettings } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq, sql, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { REST } from 'discord.js';
import { Routes, APIEmbed } from 'discord-api-types/v10';

const discordRest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

async function sendFinanceDM(memberId: string, approved: boolean, type: string, amount: number, approverName: string) {
    try {
        const member = await db.query.members.findFirst({
            where: eq(members.id, memberId),
            columns: { discordId: true, name: true }
        });
        if (!member?.discordId) return;

        // Create DM channel
        const dmChannel = await discordRest.post(Routes.userChannels(), {
            body: { recipient_id: member.discordId }
        }) as { id: string };

        const statusText = approved ? '✅ อนุมัติ' : '❌ ปฏิเสธ';
        const typeText = type === 'LOAN' ? 'เบิก/ยืมเงิน' : 'คืนเงิน';
        const color = approved ? 0x57F287 : 0xED4245;

        const embed: APIEmbed = {
            title: `${statusText} คำขอ${typeText}`,
            description: `คำขอ${typeText}ของคุณได้รับการตรวจสอบแล้ว`,
            color,
            fields: [
                { name: '💰 จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: '📋 สถานะ', value: statusText, inline: true },
                { name: '👤 ตรวจสอบโดย', value: approverName, inline: true },
            ],
            timestamp: new Date().toISOString(),
        };

        await discordRest.post(Routes.channelMessages(dmChannel.id), {
            body: { embeds: [embed] }
        });
    } catch (err) {
        console.error('Failed to send finance DM:', err);
    }
}

// Helper to send notification to Gang Channel
async function notifyGangChannel(gangId: string, embed: APIEmbed) {
    try {
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
            columns: { financeChannelId: true }
        });
        if (!settings?.financeChannelId) return;

        await discordRest.post(Routes.channelMessages(settings.financeChannelId), {
            body: { content: '@here มีรายการการเงินใหม่', embeds: [embed] }
        });
    } catch (err) {
        console.error('Failed to notify gang channel:', err);
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: { gangId: string; transactionId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId, transactionId } = params;
        const permissions = await getGangPermissions(gangId, session.user.discordId);

        if (!permissions.isTreasurer && !permissions.isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { action } = body; // 'APPROVE' | 'REJECT'

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.status !== 'PENDING') {
            return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 });
        }

        const approverMember = await db.query.members.findFirst({
            where: eq(members.discordId, session.user.discordId),
            columns: { id: true }
        });

        if (!approverMember?.id) {
            return NextResponse.json({ error: 'Approver member record not found' }, { status: 400 });
        }

        if (action === 'REJECT') {
            await db.update(transactions)
                .set({
                    status: 'REJECTED',
                    approvedById: approverMember.id,
                    approvedAt: new Date(),
                })
                .where(eq(transactions.id, transactionId));

            // Audit Log
            await db.insert(auditLogs).values({
                id: randomUUID(),
                gangId,
                actorId: session.user.discordId,
                actorName: session.user.name || 'Unknown',
                action: 'FINANCE_REJECT',
                targetId: transactionId,
                details: JSON.stringify({ reason: 'Manual Rejection' }),
                createdAt: new Date(),
            });

            // DM notify the requester
            if (transaction.memberId) {
                await sendFinanceDM(
                    transaction.memberId,
                    false,
                    transaction.type,
                    transaction.amount,
                    session.user.name || 'Admin'
                );
            }

            return NextResponse.json({ success: true, status: 'REJECTED' });
        }

        // APPROVE LOGIC
        const { FinanceService } = await import('@gang/database');
        const { newGangBalance: finalGangBalance } = await FinanceService.approveTransaction(db, {
            transactionId,
            actorId: approverMember.id,
            actorName: session.user.name || 'Unknown'
        });

        // Notifications (after successful commit)
        if (transaction.memberId) {
            await sendFinanceDM(
                transaction.memberId,
                true,
                transaction.type,
                transaction.amount,
                session.user.name || 'Admin'
            );
        }

        // Notify Gang Channel (#แจ้งธุรกรรม)
        const typeEmoji = {
            'LOAN': '💸',
            'REPAYMENT': '💰',
            'DEPOSIT': '📥'
        }[transaction.type] || '💵';

        const typeLabel = {
            'LOAN': 'เบิก/ยืมเงิน',
            'REPAYMENT': 'คืนเงิน',
            'DEPOSIT': 'ฝาก/สำรองจ่าย'
        }[transaction.type] || transaction.type;

        // Fetch Member Name for Embed
        const member = await db.query.members.findFirst({
            where: eq(members.id, transaction.memberId || ''),
            columns: { name: true }
        });

        const notifyEmbed: APIEmbed = {
            title: `${typeEmoji} อนุมัติ: ${typeLabel}`,
            description: `**${member?.name || 'สมาชิก'}** ทำรายการสำเร็จ`,
            color: 0x57F287,
            fields: [
                { name: 'จำนวน', value: `฿${transaction.amount.toLocaleString()}`, inline: true },
                { name: 'หมายเหตุ', value: transaction.description || '-', inline: true },
                { name: '🏦 ยอดกองกลางคงเหลือ', value: `฿${finalGangBalance.toLocaleString()}`, inline: false }
            ],
            timestamp: new Date().toISOString(),
            footer: { text: `อนุมัติโดย ${session.user.name || 'Admin'}` }
        };

        await notifyGangChannel(gangId, notifyEmbed);

        return NextResponse.json({ success: true, status: 'APPROVED' });

    } catch (error: any) {
        console.error('Transaction Action Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 400 });
    }
}
