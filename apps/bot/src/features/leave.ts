import { ButtonInteraction, ModalSubmitInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { db, leaveRequests, members, gangs, gangSettings, reviewLeaveRequest, LeaveReviewError, createLeaveRequest, CreateLeaveRequestError, buildLeaveReviewDiscordEmbed, buildLeaveRequestDiscordEmbed } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { registerButtonHandler, registerModalHandler } from '../handlers';
import { checkFeatureEnabled } from '../utils/featureGuard';
import { checkPermission } from '../utils/permissions';
import { logError, logWarn } from '../utils/logger';

// Leave handling logic is here. Command registration is handled in commands/setupLeave.ts

const lateDelayOptions = [15, 30, 60, 90, 120] as const;

// 1. Handle "Leave Full" button -> Show Modal (2 fields: Days + Reason)
// 1. Handle "Leave Multi-Day" button -> Show Modal (2 fields: Days + Reason)
registerButtonHandler('request_leave_multi', async (interaction: ButtonInteraction) => {
    // Global feature flag check
    if (!await checkFeatureEnabled(interaction, 'leave', 'ระบบแจ้งลา')) return;

    const modal = new ModalBuilder()
        .setCustomId('leave_form_MULTI')
        .setTitle('🔴 แจ้งลาหลายวัน');

    const daysInput = new TextInputBuilder()
        .setCustomId('leave_days')
        .setLabel('ลากี่วัน?')
        .setPlaceholder('พิมพ์ตัวเลข เช่น 2, 3, 4')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(2);

    const reasonInput = new TextInputBuilder()
        .setCustomId('leave_reason')
        .setLabel('เหตุผล')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('ระบุเหตุผลการลา...')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(daysInput),
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
});

// 1.5 Handle "Leave 1 Day" button -> Show Modal (1 field: Reason)
registerButtonHandler('request_leave_1day', async (interaction: ButtonInteraction) => {
    // Global feature flag check
    if (!await checkFeatureEnabled(interaction, 'leave', 'ระบบแจ้งลา')) return;

    const modal = new ModalBuilder()
        .setCustomId('leave_form_1DAY')
        .setTitle('🟢 แจ้งลา 1 วัน');

    // No days input, assume 1 day

    const reasonInput = new TextInputBuilder()
        .setCustomId('leave_reason')
        .setLabel('เหตุผล')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('ระบุเหตุผลการลา...')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
});

// 2. Handle "Leave Late" button -> Show preset delay choices for faster UX
registerButtonHandler('request_leave_late', async (interaction: ButtonInteraction) => {
    if (!await checkFeatureEnabled(interaction, 'leave', 'ระบบแจ้งลา')) return;

    const firstRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('late_eta_15').setLabel('15 นาที').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('late_eta_30').setLabel('30 นาที').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('late_eta_60').setLabel('1 ชั่วโมง').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('late_eta_90').setLabel('1.5 ชั่วโมง').setStyle(ButtonStyle.Primary),
    );

    const secondRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('late_eta_120').setLabel('2 ชั่วโมง').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('late_eta_custom').setLabel('กำหนดเอง').setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({
        content: '🟡 เลือกก่อนว่าจะเข้าช้าประมาณเท่าไร',
        components: [firstRow, secondRow],
        ephemeral: true,
    });
});

registerButtonHandler('late_eta_', async (interaction: ButtonInteraction) => {
    const choice = interaction.customId.replace('late_eta_', '');

    if (choice === 'custom') {
        const modal = new ModalBuilder()
            .setCustomId('leave_form_LATE_CUSTOM')
            .setTitle('🟡 แจ้งเข้าช้า');

        const timeInput = new TextInputBuilder()
            .setCustomId('late_time')
            .setLabel('จะเข้ากี่โมง?')
            .setPlaceholder('เช่น 20:00, 21:30, 3ทุ่ม')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(10);

        const reasonInput = new TextInputBuilder()
            .setCustomId('leave_reason')
            .setLabel('เหตุผล (ไม่บังคับ)')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('เช่น รถติด / ติดงาน / เน็ตมีปัญหา')
            .setRequired(false);

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
            new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
        );

        await interaction.showModal(modal);
        return;
    }

    const minutes = Number(choice);
    if (!lateDelayOptions.includes(minutes as typeof lateDelayOptions[number])) {
        await interaction.reply({ content: '❌ ตัวเลือกเวลาไม่ถูกต้อง', ephemeral: true });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId(`leave_form_LATE_PRESET_${minutes}`)
        .setTitle('🟡 แจ้งเข้าช้า');

    const reasonInput = new TextInputBuilder()
        .setCustomId('leave_reason')
        .setLabel(`เหตุผล (ไม่บังคับ) — ช้าประมาณ ${minutes} นาที`)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('เช่น รถติด / ติดงาน / เน็ตมีปัญหา')
        .setRequired(false);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
});

