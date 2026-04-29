import {
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalSubmitInteraction,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
    Client
} from 'discord.js';
import { registerButtonHandler } from '../handlers/buttons';
import { registerModalHandler } from '../handlers/modals';
import { db, members, transactions, gangs, gangSettings, gangRoles } from '@gang/database';
import {
    checkFeatureEnabled,
    checkGangSubscriptionFeatureAccess,
    checkMemberSubscriptionFeatureAccess,
} from '../utils/featureGuard';
import { getGangMemberByDiscordId, hasPermissionLevel } from '../utils/permissions';
import { getMemberFinanceSnapshot } from '../utils/financeSnapshot';
import { thaiTimestamp } from '../utils/thaiTime';
import { logError, logWarn } from '../utils/logger';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

async function getGangIdFromGuildId(guildId: string | null | undefined) {
    if (!guildId) return null;
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
        columns: { id: true }
    });
    return gang?.id || null;
}

const FINANCE_FEATURE_LABEL = 'ระบบการเงิน';
const MISSING_APPROVED_MEMBER_MESSAGE = '❌ คุณยังไม่ได้ลงทะเบียนเป็นสมาชิกแก๊ง';
const MISSING_MEMBER_MESSAGE = '❌ ไม่พบข้อมูลสมาชิก';
const LOAN_REPAYMENT_LABEL = 'ชำระหนี้ยืมเข้ากองกลาง';
const COLLECTION_PAYMENT_LABEL = 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต';
const COLLECTION_PAYMENT_HINT = `ยอดเก็บเงินแก๊งใช้ปุ่ม "${COLLECTION_PAYMENT_LABEL}" ไม่ใช่ปุ่มชำระหนี้ยืม`;

function buildDisabledDecisionRow(transactionId: string) {
    return new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`fn_approve_${transactionId}`)
            .setLabel('อนุมัติ')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅')
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId(`fn_reject_${transactionId}`)
            .setLabel('ปฏิเสธ')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('❌')
            .setDisabled(true)
    );
}

async function markRequestMessageDone(
    interaction: ButtonInteraction,
    transactionId: string,
    status: 'APPROVED' | 'REJECTED'
) {
    try {
        const base = interaction.message.embeds?.[0];
        const embed = base ? EmbedBuilder.from(base) : new EmbedBuilder();

        const color = status === 'APPROVED' ? 0x57F287 : 0xED4245;
        const title = status === 'APPROVED' ? '✅ อนุมัติเรียบร้อย' : '❌ ปฏิเสธคำขอ';
        const footerText =
            status === 'APPROVED'
                ? `อนุมัติโดย ${interaction.user.username}`
                : `ปฏิเสธโดย ${interaction.user.username}`;

        embed
            .setColor(color)
            .setTitle(title)
            .setFooter({ text: `${footerText} • ${thaiTimestamp()}`, iconURL: interaction.user.displayAvatarURL() });

        await interaction.message.edit({
            embeds: [embed],
            // Match gang-join approval UX: remove buttons after decision
            components: [],
        });
    } catch (err) {
        logWarn('bot.finance.request_message_update.failed', {
            transactionId,
            status,
            actorDiscordId: interaction.user.id,
            messageId: interaction.message?.id,
            error: err,
        });
    }
}

