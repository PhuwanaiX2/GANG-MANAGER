import { ButtonInteraction, ModalSubmitInteraction, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, TextChannel, ButtonBuilder, ButtonStyle, EmbedBuilder, ComponentType } from 'discord.js';
import { db, leaveRequests, members, gangs, gangSettings } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { registerButtonHandler, registerModalHandler } from '../handlers';
import { createAuditLog } from '../utils/auditLog';
import { thaiTimestamp } from '../utils/thaiTime';
import { checkFeatureEnabled } from '../utils/featureGuard';
import { checkPermission } from '../utils/permissions';

// Leave handling logic is here. Command registration is handled in commands/setupLeave.ts

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
        .setRequired(true);

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
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput)
    );

    await interaction.showModal(modal);
});

// 2. Handle "Leave Late" button -> Show Modal (2 fields: Time + Reason)
registerButtonHandler('request_leave_late', async (interaction: ButtonInteraction) => {
    const modal = new ModalBuilder()
        .setCustomId('leave_form_LATE')
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
        .setLabel('เหตุผล')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('ระบุเหตุผลที่เข้าช้า...')
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
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

// 3. Handle Modal Submit -> Save to DB
const handleLeaveSubmit = async (interaction: ModalSubmitInteraction, type: 'MULTI' | '1DAY' | 'LATE') => {
    const discordId = interaction.user.id;
    const reasonRaw = interaction.fields.getTextInputValue('leave_reason');

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
        } else {
            // LATE: Parse the expected arrival time
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
        }

        // Check for overlapping requests
        const existingLeaves = await db.query.leaveRequests.findMany({
            where: and(
                eq(leaveRequests.memberId, member.id),
                eq(leaveRequests.gangId, gang.id),
                // Check if status is PENDING or APPROVED
                // We'll filter status in code if needed, but easier to fetch active ones
            )
        });

        const hasOverlap = existingLeaves.some(leave => {
            if (leave.status === 'REJECTED' || leave.status === 'CANCELLED') return false;

            const leaveStart = new Date(leave.startDate);
            const leaveEnd = new Date(leave.endDate);

            // Check overlap: (Start1 <= End2) and (Start2 <= End1)
            return startDate <= leaveEnd && endDate >= leaveStart;
        });

        if (hasOverlap) {
            await interaction.editReply({ content: '❌ มีรายการลาช่วงนี้อยู่แล้ว' });
            return;
        }

        const leafId = nanoid();
        await db.insert(leaveRequests).values({
            id: leafId,
            memberId: member.id,
            gangId: gang.id,
            type: (type === 'MULTI' || type === '1DAY') ? 'FULL' : 'LATE',
            startDate,
            endDate,
            reason: reasonRaw,
            status: 'PENDING',
        });

        // --- Send Approval Request to Admin Channel ---
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gang.id),
            columns: { requestsChannelId: true }
        });

        if (settings?.requestsChannelId) {
            const adminChannel = interaction.guild?.channels.cache.get(settings.requestsChannelId) as TextChannel;
            if (adminChannel) {
                const adminEmbed = new EmbedBuilder()
                    .setTitle(type === 'MULTI' || type === '1DAY' ? 'แจ้งลาหยุด' : 'แจ้งเข้าช้า')
                    .setDescription(`**${member.name}** (<@${member.discordId}>)\n${confirmText.replace(/\*\*/g, '')}\nเหตุผล: ${reasonRaw}`)
                    .setColor(type === 'MULTI' || type === '1DAY' ? 0xED4245 : 0xFEE75C)
                    .setThumbnail(interaction.user.displayAvatarURL())
                    .setFooter({ text: thaiTimestamp() });

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`leave_approve_${leafId}`)
                            .setLabel('✅ อนุมัติ')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`leave_reject_${leafId}`)
                            .setLabel('❌ ปฏิเสธ')
                            .setStyle(ButtonStyle.Danger)
                    );

                await adminChannel.send({ content: '@here มีใบลาใหม่', embeds: [adminEmbed], components: [row] });
            }
        }

        const confirmEmbed = {
            title: (type === 'MULTI' || type === '1DAY') ? 'ส่งใบลาแล้ว' : 'แจ้งเข้าช้าแล้ว',
            description: `${confirmText} — ${reasonRaw}\nรออนุมัติ`,
            color: (type === 'MULTI' || type === '1DAY') ? 0xED4245 : 0xFEE75C,
        };

        await interaction.editReply({ embeds: [confirmEmbed] });

    } catch (error) {
        console.error('Leave submit error:', error);
        await interaction.editReply({ content: '❌ เกิดข้อผิดพลาดในการบันทึก' });
    }
};

registerModalHandler('leave_form_MULTI', i => handleLeaveSubmit(i, 'MULTI'));
registerModalHandler('leave_form_1DAY', i => handleLeaveSubmit(i, '1DAY'));
registerModalHandler('leave_form_LATE', i => handleLeaveSubmit(i, 'LATE'));

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

        // Update DB
        await db.update(leaveRequests)
            .set({ status: action, reviewedAt: new Date(), reviewedById: interaction.user.id }) // user.id here is discordId, schema expects memberId? Schema says reviewedById is text, likely memberId.
            // Let's resolve memberId from discordId again or just store discordId?
            // Schema: reviewedById text. Let's try to find the member first.
            .where(eq(leaveRequests.id, requestId));

        // Notify User
        const leaveRequest = await db.query.leaveRequests.findFirst({
            where: eq(leaveRequests.id, requestId),
            with: { member: true }
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
                console.error('Could not DM user:', dmError);
            }
        }

        // Update Message
        const oldEmbed = interaction.message.embeds[0];
        const newEmbed = new EmbedBuilder(oldEmbed.data)
            .setColor(action === 'APPROVED' ? 0x57F287 : 0xED4245)
            .setFooter({ text: `${action === 'APPROVED' ? '✅ อนุมัติ' : '❌ ปฏิเสธ'} โดย ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.editReply({ embeds: [newEmbed], components: [] });

    } catch (e) {
        console.error('Leave Action Error:', e);
        await interaction.followUp({ content: '❌ เกิดข้อผิดพลาด', ephemeral: true });
    }
};

registerButtonHandler('leave_approve', i => handleLeaveAction(i, 'APPROVED'));
registerButtonHandler('leave_reject', i => handleLeaveAction(i, 'REJECTED'));