// Helper: Parse Thai time input like "3ทุ่ม", "20:00", "21.30"
function parseThaiTime(input: string): { hours: number; minutes: number } | null {
    const cleaned = input.trim().toLowerCase();

    // Pattern: "3ทุ่ม" -> 21:00, "4ทุ่ม" -> 22:00 (ทุ่ม = 18:00 + N)
    const thumMatch = cleaned.match(/(\d+)\s*ทุ่ม/);
    if (thumMatch) {
        const n = parseInt(thumMatch[1]);
        return { hours: 18 + n, minutes: 0 };
    }

    // Pattern: "ตี3" -> 03:00, "ตี4" -> 04:00
    const teeMatch = cleaned.match(/ตี\s*(\d+)/);
    if (teeMatch) {
        return { hours: parseInt(teeMatch[1]), minutes: 0 };
    }

    // Pattern: "6โมงเย็น" -> 18:00
    const eveningMatch = cleaned.match(/(\d+)\s*โมงเย็น/);
    if (eveningMatch) {
        return { hours: 12 + parseInt(eveningMatch[1]), minutes: 0 };
    }

    // Pattern: "10โมง" -> 10:00
    const mongMatch = cleaned.match(/(\d+)\s*โมง/);
    if (mongMatch) {
        const h = parseInt(mongMatch[1]);
        return { hours: h <= 6 ? h + 12 : h, minutes: 0 }; // Assume PM if <= 6
    }

    // Pattern: "20:00", "20.00", "2000"
    const timeMatch = cleaned.match(/(\d{1,2})[:.]?(\d{2})?/);
    if (timeMatch) {
        const hours = parseInt(timeMatch[1]);
        const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
        return { hours, minutes };
    }

    return null;
}

async function sendLeaveRequestToAdminChannel(params: {
    interaction: ModalSubmitInteraction;
    requestsChannelId?: string | null;
    requestId: string;
    member: { name: string; discordId?: string | null };
    type: 'FULL' | 'LATE';
    startDate: Date;
    endDate: Date;
    reason: string;
}) {
    if (!params.requestsChannelId) {
        return;
    }

    const adminChannel = params.interaction.guild?.channels.cache.get(params.requestsChannelId) as TextChannel;
    if (!adminChannel) {
        return;
    }

    const adminEmbed = new EmbedBuilder(buildLeaveRequestDiscordEmbed({
        type: params.type,
        startDate: params.startDate,
        endDate: params.endDate,
        reason: params.reason,
        memberName: params.member.name,
        memberDiscordId: params.member.discordId,
        thumbnailUrl: params.interaction.user.displayAvatarURL(),
        requestedAt: new Date(),
    }));

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`leave_approve_${params.requestId}`)
                .setLabel('✅ อนุมัติ')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`leave_reject_${params.requestId}`)
                .setLabel('❌ ปฏิเสธ')
                .setStyle(ButtonStyle.Danger)
        );

    const sentMessage = await adminChannel.send({ content: '@here มีใบลาใหม่', embeds: [adminEmbed], components: [row] });

    await db.update(leaveRequests)
        .set({
            requestsChannelId: adminChannel.id,
            requestsMessageId: sentMessage.id,
        })
        .where(eq(leaveRequests.id, params.requestId));
}