// Helper: send notification to admin finance/requests channel
async function notifyAdminChannel(
    client: Client,
    gangId: string,
    embed: EmbedBuilder,
    targetPermission?: 'TREASURER' | 'ADMIN' | 'OWNER',
    transactionId?: string
) {
    try {
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
            columns: { requestsChannelId: true }
        });

        if (!settings?.requestsChannelId) return;

        const channel = await client.channels.fetch(settings.requestsChannelId);
        if (!channel || !channel.isTextBased()) return;

        // Find roles with target permission
        const roles = await db.query.gangRoles.findMany({
            where: and(
                eq(gangRoles.gangId, gangId),
                eq(gangRoles.permissionLevel, targetPermission || 'TREASURER')
            ),
            columns: { discordRoleId: true }
        });

        const mentions = roles.map(r => `<@&${r.discordRoleId}>`).join(' ');
        const content = `${mentions} มีรายการการเงินใหม่`;

        const components: any[] = [];
        if (transactionId) {
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`fn_approve_${transactionId}`)
                    .setLabel('อนุมัติ')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId(`fn_reject_${transactionId}`)
                    .setLabel('ปฏิเสธ')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
            components.push(row);
        }

        await (channel as TextChannel).send({
            content,
            embeds: [embed],
            components
        });
    } catch (err) {
        logWarn('bot.finance.notify_admin_channel.failed', {
            gangId,
            targetPermission: targetPermission || 'TREASURER',
            transactionId,
            error: err,
        });
    }
}

// ==================== HANDLERS ====================

// 1. Handle "Loan" Button -> Open Modal
registerButtonHandler('finance_request_loan', async (interaction: ButtonInteraction) => {
    // Global feature flag check
    if (!await checkFeatureEnabled(interaction, 'finance', FINANCE_FEATURE_LABEL)) return;

    const loanAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            requireApprovedMember: true,
        }
    );
    if (!loanAccess.allowed) return;

    /*
    const adminIncomeAccess = await checkGangSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        'finance',
        FINANCE_FEATURE_LABEL
    );
    if (!adminIncomeAccess.allowed) return;
    */

    const modal = new ModalBuilder()
        .setCustomId('finance_loan_modal')
        .setTitle('💸 ขอเบิก/ยืมเงิน');

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('จำนวนเงิน')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ตัวเลขเท่านั้น เช่น 5000')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    modal.addComponents(row1);
    await interaction.showModal(modal);
});

// 2. Handle "Repay" Button -> Show Options (Full vs Custom)
registerButtonHandler('finance_request_repay', async (interaction: ButtonInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    // Global feature flag check
    if (!await checkFeatureEnabled(interaction, 'finance', FINANCE_FEATURE_LABEL, { alreadyDeferred: true })) return;

    const repayAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            requireApprovedMember: true,
        }
    );
    if (!repayAccess.allowed || !repayAccess.member || !repayAccess.gang) return;

    const { loanDebt, collectionDue } = await getMemberFinanceSnapshot(repayAccess.gang.id, repayAccess.member.id);
    const currentDebt = loanDebt;

    if (currentDebt === 0) {
        await interaction.editReply(
            collectionDue > 0
                ? `✅ คุณไม่มีหนี้ยืมค้างชำระ หากต้องการชำระยอดเก็บเงินแก๊งค้างอยู่ ฿${collectionDue.toLocaleString()} ให้ใช้ปุ่ม ${COLLECTION_PAYMENT_LABEL}`
                : '✅ คุณไม่มีหนี้ยืมที่ต้องชำระ'
        );
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle(LOAN_REPAYMENT_LABEL)
        .setDescription(
            collectionDue > 0
                ? `หนี้ยืมคงค้าง: **฿${currentDebt.toLocaleString()}**\nค้างเก็บเงินแก๊ง: **฿${collectionDue.toLocaleString()}**\n\nหมายเหตุ: ${COLLECTION_PAYMENT_HINT}`
                : `หนี้ยืมคงค้าง: **฿${currentDebt.toLocaleString()}**`
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('finance_repay_full')
            .setLabel(`ชำระหนี้ยืมเต็มจำนวน (฿${currentDebt.toLocaleString()})`)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('finance_repay_custom')
            .setLabel('ระบุยอดหนี้ยืมเอง')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
});

