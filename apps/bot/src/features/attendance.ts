import {
    ActionRowBuilder,
    ButtonInteraction,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { db, attendanceSessions, attendanceRecords, members, gangs } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { isManualRollCallSession, isPresentLikeStatus, isSupplementalAttendanceSession, requiresAttendanceCode } from '@gang/database/attendance';
import { registerButtonHandler } from '../handlers/buttons';
import { registerModalHandler } from '../handlers/modals';
import { checkFeatureEnabled } from '../utils/featureGuard';
import { checkPermission } from '../utils/permissions';
import { closeSessionAndReport } from '../services/attendanceScheduler';
import { logError } from '../utils/logger';

// Register button handlers
registerButtonHandler('attendance_code_checkin_', handleCodeCheckInButton);
registerButtonHandler('attendance_checkin_', handleCheckIn);
registerButtonHandler('attendance_close_confirm_', handleCloseSessionConfirmed);
registerButtonHandler('attendance_close_abort_', handleCloseSessionAbort);
registerButtonHandler('attendance_close_', handleCloseSessionPrompt);
registerButtonHandler('attendance_cancel_', handleCancelSession);
registerModalHandler('attendance_code_modal_', handleCodeCheckInSubmit);

// === Helper: Build updated embed with checked-in list ===
function buildAttendanceEmbed(session: any, checkedInMembers: { name: string; checkedInAt: Date | null; status: string }[]) {
    const startDate = new Date(session.startTime);
    const endDate = new Date(session.endTime);
    const isSupplementalSession = isSupplementalAttendanceSession(session.countingPolicy);
    const needsCode = requiresAttendanceCode(session.verificationMode);

    const checkedInText = checkedInMembers.length > 0
        ? checkedInMembers.map((m, i) => `> ${i + 1}. ✅ **${m.name}** — ${m.checkedInAt?.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) || '-'}`).join('\n')
        : isSupplementalSession ? '> *ยังไม่มีผู้เข้าร่วม*' : '> *ยังไม่มีใครเช็คชื่อ*';

    // Truncate if too long (Discord embed field limit is 1024)
    const maxLen = 900;
    const displayText = checkedInText.length > maxLen
        ? checkedInText.slice(0, maxLen) + `\n> ...และอีก ${checkedInMembers.length - checkedInText.slice(0, maxLen).split('\n').length} คน`
        : checkedInText;

    return {
        title: `📋 ${session.sessionName}`,
        description: isSupplementalSession
            ? needsCode
                ? 'รอบเสริมนี้ต้องกรอกรหัสจากเจ้าหน้าที่ก่อนบันทึก และไม่นับคนที่ไม่เข้าร่วมเป็นขาด'
                : 'รอบเสริมนี้บันทึกเฉพาะคนที่เข้าร่วม ไม่ลงขาดและไม่คิดค่าปรับ'
            : needsCode
                ? 'กดปุ่มด้านล่างแล้วกรอกรหัส 4 หลักจากเจ้าหน้าที่เพื่อเช็คชื่อ'
                : 'กดปุ่มด้านล่างเพื่อเช็คชื่อ',
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
                name: isSupplementalSession ? `✅ เข้าร่วมแล้ว (${checkedInMembers.length} คน)` : `✅ เช็คชื่อแล้ว (${checkedInMembers.length} คน)`,
                value: displayText,
            },
        ],
        footer: {
            text: new Date(session.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
        },
    };
}

// === Helper: Get active session components (buttons) — all in ONE row ===
function getActiveSessionComponents(sessionId: string, countingPolicy?: string | null, verificationMode?: string | null) {
    const isSupplementalSession = isSupplementalAttendanceSession(countingPolicy);
    const needsCode = requiresAttendanceCode(verificationMode);

    return [
        {
            type: 1,
            components: [
                {
                    type: 2,
                    style: 3, // Success (green)
                    label: needsCode ? '🔐 กรอกรหัส' : isSupplementalSession ? '✅ เข้าร่วม' : '✅ เช็คชื่อ',
                    custom_id: needsCode ? `attendance_code_checkin_${sessionId}` : `attendance_checkin_${sessionId}`,
                },
                {
                    type: 2,
                    style: 4, // Danger (red)
                    label: '🔒 ปิดรอบ',
                    custom_id: `attendance_close_${sessionId}`,
                },
            ],
        },
    ];
}

