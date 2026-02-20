import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, transactions, gangs, members, auditLogs, gangSettings } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq, sql, and } from 'drizzle-orm';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { logToDiscord } from '@/lib/discordLogger';

function uuid() {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

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

        const typeText = type === 'LOAN' ? 'เบิก/ยืมเงิน' : type === 'REPAYMENT' ? 'คืนเงิน' : 'ฝากเงิน/สำรองจ่าย';
        const dmText = approved
            ? `✅ คำขอ${typeText} ฿${amount.toLocaleString()} ของคุณได้รับอนุมัติแล้วครับ`
            : `❌ คำขอ${typeText} ฿${amount.toLocaleString()} ของคุณถูกปฏิเสธครับ`;

        await discordRest.post(Routes.channelMessages(dmChannel.id), {
            body: { content: dmText }
        });
    } catch (err) {
        console.error('Failed to send finance DM:', err);
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
            const statusLabel = transaction.status === 'APPROVED' ? 'อนุมัติ' : 'ปฏิเสธ';
            return NextResponse.json(
                { error: `รายการนี้ถูก${statusLabel}ไปแล้ว`, alreadyProcessed: true, currentStatus: transaction.status },
                { status: 409 }
            );
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
                id: uuid(),
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

        return NextResponse.json({ success: true, status: 'APPROVED' });

    } catch (error: any) {
        console.error('Transaction Action Error:', error);
        if (error.message?.includes('Concurrency Conflict')) {
            await logToDiscord(`[Finance Approve] OCC Conflict — txId: ${params.transactionId}`, error);
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }
        if (error.message?.includes('รายการนี้') || error.message?.includes('ไม่ใช่สถานะ')) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        await logToDiscord(`[Finance Approve] Unexpected error — txId: ${params.transactionId}`, error);
        return NextResponse.json({
            error: error.message || 'Internal Server Error'
        }, { status: 400 });
    }
}