// 2.1 Handle "Repay Full"
registerButtonHandler('finance_repay_full', async (interaction: ButtonInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const repayFullAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            requireApprovedMember: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!repayFullAccess.allowed) return;

    const discordId = interaction.user.id;
    const gangId = await getGangIdFromGuildId(interaction.guildId);
    if (!gangId) {
        await interaction.editReply('❌ ไม่พบแก๊งที่ผูกกับเซิร์ฟเวอร์นี้');
        return;
    }

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        )
    });

    if (!member) return;

    // Double check pending
    const existingPending = await db.query.transactions.findFirst({
        where: and(
            eq(transactions.memberId, member.id),
            eq(transactions.status, 'PENDING'),
            eq(transactions.type, 'REPAYMENT')
        )
    });

    if (existingPending) {
        await interaction.editReply('❌ มีรายการชำระหนี้ยืมรอตรวจสอบอยู่');
        return;
    }

    const { loanDebt, collectionDue } = await getMemberFinanceSnapshot(member.gangId, member.id);
    const amount = loanDebt;
    if (amount === 0) {
        await interaction.editReply(
            collectionDue > 0
                ? `✅ คุณไม่มีหนี้ยืมแล้ว หากต้องการชำระยอดเก็บเงินแก๊งค้างอยู่ ฿${collectionDue.toLocaleString()} ให้ใช้ปุ่ม ${COLLECTION_PAYMENT_LABEL}`
                : '✅ คุณไม่มีหนี้ยืมแล้ว'
        );
        return;
    }

    // Fetch gang balance for accurate snapshot
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, member.gangId),
        columns: { balance: true }
    });

    const gangBalance = gang?.balance || 0;

    const transactionId = nanoid();

    // Insert PENDING Transaction
    await db.insert(transactions).values({
        id: transactionId,
        gangId: member.gangId,
        type: 'REPAYMENT',
        amount: amount,
        description: LOAN_REPAYMENT_LABEL,
        memberId: member.id,
        status: 'PENDING',
        createdById: member.id,
        createdAt: new Date(),
        balanceBefore: gangBalance,
        balanceAfter: gangBalance + amount,
    });

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('ส่งคำขอชำระหนี้ยืมแล้ว')
        .setDescription(`จำนวน: **฿${amount.toLocaleString()}** (ชำระหนี้ยืมเต็มจำนวน) — รอตรวจสอบ`)
        .setFooter({ text: thaiTimestamp() });

    await interaction.editReply({ embeds: [embed] });

    // Notify admin channel
    const adminEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('แจ้งชำระหนี้ยืม')
        .setDescription(`**${member.name || 'สมาชิก'}** (<@${discordId}>) ชำระหนี้ยืม **฿${amount.toLocaleString()}** (เต็มจำนวน)`)
        .setFooter({ text: thaiTimestamp() });
    await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);
});

// 2.2 Handle "Custom Repay" -> Open Modal
registerButtonHandler('finance_repay_custom', async (interaction: ButtonInteraction) => {
    const repayCustomAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            requireApprovedMember: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!repayCustomAccess.allowed) return;

    const modal = new ModalBuilder()
        .setCustomId('finance_repay_modal')
        .setTitle(`🏦 ${LOAN_REPAYMENT_LABEL}`);

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('ยอดชำระหนี้ยืม')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ตัวเลขเท่านั้น เช่น 5000')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    modal.addComponents(row1);
    await interaction.showModal(modal);
});

// 2.3 Handle "Deposit" Button -> Open Modal
registerButtonHandler('finance_request_deposit', async (interaction: ButtonInteraction) => {
    const depositAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            requireApprovedMember: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!depositAccess.allowed) return;

    const modal = new ModalBuilder()
        .setCustomId('finance_deposit_modal')
        .setTitle(`📥 ${COLLECTION_PAYMENT_LABEL}`);

    const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('ยอดชำระ/ฝากเครดิต')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('ตัวเลขเท่านั้น เช่น 5000')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    modal.addComponents(row1);
    await interaction.showModal(modal);
});

