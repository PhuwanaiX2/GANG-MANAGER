import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { db, attendanceSessions, attendanceRecords, members, gangs, auditLogs } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { isPresentLikeStatus } from '@gang/database/attendance';
import { registerButtonHandler } from '../handlers/buttons';
import { checkFeatureEnabled } from '../utils/featureGuard';
import { checkPermission } from '../utils/permissions';
import { closeSessionAndReport } from '../services/attendanceScheduler';
import { logError } from '../utils/logger';

// Register button handlers
registerButtonHandler('attendance_checkin_', handleCheckIn);
registerButtonHandler('attendance_close_', handleCloseSession);
registerButtonHandler('attendance_cancel_', handleCancelSession);

// === Helper: Build updated embed with checked-in list ===
function buildAttendanceEmbed(session: any, checkedInMembers: { name: string; checkedInAt: Date | null; status: string }[]) {
    const startDate = new Date(session.startTime);
    const endDate = new Date(session.endTime);

    const checkedInText = checkedInMembers.length > 0
        ? checkedInMembers.map((m, i) => `> ${i + 1}. ✅ **${m.name}** — ${m.checkedInAt?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) || '-'}`).join('\n')
        : '> *ยังไม่มีใครเช็คชื่อ*';

    // Truncate if too long (Discord embed field limit is 1024)
    const maxLen = 900;
    const displayText = checkedInText.length > maxLen
        ? checkedInText.slice(0, maxLen) + `\n> ...และอีก ${checkedInMembers.length - checkedInText.slice(0, maxLen).split('\n').length} คน`
        : checkedInText;

    return {
        title: `📋 ${session.sessionName}`,
        description: `กดปุ่มด้านล่างเพื่อเช็คชื่อ`,
        color: 0x57F287,
        fields: [
            {
                name: '🟢 เปิด',
                value: `${startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                inline: true,
            },
            {
                name: '🔴 หมดเขต',
                value: `${endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                inline: true,
            },
            {
                name: `✅ เช็คชื่อแล้ว (${checkedInMembers.length} คน)`,
                value: displayText,
            },
        ],
        footer: {
            text: new Date(session.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
        },
    };
}

// === Helper: Get active session components (buttons) — all in ONE row ===
function getActiveSessionComponents(sessionId: string) {
    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3, // Success (green)
                    label: '✅ เช็คชื่อ',
                    custom_id: `attendance_checkin_${sessionId}`,
                },
                {
                    type: 2,
                    style: 4, // Danger (red)
                    label: '🔒 ปิดรอบ',
                    custom_id: `attendance_close_${sessionId}`,
                },
                {
                    type: 2,
                    style: 2, // Secondary (grey)
                    label: '❌ ยกเลิกรอบ',
                    custom_id: `attendance_cancel_${sessionId}`,
                },
            ],
        },
    ];
}

// === Check-in Handler ===
async function handleCheckIn(interaction: ButtonInteraction) {
    if (!await checkFeatureEnabled(interaction, 'attendance', 'ระบบเช็คชื่อ')) return;
    const sessionId = interaction.customId.replace('attendance_checkin_', '');
    const discordId = interaction.user.id;

    try {
        // Acknowledge without sending a message — we'll update the embed
        await interaction.deferUpdate();

        const session = await db.query.attendanceSessions.findFirst({
            where: eq(attendanceSessions.id, sessionId),
        });

        if (!session || session.status !== 'ACTIVE') {
            await interaction.followUp({ content: '🔒 รอบเช็คชื่อนี้ปิดแล้ว', ephemeral: true });
            return;
        }

        const now = new Date();
        const endTime = new Date(session.endTime);

        if (now > endTime) {
            await interaction.followUp({ content: '❌ หมดเขตเช็คชื่อแล้ว', ephemeral: true });
            return;
        }

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, session.gangId),
                eq(members.discordId, discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        if (!member) {
            await interaction.followUp({ content: '❌ คุณยังไม่ได้เป็นสมาชิก หรือยังไม่ได้รับอนุมัติ', ephemeral: true });
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
            await interaction.followUp({ content: '📋 คุณเช็คชื่อไปแล้ว', ephemeral: true });
            return;
        }

        // Create attendance record
        await db.insert(attendanceRecords).values({
            id: nanoid(),
            sessionId,
            memberId: member.id,
            status: 'PRESENT',
            checkedInAt: now,
            penaltyAmount: 0,
        });

        // Fetch all checked-in members to update embed
        const allRecords = await db.query.attendanceRecords.findMany({
            where: eq(attendanceRecords.sessionId, sessionId),
            with: { member: true },
        });

        const checkedInList = allRecords
            .filter(r => isPresentLikeStatus(r.status))
            .map(r => ({
                name: r.member?.name || 'Unknown',
                checkedInAt: r.checkedInAt,
                status: r.status,
            }));

        // Update the original embed in-place
        const updatedEmbed = buildAttendanceEmbed(session, checkedInList);
        await interaction.editReply({
            embeds: [updatedEmbed],
            components: getActiveSessionComponents(sessionId),
        });

        await interaction.followUp({
            content: '✅ เช็คชื่อสำเร็จ — ระบบบันทึกคุณเป็น **มา** เรียบร้อยแล้ว',
            ephemeral: true,
        });
    } catch (error) {
        logError('bot.attendance.checkin.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', ephemeral: true });
        } catch { /* interaction expired */ }
    }
}