// 3. Handle Modal Submit -> Save to DB
const handleLeaveSubmit = async (interaction: ModalSubmitInteraction, type: 'MULTI' | '1DAY' | 'LATE_PRESET' | 'LATE_CUSTOM') => {
    const discordId = interaction.user.id;
    const reasonRaw = interaction.fields.getTextInputValue('leave_reason').trim();

    try {
        await interaction.deferReply({ ephemeral: true });

        // Find Gang by guildId
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, interaction.guildId!)
        });

        if (!gang) {
            await interaction.editReply({ content: '❌ ไม่พบข้อมูลแก๊งในระบบ' });
            return;
        }

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gang.id),
                eq(members.discordId, discordId),
                eq(members.isActive, true)
            )
        });

        if (!member) {
            await interaction.editReply({ content: '❌ คุณไม่ได้เป็นสมาชิกของแก๊งนี้ในระบบ' });
            return;
        }

        // Calculate dates
        let startDate = new Date();
        let endDate = new Date();
        let confirmText = '';
        let leaveType: 'FULL' | 'LATE' = 'FULL';

        if (type === 'MULTI' || type === '1DAY') {
            let days = 1;
            if (type === 'MULTI') {
                const daysInput = interaction.fields.getTextInputValue('leave_days');
                days = parseInt(daysInput) || 1;
            }

            // Set start to beginning of today
            startDate.setHours(0, 0, 0, 0);

            // Calculate endDate: startDate + (days - 1)
            endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + (days - 1));
            endDate.setHours(23, 59, 59, 999);

            confirmText = `📅 **ลา ${days} วัน** (${startDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })} - ${endDate.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })})`;
            leaveType = 'FULL';
        } else if (type === 'LATE_PRESET') {
            const minutes = Number(interaction.customId.replace('leave_form_LATE_PRESET_', ''));
            if (!lateDelayOptions.includes(minutes as typeof lateDelayOptions[number])) {
                await interaction.editReply({ content: '❌ ตัวเลือกเวลาไม่ถูกต้อง' });
                return;
            }

            startDate = new Date(Date.now() + minutes * 60 * 1000);
            endDate = new Date(startDate);
            confirmText = `⏰ **ช้าประมาณ ${minutes} นาที** (คาดว่าเข้า ${startDate.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} น.)`;
            leaveType = 'LATE';
        } else {
            const timeInput = interaction.fields.getTextInputValue('late_time');
            const parsedTime = parseThaiTime(timeInput);

            if (!parsedTime) {
                await interaction.editReply({ content: '❌ ไม่เข้าใจเวลาที่ระบุ ลองพิมพ์ใหม่ เช่น 20:00 หรือ 3ทุ่ม' });
                return;
            }

            // Set startDate to today + expected arrival time
            startDate.setHours(parsedTime.hours, parsedTime.minutes, 0, 0);
            endDate = new Date(startDate); // Same timestamp for LATE

            const timeStr = `${String(parsedTime.hours).padStart(2, '0')}:${String(parsedTime.minutes).padStart(2, '0')}`;
            confirmText = `⏰ **จะเข้า ${timeStr} น.**`;
            leaveType = 'LATE';
        }

        const { createdRequest } = await createLeaveRequest(db, {
            gangId: gang.id,
            memberId: member.id,
            type: leaveType,
            startDate,
            endDate,
            reason: reasonRaw,
            actorDiscordId: interaction.user.id,
            actorName: interaction.user.displayName || interaction.user.username,
        });

        // --- Send Approval Request to Admin Channel ---
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gang.id),
            columns: { requestsChannelId: true }
        });

        await sendLeaveRequestToAdminChannel({
            interaction,
            requestsChannelId: settings?.requestsChannelId,
            requestId: createdRequest.id,
            member,
            type: leaveType,
            startDate,
            endDate,
            reason: createdRequest.reason,
        });

        const confirmEmbed = {
            title: leaveType === 'FULL' ? 'ส่งใบลาแล้ว' : 'แจ้งเข้าช้าแล้ว',
            description: `${confirmText} — ${createdRequest.reason}\nรออนุมัติ`,
            color: leaveType === 'FULL' ? 0xED4245 : 0xFEE75C,
        };

        await interaction.editReply({ embeds: [confirmEmbed] });

    } catch (error) {
        if (error instanceof CreateLeaveRequestError) {
            await interaction.editReply({ content: `❌ ${error.message}` });
            return;
        }

        logError('bot.leave.submit.failed', error, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            customId: interaction.customId,
            leaveFlowType: type,
        });
        await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการบันทึก' });
    }
};