// 3. Handle Loan Modal Submit
registerModalHandler('finance_loan_modal', async (interaction: ModalSubmitInteraction) => {
    const amountStr = interaction.fields.getTextInputValue('amount').replace(/,/g, '').trim();
    const amount = /^\d+$/.test(amountStr) ? Number(amountStr) : NaN;

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.reply({ content: '❌ ระบุจำนวนเงินเป็นจำนวนเต็ม (1 - 100,000,000)', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const loanModalAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            requireApprovedMember: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!loanModalAccess.allowed) return;

    try {
        const gangId = await getGangIdFromGuildId(interaction.guildId);
        if (!gangId) {
            await interaction.editReply('❌ ไม่พบแก๊งที่ผูกกับเซิร์ฟเวอร์นี้');
            return;
        }

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, interaction.user.id),
                eq(members.isActive, true)
            ),
            with: { gang: true }
        });

        if (!member || !member.gangId) {
            await interaction.editReply('❌ ไม่พบข้อมูลสมาชิก');
            return;
        }

        const gang = member.gang;
        const currentBalance = gang.balance || 0;

        if (currentBalance < amount) {
            await interaction.editReply(`❌ กองกลางไม่พอ (คงเหลือ: ฿${currentBalance.toLocaleString()})`);
            return;
        }

        const transactionId = nanoid();
        await db.insert(transactions).values({
            id: transactionId,
            gangId: member.gangId,
            type: 'LOAN',
            amount,
            description: 'เบิก/ยืมเงิน',
            memberId: member.id,
            status: 'PENDING',
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: currentBalance,
            balanceAfter: currentBalance - amount,
        });

        const adminEmbed = new EmbedBuilder()
            .setTitle('คำขอเบิก/ยืมเงิน')
            .setColor(0xFEE75C)
            .setDescription(`**${member.name}** (<@${member.discordId}>) ขอเบิก **฿${amount.toLocaleString()}** (กองกลาง: ฿${currentBalance.toLocaleString()})`)
            .setFooter({ text: thaiTimestamp() });

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);

        await interaction.editReply(`✅ ส่งคำขอเบิก **฿${amount.toLocaleString()}** แล้ว — รออนุมัติ`);
    } catch (err) {
        logError('bot.finance.withdraw_request.failed', err, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            customId: interaction.customId,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการทำรายการ');
    }
});