function buildAttendanceCodeModal(sessionId: string, sessionName?: string | null) {
    const modal = new ModalBuilder()
        .setCustomId(`attendance_code_modal_${sessionId}`)
        .setTitle('กรอกรหัสเช็คชื่อ');

    const codeInput = new TextInputBuilder()
        .setCustomId('attendance_code')
        .setLabel('รหัส 4 หลักจากเจ้าหน้าที่')
        .setPlaceholder(sessionName ? `รหัสสำหรับ ${sessionName}` : 'เช่น 7421')
        .setStyle(TextInputStyle.Short)
        .setMinLength(4)
        .setMaxLength(4)
        .setRequired(true);

    return modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(codeInput)
    );
}

function normalizeAttendanceCodeInput(value: string) {
    return value.replace(/\D/g, '').slice(0, 4);
}

function getAttendanceRecordNote(session: any, proofType?: 'CODE' | null) {
    if (proofType === 'CODE') {
        return isSupplementalAttendanceSession(session.countingPolicy)
            ? 'เข้าร่วมรอบเสริมผ่าน Discord ด้วยรหัสจากเจ้าหน้าที่'
            : 'เช็คชื่อผ่าน Discord ด้วยรหัสจากเจ้าหน้าที่';
    }

    return isSupplementalAttendanceSession(session.countingPolicy)
        ? 'เข้าร่วมรอบเสริมผ่าน Discord'
        : 'ลงทะเบียนผ่าน Discord';
}

async function getCheckedInMembersForSession(sessionId: string) {
    const allRecords = await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.sessionId, sessionId),
        with: { member: true },
    });

    return allRecords
        .filter(r => isPresentLikeStatus(r.status))
        .map(r => ({
            name: r.member?.name || 'Unknown',
            checkedInAt: r.checkedInAt,
            status: r.status,
        }));
}

