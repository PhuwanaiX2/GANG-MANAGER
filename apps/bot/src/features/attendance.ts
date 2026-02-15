import { ButtonInteraction } from 'discord.js';
import { db, attendanceSessions, attendanceRecords, members, transactions } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { registerButtonHandler } from '../handlers/buttons';
import { checkFeatureEnabled } from '../utils/featureGuard';

// Register the attendance check-in button handler
registerButtonHandler('attendance_checkin_', handleCheckIn);

async function handleCheckIn(interaction: ButtonInteraction) {
    // Global feature flag check
    if (!await checkFeatureEnabled(interaction, 'attendance', 'ระบบเช็คชื่อ')) return;
    const sessionId = interaction.customId.replace('attendance_checkin_', '');
    const discordId = interaction.user.id;

    try {
        await interaction.deferReply({ ephemeral: true });

        // Get the session
        const session = await db.query.attendanceSessions.findFirst({
            where: eq(attendanceSessions.id, sessionId),
        });

        if (!session) {
            await interaction.editReply({
                content: '❌ ไม่พบรอบเช็คชื่อนี้',
            });
            return;
        }

        // Check if session is still active
        if (session.status !== 'ACTIVE') {
            await interaction.editReply({
                content: '🔒 รอบเช็คชื่อนี้ปิดแล้ว',
            });
            return;
        }

        // === TIME WINDOW VALIDATION ===
        const now = new Date();
        const startTime = new Date(session.startTime);
        const endTime = new Date(session.endTime);

        // Before start time
        if (now < startTime) {
            await interaction.editReply({
                content: `⏳ **ยังไม่ถึงเวลาเช็คชื่อ**\n\nเปิดเช็คชื่อเวลา **${startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.**`,
            });
            return;
        }

        // After end time
        if (now > endTime) {
            await interaction.editReply({
                content: `❌ **หมดเขตเช็คชื่อแล้ว**\n\nหมดเขตเมื่อ **${endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.**`,
            });
            return;
        }

        // Find member by Discord ID in this gang
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, session.gangId),
                eq(members.discordId, discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        if (!member) {
            await interaction.editReply({
                content: '❌ คุณยังไม่ได้เป็นสมาชิกของแก๊งนี้ หรือยังไม่ได้รับการอนุมัติ',
            });
            return;
        }

        // Check if already checked in
        const existingRecord = await db.query.attendanceRecords.findFirst({
            where: and(
                eq(attendanceRecords.sessionId, sessionId),
                eq(attendanceRecords.memberId, member.id)
            ),
        });

        if (existingRecord) {
            const statusText = existingRecord.status === 'PRESENT' ? '✅ มา' : '❌ ขาด';
            await interaction.editReply({
                content: `📋 คุณได้เช็คชื่อแล้ว\n**สถานะ:** ${statusText}\n**เวลา:** ${existingRecord.checkedInAt?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) || '-'}`,
            });
            return;
        }

        // Create attendance record - PRESENT
        await db.insert(attendanceRecords).values({
            id: nanoid(),
            sessionId,
            memberId: member.id,
            status: 'PRESENT',
            checkedInAt: now,
            penaltyAmount: 0,
        });

        // Reply with success
        await interaction.editReply({
            content: `✅ **เช็คชื่อสำเร็จ!**\n\n📅 **รอบ:** ${session.sessionName}\n⏱️ **เวลา:** ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
        });
    } catch (error) {
        console.error('Check-in error:', error);
        await interaction.editReply({
            content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง',
        });
    }
}