// 4. Handle Repay Modal Submit
registerModalHandler('finance_repay_modal', async (interaction: ModalSubmitInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const repayModalAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            requireApprovedMember: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!repayModalAccess.allowed) return;

    const discordId = interaction.user.id;
    const amountStr = interaction.fields.getTextInputValue('amount').replace(/,/g, '').trim();
    const amount = /^\d+$/.test(amountStr) ? Number(amountStr) : NaN;

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.editReply('❌ ระบุจำนวนเงินเป็นจำนวนเต็ม (1 - 100,000,000)');
        return;
    }

    try {
        const gangId = await getGangIdFromGuildId(interaction.guildId);
        if (!gangId) {
            await interaction.editReply('❌ ไม่พบแก๊งที่ผูกกับเซิร์ฟเวอร์นี้');
            return;
        }

        // Find Member
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            with: { gang: true }
        });

        if (!member) {
            await interaction.editReply('❌ ไม่พบข้อมูลสมาชิก');
            return;
        }

        const { loanDebt, collectionDue } = await getMemberFinanceSnapshot(member.gangId, member.id);
        const currentDebt = loanDebt;

        if (currentDebt === 0) {
            await interaction.editReply(
                collectionDue > 0
                    ? `✅ ไม่มีหนี้ยืมค้างชำระ หากต้องการชำระยอดเก็บเงินแก๊งค้างอยู่ ฿${collectionDue.toLocaleString()} ให้ใช้ปุ่ม ${COLLECTION_PAYMENT_LABEL}`
                    : '✅ ไม่มีหนี้ยืมค้างชำระ'
            );
            return;
        }

        if (amount > currentDebt) {
            await interaction.editReply(`❌ ยอดชำระเกินจำนวนหนี้ยืม (สูงสุด: ฿${currentDebt.toLocaleString()})`);
            return;
        }

        // Check for existing PENDING inflow request
        const existingPending = await db.query.transactions.findFirst({
            where: (t, { and, eq, or }) => and(
                eq(t.memberId, member.id),
                eq(t.status, 'PENDING'),
                or(eq(t.type, 'REPAYMENT'), eq(t.type, 'DEPOSIT'))
            )
        });

        if (existingPending) {
            await interaction.editReply('❌ มีรายการรอตรวจสอบอยู่');
            return;
        }

        // Get actual gang balance for accurate snapshot
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, member.gangId),
            columns: { balance: true }
        });
        const gangBalance = gang?.balance || 0;

        const type = 'REPAYMENT';
        const description = LOAN_REPAYMENT_LABEL;

        // Single Transaction: We use one transaction to cover the amount.
        // The backend logic for approval already updates balances correctly.
        const transactionId = nanoid();
        await db.insert(transactions).values({
            id: transactionId,
            gangId: member.gangId,
            type: type,
            amount: amount,
            description,
            memberId: member.id,
            status: 'PENDING',
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: gangBalance,
            balanceAfter: gangBalance + amount,
        });

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('ส่งคำขอชำระหนี้ยืมแล้ว')
            .setDescription(`จำนวน: **฿${amount.toLocaleString()}** — รอตรวจสอบ`)
            .setFooter({ text: thaiTimestamp() });

        await interaction.editReply({ embeds: [embed] });

        // Notify Admin
        const adminEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('แจ้งชำระหนี้ยืม')
            .setDescription(`**${member.name}** (<@${discordId}>) ชำระหนี้ยืม **฿${amount.toLocaleString()}**`)
            .setFooter({ text: thaiTimestamp() });

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);

    } catch (error) {
        logError('bot.finance.inflow_request.failed', error, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            customId: interaction.customId,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 5. Handle Deposit Modal Submit
registerModalHandler('finance_deposit_modal', async (interaction: ModalSubmitInteraction) => {
    const amountStr = interaction.fields.getTextInputValue('amount').replace(/,/g, '').trim();
    const amount = /^\d+$/.test(amountStr) ? Number(amountStr) : NaN;

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.reply({ content: '❌ ระบุจำนวนเงินเป็นจำนวนเต็ม (1 - 100,000,000)', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const depositModalAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            requireApprovedMember: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!depositModalAccess.allowed) return;

    try {
        const gangId = await getGangIdFromGuildId(interaction.guildId);
        if (!gangId) {
            await interaction.editReply('❌ ไม่พบแก๊ง');
            return;
        }

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, interaction.user.id),
                eq(members.isActive, true)
            ),
            with: { gang: true }
        });

        if (!member || !member.gangId) {
            await interaction.editReply('❌ ไม่พบข้อมูลสมาชิก');
            return;
        }

        // Check if there is already a PENDING inflow for this user to prevent confusion
        const pending = await db.query.transactions.findFirst({
            where: and(
                eq(transactions.gangId, member.gangId),
                eq(transactions.memberId, member.id),
                eq(transactions.status, 'PENDING'),
                sql`${transactions.type} IN ('REPAYMENT', 'DEPOSIT')`
            )
        });

        if (pending) {
            await interaction.editReply('❌ มีรายการรออนุมัติอยู่');
            return;
        }

        const gangBalance = member.gang.balance || 0;
        const transactionType = 'DEPOSIT';

        const transactionId = nanoid();
        await db.insert(transactions).values({
            id: transactionId,
            gangId: member.gangId,
            type: transactionType,
            amount,
            description: COLLECTION_PAYMENT_LABEL,
            memberId: member.id,
            status: 'PENDING',
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: gangBalance,
            balanceAfter: gangBalance + amount,
        });

        const adminEmbed = new EmbedBuilder()
            .setTitle(`แจ้ง${COLLECTION_PAYMENT_LABEL}`)
            .setColor(0x5865F2)
            .setDescription(`**${member.name}** (<@${member.discordId}>) ${COLLECTION_PAYMENT_LABEL} **฿${amount.toLocaleString()}** (กองกลาง: ฿${gangBalance.toLocaleString()})`)
            .setFooter({ text: thaiTimestamp() });

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);

        await interaction.editReply(`✅ แจ้ง${COLLECTION_PAYMENT_LABEL} **฿${amount.toLocaleString()}** แล้ว — รอตรวจสอบ`);
    } catch (err) {
        logError('bot.finance.deposit_request.failed', err, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            customId: interaction.customId,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 6. Handle Direct Approval/Rejection from Discord
registerButtonHandler('fn_approve_', async (interaction: ButtonInteraction) => {
    const transactionId = interaction.customId.replace('fn_approve_', '');
    await interaction.deferReply({ ephemeral: true });

    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, interaction.guildId!),
            columns: { id: true }
        });

        if (!gang?.id) {
            await interaction.editReply('❌ ไม่พบแก๊งที่ผูกกับเซิร์ฟเวอร์นี้');
            return;
        }

        const member = await getGangMemberByDiscordId(gang.id, interaction.user.id);

        if (!member || !hasPermissionLevel(member.gangRole, ['TREASURER'])) {
            await interaction.editReply('❌ เฉพาะ Owner/Treasurer เท่านั้น');
            return;
        }

        const financeAccess = await checkGangSubscriptionFeatureAccess(
            interaction,
            interaction.guildId,
            'finance',
            FINANCE_FEATURE_LABEL,
            {
                alreadyDeferred: true,
            }
        );
        if (!financeAccess.allowed) return;

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });

        if (!transaction) {
            await interaction.editReply('❌ ไม่พบรายการนี้ หรือรายการนี้ถูกลบไปแล้ว');
            return;
        }

        if (transaction.status !== 'PENDING') {
            await markRequestMessageDone(interaction, transactionId, transaction.status as any);
            await interaction.editReply('ℹ️ รายการนี้ถูกดำเนินการไปแล้ว (อัปเดตสถานะให้แล้ว)');
            return;
        }

        // Use the centralized service
        const { FinanceService } = await import('@gang/database');
        await FinanceService.approveTransaction(db, {
            transactionId,
            actorId: member.id,
            actorName: member.name
        });

        await markRequestMessageDone(interaction, transactionId, 'APPROVED');

        await interaction.deleteReply().catch(() => {});
    } catch (err: any) {
        logError('bot.finance.approval.failed', err, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            transactionId,
        });
        await interaction.editReply(`❌ ผิดพลาด: ${err.message}`);
    }
});

