import { TextChannel, EmbedBuilder } from 'discord.js';
import { db, auditLogs, gangSettings } from '@gang/database';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export type AuditAction =
    | 'GANG_SETUP'
    | 'SETTINGS_UPDATE'
    | 'MEMBER_REGISTER'
    | 'MEMBER_UPDATE'
    | 'MEMBER_DELETE'
    | 'ATTENDANCE_CREATE'
    | 'ATTENDANCE_START'
    | 'ATTENDANCE_CLOSE'
    | 'CHECK_IN'
    | 'LEAVE_REQUEST'
    | 'LEAVE_APPROVE'
    | 'LEAVE_REJECT'
    | 'TRANSACTION_CREATE'
    | 'TRANSACTION_APPROVE'
    | 'TRANSACTION_REJECT'
    | 'MEMBER_APPROVE'
    | 'MEMBER_REJECT';

interface AuditLogParams {
    gangId: string;
    actorId: string;
    actorName: string;
    action: AuditAction;
    targetType?: string;
    targetId?: string;
    oldValue?: any;
    newValue?: any;
    client?: any;
}

/**
 * Create audit log entry (immutable)
 */
export async function createAuditLog(params: AuditLogParams): Promise<void> {
    const { gangId, actorId, actorName, action, targetType, targetId, oldValue, newValue, client } = params;

    // Insert to database
    await db.insert(auditLogs).values({
        id: nanoid(),
        gangId,
        actorId,
        actorName,
        action,
        targetType,
        targetId,
        oldValue: oldValue ? JSON.stringify(oldValue) : null,
        newValue: newValue ? JSON.stringify(newValue) : null,
    });

    // Send to Discord log channel
    if (client) {
        await sendLogToDiscord(gangId, { actorId, actorName, action, targetType, targetId, newValue }, client);
    }
}

async function sendLogToDiscord(gangId: string, log: any, client: any): Promise<void> {
    try {
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
        });

        if (!settings?.logChannelId) return;

        const channel = client.channels.cache.get(settings.logChannelId) as TextChannel;
        if (!channel) return;

        const actionEmojis: Record<string, string> = {
            GANG_SETUP: '🏠',
            SETTINGS_UPDATE: '⚙️',
            MEMBER_REGISTER: '👤',
            MEMBER_UPDATE: '✏️',
            MEMBER_DELETE: '🗑️',
            ATTENDANCE_CREATE: '📅',
            ATTENDANCE_START: '▶️',
            ATTENDANCE_CLOSE: '⏹️',
            CHECK_IN: '✅',
            LEAVE_REQUEST: '📝',
            LEAVE_APPROVE: '✅',
            LEAVE_REJECT: '❌',
            TRANSACTION_CREATE: '💰',
            TRANSACTION_APPROVE: '✅',
            TRANSACTION_REJECT: '❌',
            MEMBER_APPROVE: '✅',
            MEMBER_REJECT: '❌',
        };

        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(`${actionEmojis[log.action] || '📋'} ${log.action}`)
            .addFields(
                { name: 'ผู้ดำเนินการ', value: log.actorName, inline: true },
            )
            .setTimestamp();

        if (log.targetType) {
            embed.addFields({ name: 'ประเภท', value: log.targetType, inline: true });
        }

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending log to Discord:', error);
    }
}