async function patchStoredAttendancePanel(session: any, sessionId: string) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken || !session.discordChannelId || !session.discordMessageId) {
        return;
    }

    const checkedInList = await getCheckedInMembersForSession(sessionId);
    const updatedEmbed = buildAttendanceEmbed(session, checkedInList);

    const response = await fetch(`https://discord.com/api/v10/channels/${session.discordChannelId}/messages/${session.discordMessageId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            embeds: [updatedEmbed],
            components: getActiveSessionComponents(sessionId, session.countingPolicy, session.verificationMode),
        }),
    });

    if (!response.ok) {
        logError('bot.attendance.panel_patch_failed', new Error(await response.text()), {
            sessionId,
            gangId: session.gangId,
            statusCode: response.status,
        });
    }
}

async function findEligibleCheckInMember(session: any, discordId: string) {
    return db.query.members.findFirst({
        where: and(
            eq(members.gangId, session.gangId),
            eq(members.discordId, discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    });
}

async function findExistingAttendanceRecord(sessionId: string, memberId: string) {
    return db.query.attendanceRecords.findFirst({
        where: and(
            eq(attendanceRecords.sessionId, sessionId),
            eq(attendanceRecords.memberId, memberId)
        ),
    });
}

async function createPresentAttendanceRecord(session: any, member: any, proofType?: 'CODE' | null) {
    const now = new Date();

    await db.insert(attendanceRecords)
        .values({
            id: nanoid(),
            sessionId: session.id,
            memberId: member.id,
            status: 'PRESENT',
            checkedInAt: now,
            penaltyAmount: 0,
            notes: getAttendanceRecordNote(session, proofType),
            proofType: proofType || null,
            proofValue: proofType === 'CODE' ? 'MATCHED' : null,
        })
        .onConflictDoNothing({
            target: [attendanceRecords.sessionId, attendanceRecords.memberId],
        });
}

async function getAttendanceSessionForGuild(sessionId: string, guildId: string | null) {
    if (!guildId) {
        return null;
    }

    const session = await db.query.attendanceSessions.findFirst({
        where: eq(attendanceSessions.id, sessionId),
    });
    if (!session) {
        return null;
    }

    const gang = await db.query.gangs.findFirst({
        where: and(
            eq(gangs.id, session.gangId),
            eq(gangs.discordGuildId, guildId)
        ),
        columns: { id: true },
    });

    return gang ? session : null;
}

async function handleCodeCheckInButton(interaction: ButtonInteraction) {
    if (!await checkFeatureEnabled(interaction, 'attendance', 'ระบบเช็คชื่อ')) return;

    const sessionId = interaction.customId.replace('attendance_code_checkin_', '');
    await interaction.showModal(buildAttendanceCodeModal(sessionId));
}

// === Check-in Handler ===
async function handleCheckIn(interaction: ButtonInteraction) {
    if (!await checkFeatureEnabled(interaction, 'attendance', 'ระบบเช็คชื่อ')) return;
    const sessionId = interaction.customId.replace('attendance_checkin_', '');
    const discordId = interaction.user.id;

    try {
        const session = await getAttendanceSessionForGuild(sessionId, interaction.guildId);

        if (!session || session.status !== 'ACTIVE' || isManualRollCallSession(session.mode)) {
            await interaction.deferUpdate();
            await interaction.followUp({ content: '🔒 รอบเช็คชื่อนี้ปิดแล้ว', flags: MessageFlags.Ephemeral });
            return;
        }

        const now = new Date();
        const endTime = new Date(session.endTime);

        if (now > endTime) {
            await interaction.deferUpdate();
            await interaction.followUp({ content: '❌ หมดเขตเช็คชื่อแล้ว', flags: MessageFlags.Ephemeral });
            return;
        }

        const member = await findEligibleCheckInMember(session, discordId);

        if (!member) {
            await interaction.deferUpdate();
            await interaction.followUp({ content: '❌ คุณยังไม่ได้เป็นสมาชิก หรือยังไม่ได้รับอนุมัติ', flags: MessageFlags.Ephemeral });
            return;
        }

        // Check if already checked in
        const existingRecord = await findExistingAttendanceRecord(sessionId, member.id);

        if (existingRecord) {
            await interaction.deferUpdate();
            await interaction.followUp({ content: '📋 คุณเช็คชื่อไปแล้ว', flags: MessageFlags.Ephemeral });
            return;
        }

        if (requiresAttendanceCode(session.verificationMode)) {
            await interaction.showModal(buildAttendanceCodeModal(sessionId, session.sessionName));
            return;
        }

        // Acknowledge without sending a message — we'll update the embed
        await interaction.deferUpdate();

        // Create attendance record
        await createPresentAttendanceRecord(session, member);

        // Fetch all checked-in members to update embed
        const checkedInList = await getCheckedInMembersForSession(sessionId);

        // Update the original embed in-place
        const updatedEmbed = buildAttendanceEmbed(session, checkedInList);
        await interaction.editReply({
            embeds: [updatedEmbed],
            components: getActiveSessionComponents(sessionId, session.countingPolicy, session.verificationMode),
        });

        await interaction.followUp({
            content: isSupplementalAttendanceSession(session.countingPolicy)
                ? '✅ เข้าร่วมรอบเสริมสำเร็จ — ระบบบันทึกคุณเรียบร้อยแล้ว'
                : '✅ เช็คชื่อสำเร็จ — ระบบบันทึกคุณเป็น **มา** เรียบร้อยแล้ว',
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logError('bot.attendance.checkin.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', flags: MessageFlags.Ephemeral });
        } catch { /* interaction expired */ }
    }
}

async function handleCodeCheckInSubmit(interaction: ModalSubmitInteraction) {
    const sessionId = interaction.customId.replace('attendance_code_modal_', '');
    const submittedCode = normalizeAttendanceCodeInput(interaction.fields.getTextInputValue('attendance_code'));

    try {
        const session = await getAttendanceSessionForGuild(sessionId, interaction.guildId);

        if (!session || session.status !== 'ACTIVE' || isManualRollCallSession(session.mode)) {
            await interaction.reply({ content: '🔒 รอบเช็คชื่อนี้ปิดแล้ว', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!requiresAttendanceCode(session.verificationMode)) {
            await interaction.reply({ content: 'รอบนี้ไม่ได้ใช้รหัส ย้อนกลับไปกดปุ่มเช็คชื่ออีกครั้ง', flags: MessageFlags.Ephemeral });
            return;
        }

        const now = new Date();
        if (now > new Date(session.endTime)) {
            await interaction.reply({ content: '❌ หมดเขตเช็คชื่อแล้ว', flags: MessageFlags.Ephemeral });
            return;
        }

        const member = await findEligibleCheckInMember(session, interaction.user.id);
        if (!member) {
            await interaction.reply({ content: '❌ คุณยังไม่ได้เป็นสมาชิก หรือยังไม่ได้รับอนุมัติ', flags: MessageFlags.Ephemeral });
            return;
        }

        const existingRecord = await findExistingAttendanceRecord(sessionId, member.id);
        if (existingRecord) {
            await interaction.reply({ content: '📋 คุณเช็คชื่อไปแล้ว', flags: MessageFlags.Ephemeral });
            return;
        }

        if (!session.verificationCode || submittedCode !== session.verificationCode) {
            await interaction.reply({ content: '❌ รหัสเช็คชื่อไม่ถูกต้อง กรุณาขอรหัสล่าสุดจากเจ้าหน้าที่', flags: MessageFlags.Ephemeral });
            return;
        }

        await createPresentAttendanceRecord(session, member, 'CODE');
        await patchStoredAttendancePanel(session, sessionId);

        await interaction.reply({
            content: isSupplementalAttendanceSession(session.countingPolicy)
                ? '✅ เข้าร่วมรอบเสริมสำเร็จ — รหัสถูกต้องและระบบบันทึกคุณเรียบร้อยแล้ว'
                : '✅ เช็คชื่อสำเร็จ — รหัสถูกต้องและระบบบันทึกคุณเป็น **มา** เรียบร้อยแล้ว',
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logError('bot.attendance.code_checkin.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.reply({ content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', flags: MessageFlags.Ephemeral });
        } catch { /* interaction expired */ }
    }
}

async function updateStoredAttendanceMessageAfterClose(session: any) {
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const isSupplementalSession = isSupplementalAttendanceSession(session.countingPolicy);
    if (!botToken || !session.discordChannelId || !session.discordMessageId) {
        return;
    }

    try {
        const response = await fetch(`https://discord.com/api/v10/channels/${session.discordChannelId}/messages/${session.discordMessageId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                embeds: [{
                    title: `📋 ${session.sessionName}`,
                    description: isSupplementalSession ? '🔒 **ปิดรอบเสริมแล้ว**' : '🔒 **ปิดรอบเช็คชื่อแล้ว**',
                    color: 0x95A5A6,
                }],
                components: [],
            }),
        });

        if (!response.ok) {
            logError('bot.attendance.close.message_patch_failed', new Error(await response.text()), {
                sessionId: session.id,
                gangId: session.gangId,
                channelId: session.discordChannelId,
                messageId: session.discordMessageId,
                statusCode: response.status,
            });
        }
    } catch (error) {
        logError('bot.attendance.close.message_patch_error', error, {
            sessionId: session.id,
            gangId: session.gangId,
            channelId: session.discordChannelId,
            messageId: session.discordMessageId,
        });
    }
}