registerButtonHandler('fn_reject_', async (interaction: ButtonInteraction) => {
    const transactionId = interaction.customId.replace('fn_reject_', '');
    await interaction.deferReply({ ephemeral: true });

    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.discordGuildId, interaction.guildId!),
            columns: { id: true }
        });

        if (!gang?.id) {
            await interaction.editReply('❌ ไม่พบแก๊งที่ผูกกับเซิร์ฟเวอร์นี้');
            return;
        }

        const approver = await getGangMemberByDiscordId(gang.id, interaction.user.id);

        if (!approver || !hasPermissionLevel(approver.gangRole, ['TREASURER'])) {
            await interaction.editReply('❌ เฉพาะ Owner/Treasurer เท่านั้น');
            return;
        }

        const existing = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
            columns: { status: true }
        });

        if (!existing) {
            await interaction.editReply('❌ ไม่พบรายการนี้ หรือรายการนี้ถูกลบไปแล้ว');
            return;
        }

        if (existing.status !== 'PENDING') {
            await markRequestMessageDone(interaction, transactionId, existing.status as any);
            await interaction.editReply('ℹ️ รายการนี้ถูกดำเนินการไปแล้ว (อัปเดตสถานะให้แล้ว)');
            return;
        }

        const result = await db.update(transactions)
            .set({
                status: 'REJECTED',
                approvedById: approver?.id || interaction.user.id,
                approvedAt: new Date()
            })
            .where(and(eq(transactions.id, transactionId), eq(transactions.status, 'PENDING')));

        if (result.rowsAffected === 0) {
            await interaction.editReply('❌ รายการนี้อาจถูกลบหรือดำเนินการไปแล้ว');
            return;
        }

        await markRequestMessageDone(interaction, transactionId, 'REJECTED');

        await interaction.deleteReply().catch(() => {});
    } catch (err) {
        logError('bot.finance.rejection.failed', err, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            transactionId,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาด');
    }
});