registerModalHandler('leave_form_MULTI', i => handleLeaveSubmit(i, 'MULTI'));
registerModalHandler('leave_form_1DAY', i => handleLeaveSubmit(i, '1DAY'));
registerModalHandler('leave_form_LATE_PRESET_', i => handleLeaveSubmit(i, 'LATE_PRESET'));
registerModalHandler('leave_form_LATE_CUSTOM', i => handleLeaveSubmit(i, 'LATE_CUSTOM'));

// --- Approval Handlers ---
const handleLeaveAction = async (interaction: ButtonInteraction, action: 'APPROVED' | 'REJECTED') => {
    const prefix = action === 'APPROVED' ? 'leave_approve_' : 'leave_reject_';
    const requestId = interaction.customId.replace(prefix, '');

    try {
        // Permission Check — Only OWNER or ADMIN can approve/reject
        const leaveReq = await db.query.leaveRequests.findFirst({
            where: eq(leaveRequests.id, requestId),
        });

        if (!leaveReq) {
            await interaction.reply({ content: '❌ ไม่พบคำขอลา', ephemeral: true });
            return;
        }

        // Check if already processed (prevent double-confirm from bot + web)
        if (leaveReq.status !== 'PENDING') {
            const statusText = leaveReq.status === 'APPROVED' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธแล้ว';
            await interaction.reply({ content: `⚠️ คำขอลานี้ถูกดำเนินการไปแล้ว (${statusText})`, ephemeral: true });
            return;
        }

        const hasPermission = await checkPermission(interaction, leaveReq.gangId, ['OWNER', 'ADMIN']);
        if (!hasPermission) {
            await interaction.reply({ content: '❌ เฉพาะ Owner/Admin เท่านั้น', ephemeral: true });
            return;
        }

        // Disable buttons immediately to prevent double-click
        await interaction.update({ components: [] });

        const { leaveRequest, updatedRequest } = await reviewLeaveRequest(db, {
            gangId: leaveReq.gangId,
            requestId,
            status: action,
            reviewerDiscordId: interaction.user.id,
            reviewerName: interaction.user.displayName || interaction.user.username,
        });

        if (leaveRequest && leaveRequest.member?.discordId) {
            try {
                const user = await interaction.client.users.fetch(leaveRequest.member.discordId);
                const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, leaveRequest.gangId), columns: { name: true } });
                const gangName = gang?.name || '';
                if (action === 'APPROVED') {
                    await user.send(`✅ ใบลา **${gangName}** อนุมัติแล้ว`);
                } else {
                    await user.send(`❌ ใบลา **${gangName}** ถูกปฏิเสธ`);
                }
            } catch (dmError) {
                logWarn('bot.leave.review.dm_failed', {
                    requestId,
                    gangId: leaveRequest.gangId,
                    memberDiscordId: leaveRequest.member.discordId,
                    reviewerDiscordId: interaction.user.id,
                    action,
                    error: dmError,
                });
            }
        }

        // Update Message
        const newEmbed = new EmbedBuilder(buildLeaveReviewDiscordEmbed({
            type: leaveRequest.type,
            startDate: updatedRequest.startDate,
            endDate: updatedRequest.endDate,
            reason: updatedRequest.reason,
            memberName: leaveRequest.member?.name || 'Unknown',
            reviewerName: interaction.user.displayName || interaction.user.username,
            status: action,
        }));

        await interaction.editReply({ embeds: [newEmbed], components: [] });

    } catch (e) {
        if (e instanceof LeaveReviewError) {
            await interaction.followUp({ content: `❌ ${e.message}`, ephemeral: true });
            return;
        }

        logError('bot.leave.review.failed', e, {
            requestId,
            reviewerDiscordId: interaction.user.id,
            action,
        });
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true });
    }
};

registerButtonHandler('leave_approve', i => handleLeaveAction(i, 'APPROVED'));
registerButtonHandler('leave_reject', i => handleLeaveAction(i, 'REJECTED'));