// === Close Session Prompt (Admin only — asks before applying penalties) ===
async function handleCloseSessionPrompt(interaction: ButtonInteraction) {
    const sessionId = interaction.customId.replace('attendance_close_', '');

    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const session = await getAttendanceSessionForGuild(sessionId, interaction.guildId);

        if (!session || session.status !== 'ACTIVE') {
            await interaction.editReply({ content: '🔒 รอบนี้ปิดไปแล้ว' });
            return;
        }

        // Permission check
        const hasPermission = await checkPermission(interaction, session.gangId, ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER']);
        if (!hasPermission) {
            await interaction.editReply({ content: '❌ เฉพาะหัวหน้าแก๊ง แอดมิน หรือผู้ดูแลเช็คชื่อเท่านั้น' });
            return;
        }

        const isSupplementalSession = isSupplementalAttendanceSession(session.countingPolicy);

        await interaction.editReply({
            content: isSupplementalSession
                ? `ยืนยันปิดรอบเสริม **${session.sessionName}** ใช่ไหม?\nระบบจะสรุปเฉพาะคนที่เข้าร่วม ไม่ลงขาดและไม่คิดค่าปรับ`
                : `ยืนยันปิดรอบ **${session.sessionName}** ใช่ไหม?\nระบบจะสรุปผล ส่งรายงานไป Discord และคิดค่าปรับตามกฎของรอบนี้`,
            components: [{
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 4,
                        label: 'ยืนยันปิดรอบ',
                        custom_id: `attendance_close_confirm_${sessionId}`,
                    },
                    {
                        type: 2,
                        style: 2,
                        label: 'ยังไม่ปิด',
                        custom_id: `attendance_close_abort_${sessionId}`,
                    },
                ],
            }],
        });
    } catch (error) {
        logError('bot.attendance.close_prompt.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            if (interaction.deferred || interaction.replied) {
                await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่' });
            } else {
                await interaction.reply({ content: '❌ เกิดข้อผิดพลาด กรุณาลองใหม่', flags: MessageFlags.Ephemeral });
            }
        } catch { /* */ }
    }
}