// ==================== ADMIN: INCOME / EXPENSE BUTTONS ====================

registerButtonHandler('admin_income', async (interaction: ButtonInteraction) => {
    if (!await checkFeatureEnabled(interaction, 'finance', FINANCE_FEATURE_LABEL)) return;
    const adminIncomeAccess = await checkGangSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        'finance',
        FINANCE_FEATURE_LABEL
    );
    if (!adminIncomeAccess.allowed) return;

    const modal = new ModalBuilder()
        .setCustomId('admin_income_modal')
        .setTitle('💰 บันทึกรายรับ');
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('amount').setLabel('จำนวนเงิน').setStyle(TextInputStyle.Short).setPlaceholder('เช่น 5000').setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('description').setLabel('รายละเอียด').setStyle(TextInputStyle.Short).setPlaceholder('เช่น ค่าสมาชิกประจำเดือน').setRequired(true)
        ),
    );
    await interaction.showModal(modal);
});

registerButtonHandler('admin_expense', async (interaction: ButtonInteraction) => {
    if (!await checkFeatureEnabled(interaction, 'finance', FINANCE_FEATURE_LABEL)) return;
    const adminExpenseAccess = await checkGangSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        'finance',
        FINANCE_FEATURE_LABEL
    );
    if (!adminExpenseAccess.allowed) return;

    const modal = new ModalBuilder()
        .setCustomId('admin_expense_modal')
        .setTitle('💸 บันทึกรายจ่าย');
    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('amount').setLabel('จำนวนเงิน').setStyle(TextInputStyle.Short).setPlaceholder('เช่น 3000').setRequired(true)
        ),
        new ActionRowBuilder<TextInputBuilder>().addComponents(
            new TextInputBuilder().setCustomId('description').setLabel('รายละเอียด').setStyle(TextInputStyle.Short).setPlaceholder('เช่น ค่าอุปกรณ์').setRequired(true)
        ),
    );
    await interaction.showModal(modal);
});

