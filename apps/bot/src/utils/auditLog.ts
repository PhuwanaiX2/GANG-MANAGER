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
    | 'MEMBER_KICK'
    | 'MEMBER_ROLE_CHANGE'
    | 'ATTENDANCE_CREATE'
    | 'ATTENDANCE_START'
    | 'ATTENDANCE_CLOSE'
    | 'ATTENDANCE_CANCEL'
    | 'CHECK_IN'
    | 'LEAVE_REQUEST'
    | 'LEAVE_APPROVE'
    | 'LEAVE_REJECT'
    | 'TRANSACTION_CREATE'
    | 'TRANSACTION_APPROVE'
    | 'TRANSACTION_REJECT'
    | 'TRANSFER_START'
    | 'TRANSFER_COMPLETE'
    | 'TRANSFER_CANCEL'
    | 'GANG_FEE'
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

const actionLabels: Record<string, { emoji: string; label: string; color: number }> = {
    GANG_SETUP:          { emoji: '🏠', label: 'ตั้งค่าแก๊ง',           color: 0x5865F2 },
    SETTINGS_UPDATE:     { emoji: '⚙️', label: 'อัปเดตการตั้งค่า',      color: 0x5865F2 },
    MEMBER_REGISTER:     { emoji: '📝', label: 'สมัครสมาชิกใหม่',      color: 0x3498DB },
    MEMBER_APPROVE:      { emoji: '✅', label: 'อนุมัติสมาชิก',         color: 0x57F287 },
    MEMBER_REJECT:       { emoji: '❌', label: 'ปฏิเสธสมาชิก',          color: 0xED4245 },
    MEMBER_UPDATE:       { emoji: '✏️', label: 'แก้ไขข้อมูลสมาชิก',    color: 0xFEE75C },
    MEMBER_DELETE:       { emoji: '�️', label: 'ลบสมาชิก',              color: 0xED4245 },
    MEMBER_KICK:         { emoji: '🚫', label: 'ไล่สมาชิกออก',         color: 0xED4245 },
    MEMBER_ROLE_CHANGE:  { emoji: '🎭', label: 'เปลี่ยนยศ',              color: 0xFEE75C },
    ATTENDANCE_CREATE:   { emoji: '📅', label: 'สร้างรอบเช็คชื่อ',       color: 0x3498DB },
    ATTENDANCE_START:    { emoji: '▶️', label: 'เปิดรอบเช็คชื่อ',       color: 0x57F287 },
    ATTENDANCE_CLOSE:    { emoji: '⏹️', label: 'ปิดรอบเช็คชื่อ',       color: 0xED4245 },
    ATTENDANCE_CANCEL:   { emoji: '❌', label: 'ยกเลิกรอบเช็คชื่อ',     color: 0x95A5A6 },
    CHECK_IN:            { emoji: '✅', label: 'เช็คชื่อ',                color: 0x57F287 },
    LEAVE_REQUEST:       { emoji: '📝', label: 'แจ้งลา',                 color: 0xFEE75C },
    LEAVE_APPROVE:       { emoji: '✅', label: 'อนุมัติการลา',          color: 0x57F287 },
    LEAVE_REJECT:        { emoji: '❌', label: 'ปฏิเสธการลา',           color: 0xED4245 },
    TRANSACTION_CREATE:  { emoji: '💰', label: 'สร้างรายการเงิน',       color: 0xFEE75C },
    TRANSACTION_APPROVE: { emoji: '✅', label: 'อนุมัติรายการเงิน',    color: 0x57F287 },
    TRANSACTION_REJECT:  { emoji: '❌', label: 'ปฏิเสธรายการเงิน',     color: 0xED4245 },
    TRANSFER_START:      { emoji: '🔄', label: 'เริ่มย้ายเซิร์ฟ',         color: 0xFF8C00 },
    TRANSFER_COMPLETE:   { emoji: '✅', label: 'ย้ายเซิร์ฟเสร็จสิ้น',    color: 0x57F287 },
    TRANSFER_CANCEL:     { emoji: '🚫', label: 'ยกเลิกย้ายเซิร์ฟ',      color: 0xED4245 },
    GANG_FEE:            { emoji: '💸', label: 'เรียกเก็บเงินแก๊ง',      color: 0xFF8C00 },
};

async function sendLogToDiscord(gangId: string, log: any, client: any): Promise<void> {
    try {
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
        });

        if (!settings?.logChannelId) return;

        const channel = client.channels.cache.get(settings.logChannelId) as TextChannel;
        if (!channel) return;

        const meta = actionLabels[log.action] || { emoji: '📋', label: log.action, color: 0x5865F2 };
        const thaiTime = new Date().toLocaleString('th-TH', {
            day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
            timeZone: 'Asia/Bangkok',
        });

        const embed = new EmbedBuilder()
            .setColor(meta.color)
            .setTitle(`${meta.emoji} ${meta.label}`)
            .addFields(
                { name: '👤 ผู้ดำเนินการ', value: `<@${log.actorId}> (${log.actorName})`, inline: true },
            );

        if (log.targetType && log.targetId) {
            embed.addFields({ name: '🎯 เป้าหมาย', value: `${log.targetType}`, inline: true });
        }

        // Show meaningful details from newValue
        if (log.newValue && typeof log.newValue === 'object') {
            const details: string[] = [];
            for (const [k, v] of Object.entries(log.newValue)) {
                if (v !== null && v !== undefined) {
                    details.push(`**${k}:** ${v}`);
                }
            }
            if (details.length > 0) {
                embed.addFields({ name: '📝 รายละเอียด', value: details.join('\n').slice(0, 1024) });
            }
        }

        embed.setFooter({ text: thaiTime });

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('Error sending log to Discord:', error);
    }
}