async function handleCloseSessionAbort(interaction: ButtonInteraction) {
    try {
        await interaction.update({
            content: 'ยังไม่ปิดรอบเช็คชื่อ',
            components: [],
        });
    } catch (error) {
        logError('bot.attendance.close_abort.failed', error, {
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
    }
}

// === Close Session Confirmed (Admin only — applies penalties) ===
async function handleCloseSessionConfirmed(interaction: ButtonInteraction) {
    const sessionId = interaction.customId.replace('attendance_close_confirm_', '');

    try {
        await interaction.deferUpdate();

        const session = await getAttendanceSessionForGuild(sessionId, interaction.guildId);

        if (!session || session.status !== 'ACTIVE') {
            await interaction.editReply({ content: '🔒 รอบนี้ปิดไปแล้ว', components: [] });
            return;
        }

        const hasPermission = await checkPermission(interaction, session.gangId, ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER']);
        if (!hasPermission) {
            await interaction.editReply({ content: '❌ เฉพาะหัวหน้าแก๊ง แอดมิน หรือผู้ดูแลเช็คชื่อเท่านั้น', components: [] });
            return;
        }

        // Use shared close logic (marks absent, applies penalties, sends summary)
        await closeSessionAndReport(session, {
            actorId: interaction.user.id,
            actorName: interaction.user.displayName,
            triggeredBy: 'bot',
        });

        await updateStoredAttendanceMessageAfterClose(session);
        await interaction.editReply({
            content: isSupplementalAttendanceSession(session.countingPolicy)
                ? `ปิดรอบเสริม **${session.sessionName}** แล้ว และส่งสรุปผู้เข้าร่วมไป Discord แล้ว`
                : `ปิดรอบ **${session.sessionName}** แล้ว และส่งสรุปเช็คชื่อไป Discord แล้ว`,
            components: [],
        });
    } catch (error) {
        logError('bot.attendance.close.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด', components: [] });
        } catch { /* */ }
    }
}

// === Cancel Session Handler — cancellation is managed in web to keep audit and UX consistent ===
async function handleCancelSession(interaction: ButtonInteraction) {
    const sessionId = interaction.customId.replace('attendance_cancel_', '');

    try {
        await interaction.reply({
            content: 'ยกเลิกรอบเช็คชื่อให้ทำในหน้าเว็บเท่านั้น เพื่อให้เห็นข้อมูลรอบ รายการสมาชิก และ audit ก่อนยืนยัน',
            flags: MessageFlags.Ephemeral,
        });
    } catch (error) {
        logError('bot.attendance.cancel.failed', error, {
            sessionId,
            actorDiscordId: interaction.user.id,
            guildId: interaction.guildId,
        });
        try {
            await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', flags: MessageFlags.Ephemeral });
        } catch { /* */ }
    }
}

export { buildAttendanceEmbed, getActiveSessionComponents };