async function handleAdminFinanceModal(interaction: ModalSubmitInteraction, type: 'INCOME' | 'EXPENSE') {
    await interaction.deferReply({ ephemeral: true });

    if (!await checkFeatureEnabled(interaction, 'finance', FINANCE_FEATURE_LABEL, { alreadyDeferred: true })) return;

    const adminFinanceAccess = await checkGangSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
        }
    );
    if (!adminFinanceAccess.allowed) return;

    const amountStr = interaction.fields.getTextInputValue('amount').replace(/,/g, '').trim();
    const amount = /^\d+$/.test(amountStr) ? Number(amountStr) : NaN;
    const description = interaction.fields.getTextInputValue('description');

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.editReply('❌ จำนวนเงินไม่ถูกต้อง');
        return;
    }

    /*
    const balanceAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            missingMemberMessage: MISSING_MEMBER_MESSAGE,
        }
    );
    if (!balanceAccess.allowed) return;
    */

    const guildId = interaction.guildId;
    if (!guildId) { await interaction.editReply('❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์'); return; }

    try {
        const gang = await db.query.gangs.findFirst({ where: eq(gangs.discordGuildId, guildId) });
        if (!gang) { await interaction.editReply('❌ ไม่พบข้อมูลแก๊ง'); return; }

        // Permission check: OWNER or TREASURER
        const member = await getGangMemberByDiscordId(gang.id, interaction.user.id);
        if (!member) { await interaction.editReply('❌ ไม่พบข้อมูลสมาชิก'); return; }
        if (!hasPermissionLevel(member.gangRole, ['TREASURER'])) {
            await interaction.editReply('❌ เฉพาะ Owner/Treasurer เท่านั้น');
            return;
        }

        const { FinanceService } = await import('@gang/database');
        const { newGangBalance } = await FinanceService.createTransaction(db, {
            gangId: gang.id, type, amount, description,
            memberId: null, actorId: member.id, actorName: member.name,
        });

        const color = type === 'INCOME' ? 0x57F287 : 0xED4245;
        const title = type === 'INCOME' ? '💰 รายรับ' : '💸 รายจ่าย';
        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .addFields(
                { name: 'จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: 'รายการ', value: description, inline: true },
                { name: 'คงเหลือ', value: `฿${newGangBalance.toLocaleString()}`, inline: true },
            )
            .setFooter({ text: `${member.name} • ${thaiTimestamp()}` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error: any) {
        if (error.message?.includes('INSUFFICIENT') || error.message?.includes('Insufficient')) {
            await interaction.editReply('❌ เงินกองกลางไม่เพียงพอ');
            return;
        }
        logError('bot.finance.admin_modal.failed', error, {
            guildId: interaction.guildId,
            actorDiscordId: interaction.user.id,
            type,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาด');
    }
}

registerModalHandler('admin_income_modal', async (interaction: ModalSubmitInteraction) => {
    await handleAdminFinanceModal(interaction, 'INCOME');
});

registerModalHandler('admin_expense_modal', async (interaction: ModalSubmitInteraction) => {
    await handleAdminFinanceModal(interaction, 'EXPENSE');
});

// ==================== BALANCE CHECK BUTTON ====================

registerButtonHandler('finance_balance', async (interaction: ButtonInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const memberFinanceAccess = await checkMemberSubscriptionFeatureAccess(
        interaction,
        interaction.guildId,
        interaction.user.id,
        'finance',
        FINANCE_FEATURE_LABEL,
        {
            alreadyDeferred: true,
            requireApprovedMember: true,
        }
    );
    if (!memberFinanceAccess.allowed) return;

    const guildId = interaction.guildId;
    if (!guildId) { await interaction.editReply('❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์'); return; }

    const gang = await db.query.gangs.findFirst({ where: eq(gangs.discordGuildId, guildId) });
    if (!gang) { await interaction.editReply('❌ ไม่พบข้อมูลแก๊ง'); return; }

    const member = await db.query.members.findFirst({
        where: and(eq(members.gangId, gang.id), eq(members.discordId, interaction.user.id), eq(members.isActive, true)),
    });
    if (!member) { await interaction.editReply('❌ คุณยังไม่ได้เป็นสมาชิก'); return; }

    const { loanDebt, collectionDue } = await getMemberFinanceSnapshot(gang.id, member.id);
    const availableCredit = Math.max(0, Number(member.balance) || 0);
    const gangBalance = gang.balance || 0;

    const embed = new EmbedBuilder()
        .setColor(loanDebt > 0 || collectionDue > 0 ? 0xED4245 : 0x57F287)
        .setTitle(`💳 สถานะการเงิน`)
        .setDescription(`หนี้ยืมและยอดเก็บเงินแก๊งเป็นคนละยอด: ใช้ "${LOAN_REPAYMENT_LABEL}" สำหรับหนี้ยืม และ "${COLLECTION_PAYMENT_LABEL}" สำหรับยอดเก็บเงินแก๊ง/เครดิต`)
        .addFields(
            { name: '🏦 กองกลาง', value: `฿${gangBalance.toLocaleString()}`, inline: true },
            { name: '💸 หนี้ยืมคงค้าง', value: `฿${loanDebt.toLocaleString()}`, inline: true },
            { name: '🪙 ค้างเก็บเงินแก๊ง', value: `฿${collectionDue.toLocaleString()}`, inline: true },
            { name: '🤝 เครดิต/สำรองจ่าย', value: `฿${availableCredit.toLocaleString()}`, inline: true },
        )
        .setFooter({ text: `${member.name} • ${thaiTimestamp()}` });

    await interaction.editReply({ embeds: [embed] });
});