// === Close Session Handler (Admin only — applies penalties) ===
async function handleCloseSession(interaction: ButtonInteraction) {
    const sessionId = interaction.customId.replace('attendance_close_', '');

    try {
        await interaction.deferUpdate();

        const session = await db.query.attendanceSessions.findFirst({
            where: eq(attendanceSessions.id, sessionId),
        });

        if (!session || session.status !== 'ACTIVE') {
            await interaction.followUp({ content: '🔒 รอบนี้ปิดไปแล้ว', ephemeral: true });
            return;
        }

        // Permission check
        const hasPermission = await checkPermission(interaction, session.gangId, ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER']);
        if (!hasPermission) {
            await interaction.followUp({ content: '❌ เฉพาะ Owner/Admin/Attendance Officer เท่านั้น', ephemeral: true });
            return;
        }

        // Use shared close logic (marks absent, applies penalties, sends summary)
        await closeSessionAndReport(session, {
            actorId: interaction.user.id,
            actorName: interaction.user.displayName,
            triggeredBy: 'bot',
        });

        // Delete the original embed message entirely
        try {
            await interaction.deleteReply();
        } catch {
            // Fallback: disable buttons if delete fails
            await interaction.editReply({
                embeds: [{
                    title: `📋 ${session.sessionName}`,
                    description: '🔒 **ปิดรอบเช็คชื่อแล้ว**',
                    color: 0x95A5A6,
                }],
                components: [],
            });
        }
    } catch (error) {
        logError('bot.attendance.close.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true });
        } catch { /* */ }
    }
}

// === Cancel Session Handler (Admin only — no penalties) ===
async function handleCancelSession(interaction: ButtonInteraction) {
    const sessionId = interaction.customId.replace('attendance_cancel_', '');

    try {
        await interaction.deferUpdate();

        const session = await db.query.attendanceSessions.findFirst({
            where: eq(attendanceSessions.id, sessionId),
        });

        if (!session || session.status !== 'ACTIVE') {
            await interaction.followUp({ content: '🔒 รอบนี้ปิดไปแล้ว', ephemeral: true });
            return;
        }

        const hasPermission = await checkPermission(interaction, session.gangId, ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER']);
        if (!hasPermission) {
            await interaction.followUp({ content: '❌ เฉพาะ Owner/Admin/Attendance Officer เท่านั้น', ephemeral: true });
            return;
        }

        // Cancel: set status to CANCELLED, no penalties
        const closedAt = new Date();
        await db.update(attendanceSessions)
            .set({ status: 'CANCELLED', closedAt })
            .where(eq(attendanceSessions.id, sessionId));

        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: session.gangId,
            actorId: interaction.user.id,
            actorName: interaction.user.displayName,
            action: 'ATTENDANCE_CANCEL',
            targetType: 'ATTENDANCE_SESSION',
            targetId: session.id,
            oldValue: JSON.stringify({
                status: session.status,
                closedAt: session.closedAt || null,
            }),
            newValue: JSON.stringify({
                status: 'CANCELLED',
                closedAt,
            }),
            details: JSON.stringify({
                sessionId: session.id,
                sessionName: session.sessionName,
                triggeredBy: 'bot',
            }),
        });

        // Delete the original embed message entirely
        try {
            await interaction.deleteReply();
        } catch {
            // Fallback: disable buttons if delete fails
            await interaction.editReply({
                embeds: [{
                    title: `📋 ${session.sessionName}`,
                    description: '❌ **ยกเลิกรอบเช็คชื่อ** — ไม่มีการคิดค่าปรับ',
                    color: 0xED4245,
                }],
                components: [],
            });
        }
    } catch (error) {
        logError('bot.attendance.cancel.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true });
        } catch { /* */ }
    }
}

export { buildAttendanceEmbed, getActiveSessionComponents };
