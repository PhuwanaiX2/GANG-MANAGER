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
import { db, members, transactions, gangs, gangSettings, gangRoles, canAccessFeature } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';

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
        const content = `${mentions} มีรายการการเงินใหม่ที่รอการตรวจสอบ`;

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
        console.error('Failed to notify admin channel:', err);
    }
}

// ==================== HANDLERS ====================

// 1. Handle "Loan" Button -> Open Modal
registerButtonHandler('finance_request_loan', async (interaction: ButtonInteraction) => {
    const modal = new ModalBuilder()
        .setCustomId('finance_loan_modal')
        .setTitle('💸 ขอเบิก/ยืมเงิน');

    // Check Tier Access
    const member = await db.query.members.findFirst({
        where: and(eq(members.discordId, interaction.user.id), eq(members.isActive, true)),
        with: { gang: true }
    });

    if (!member || !member.gang) {
        await interaction.reply({ content: '❌ ไม่พบข้อมูลสมาชิกหรือแก๊ง', ephemeral: true });
        return;
    }

    if (!canAccessFeature(member.gang.subscriptionTier, 'finance')) {
        await interaction.reply({
            content: `❌ **แพลนปัจจุบัน (${member.gang.subscriptionTier}) ไม่รองรับระบบการเงิน**\nกรุณาแจ้งหัวหน้าแก๊งให้อัปเกรดแพลน`,
            ephemeral: true
        });
        return;
    }

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

    const discordId = interaction.user.id;

    // Find Member
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.discordId, discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        with: { gang: true }
    });

    if (!member) {
        await interaction.editReply('❌ คุณยังไม่ได้ลงทะเบียนเป็นสมาชิกแก๊ง');
        return;
    }

    if (!canAccessFeature(member.gang.subscriptionTier, 'finance')) {
        await interaction.editReply(`❌ **แพลนปัจจุบัน (${member.gang.subscriptionTier}) ไม่รองรับระบบการเงิน**\nกรุณาแจ้งหัวหน้าแก๊งให้อัปเกรดแพลน`);
        return;
    }

    const currentDebt = Math.abs(member.balance < 0 ? member.balance : 0);

    if (currentDebt === 0) {
        await interaction.editReply('✅ คุณไม่มีหนี้สินที่ต้องชำระ');
        return;
    }

    const embed = new EmbedBuilder()
        .setColor('#FFA500')
        .setTitle('💳 เลือกวิธีการคืนเงิน')
        .setDescription(`ยอดหนี้ปัจจุบันของคุณ: **฿${currentDebt.toLocaleString()}**`);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('finance_repay_full')
            .setLabel(`คืนเต็มจำนวน (฿${currentDebt.toLocaleString()})`)
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('finance_repay_custom')
            .setLabel('ระบุจำนวนเอง')
            .setStyle(ButtonStyle.Secondary)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
});

// 2.1 Handle "Repay Full"
registerButtonHandler('finance_repay_full', async (interaction: ButtonInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const member = await db.query.members.findFirst({
        where: and(
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
        await interaction.editReply('❌ คุณมีรายการขอคืนเงินที่รอการตรวจสอบอยู่แล้ว');
        return;
    }

    const amount = Math.abs(member.balance);
    if (amount === 0) {
        await interaction.editReply('✅ คุณไม่มีหนี้สินแล้ว');
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
        description: 'คืนเงิน',
        memberId: member.id,
        status: 'PENDING',
        createdById: member.id,
        createdAt: new Date(),
        balanceBefore: gangBalance,
        balanceAfter: gangBalance + amount,
    });

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('⏳ ส่งคำขอคืนเงินแล้ว')
        .setDescription(`จำนวน: **฿${amount.toLocaleString()}** (คืนเต็มจำนวน)\n\nกรุณารอแอดมินตรวจสอบ`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

    // Notify admin channel
    const adminEmbed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('🏦 แจ้งคืนเงินใหม่')
        .setDescription(`**${member.name || 'สมาชิก'}** (<@${discordId}>) แจ้งคืนเงินเต็มจำนวน`)
        .addFields(
            { name: '💰 จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
            { name: '📝 หมายเหตุ', value: 'คืนเต็มจำนวน', inline: true }
        )
        .setFooter({ text: 'อนุมัติ/ปฏิเสธได้ที่ Web Dashboard' })
        .setTimestamp();
    await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);
});

// 2.2 Handle "Custom Repay" -> Open Modal
registerButtonHandler('finance_repay_custom', async (interaction: ButtonInteraction) => {
    const modal = new ModalBuilder()
        .setCustomId('finance_repay_modal')
        .setTitle('🏦 คืนเงิน');

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

// 2.3 Handle "Deposit" Button -> Open Modal
registerButtonHandler('finance_request_deposit', async (interaction: ButtonInteraction) => {
    const modal = new ModalBuilder()
        .setCustomId('finance_deposit_modal')
        .setTitle('📥 ฝากเงิน / สำรองจ่าย');

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

// 3. Handle Loan Modal Submit
registerModalHandler('finance_loan_modal', async (interaction: ModalSubmitInteraction) => {
    const amountStr = interaction.fields.getTextInputValue('amount');
    const amount = parseFloat(amountStr.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.reply({ content: '❌ กรุณาระบุจำนวนเงินให้ถูกต้อง (ตัวเลข, มากกว่า 0, ไม่เกิน 100,000,000)', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const member = await db.query.members.findFirst({
            where: and(eq(members.discordId, interaction.user.id), eq(members.isActive, true)),
            with: { gang: true }
        });

        if (!member || !member.gangId) {
            await interaction.editReply('❌ ไม่พบข้อมูลสมาชิกหรือแก๊งของคุณ');
            return;
        }

        const gang = member.gang;
        const currentBalance = gang.balance || 0;

        if (currentBalance < amount) {
            await interaction.editReply(`❌ เงินกองกลางไม่เพียงพอ (ยอดคงเหลือ: ฿${currentBalance.toLocaleString()})`);
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
            .setTitle('💸 คำขอเบิก/ยืมเงิน (PENDING)')
            .setColor(0xFEE75C)
            .addFields(
                { name: '👤 ผู้ขอ', value: `${member.name} (<@${member.discordId}>)`, inline: true },
                { name: '💰 จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: '🏦 ยอดกองกลางปัจจุบัน', value: `฿${currentBalance.toLocaleString()}`, inline: true },
                { name: '📋 รายการ', value: 'เบิก/ยืมเงิน', inline: false }
            )
            .setTimestamp();

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);

        await interaction.editReply(`✅ ส่งคำขอเบิกเงิน **฿${amount.toLocaleString()}** เรียบร้อยแล้ว รอการอนุมัติจากเหรัญญิกครับ`);
    } catch (err) {
        console.error(err);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการทำรายการ');
    }
});

// 4. Handle Repay Modal Submit (Updated for Split Logic)
registerModalHandler('finance_repay_modal', async (interaction: ModalSubmitInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const amountStr = interaction.fields.getTextInputValue('amount');
    const amount = parseFloat(amountStr.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.editReply('❌ จำนวนเงินต้องเป็นตัวเลข, มากกว่า 0 และไม่เกิน 100,000,000');
        return;
    }

    try {
        // Find Member
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            with: { gang: true }
        });

        if (!member) {
            await interaction.editReply('❌ คุณยังไม่ได้ลงทะเบียนเป็นสมาชิกแก๊ง');
            return;
        }

        const currentDebt = Math.abs(Math.min(member.balance || 0, 0));
        if (currentDebt === 0) {
            await interaction.editReply('❌ คุณไม่มีหนี้ค้างชำระให้ทำรายการคืนเงิน');
            return;
        }

        if (amount > currentDebt) {
            await interaction.editReply(`❌ ยอดคืนเกินจำนวนหนี้ (สูงสุด: ฿${currentDebt.toLocaleString()})`);
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
            await interaction.editReply('❌ คุณมีรายการที่รอการตรวจสอบอยู่แล้ว กรุณารอแอดมินดำเนินการก่อน');
            return;
        }

        // Get actual gang balance for accurate snapshot
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, member.gangId),
            columns: { balance: true }
        });
        const gangBalance = gang?.balance || 0;

        const type = 'REPAYMENT';
        const description = 'คืนเงิน';

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
            .setTitle('⏳ ส่งคำขอคืนเงินแล้ว')
            .setDescription(`จำนวน: **฿${amount.toLocaleString()}**\n\nกรุณารอแอดมินตรวจสอบ`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Notify Admin
        const adminEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🏦 แจ้งคืนเงินใหม่')
            .setDescription(`**${member.name}** (<@${discordId}>) ทำรายการ:`)
            .addFields(
                { name: '💰 จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: '📋 รายการ', value: 'คืนเงิน', inline: true }
            )
            .setTimestamp();

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);

    } catch (error) {
        console.error('Inflow Request Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 5. Handle Deposit Modal Submit
registerModalHandler('finance_deposit_modal', async (interaction: ModalSubmitInteraction) => {
    const amountStr = interaction.fields.getTextInputValue('amount');
    const amount = parseFloat(amountStr.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.reply({ content: '❌ กรุณาระบุจำนวนเงินให้ถูกต้อง (ตัวเลข, มากกว่า 0, ไม่เกิน 100,000,000)', ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const member = await db.query.members.findFirst({
            where: and(eq(members.discordId, interaction.user.id), eq(members.isActive, true)),
            with: { gang: true }
        });

        if (!member || !member.gangId) {
            await interaction.editReply('❌ ไม่พบข้อมูลสมาชิกหรือแก๊ง');
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
            await interaction.editReply('❌ คุณยังมีรายการแจ้งเงินเข้าที่รออนุมัติอยู่ กรุณารอให้แอดมินตรวจสอบรายการเดิมก่อนครับ');
            return;
        }

        const gangBalance = member.gang.balance || 0;
        const transactionType = 'DEPOSIT';
        const label = 'แจ้งฝากเงิน/สำรองจ่าย';
        const emoji = '';

        const transactionId = nanoid();
        await db.insert(transactions).values({
            id: transactionId,
            gangId: member.gangId,
            type: transactionType,
            amount,
            description: 'ฝากเงิน/สำรองจ่าย',
            memberId: member.id,
            status: 'PENDING',
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: gangBalance,
            balanceAfter: gangBalance + amount,
        });

        const adminEmbed = new EmbedBuilder()
            .setTitle(`${emoji} ${label} (PENDING)`)
            .setColor(0x5865F2)
            .addFields(
                { name: '👤 สมาชิก', value: `${member.name} (<@${member.discordId}>)`, inline: true },
                { name: '💰 จำนวนเงินเข้า', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: '🏦 ยอดกองกลางปัจจุบัน', value: `฿${gangBalance.toLocaleString()}`, inline: true },
                { name: '� รายการ', value: 'ฝากเงิน/สำรองจ่าย', inline: true }
            )
            .setTimestamp();

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed, 'TREASURER', transactionId);

        await interaction.editReply(`✅ แจ้งทำรายการ **฿${amount.toLocaleString()}** เรียบร้อยแล้ว! กรุณารอเหรัญญิกตรวจสอบหลักฐานและอนุมัติยอดครับ`);
    } catch (err) {
        console.error(err);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 6. Handle Direct Approval/Rejection from Discord
registerButtonHandler('fn_approve_', async (interaction: ButtonInteraction) => {
    const transactionId = interaction.customId.replace('fn_approve_', '');
    await interaction.deferReply({ ephemeral: true });

    try {
        const member = await db.query.members.findFirst({
            where: and(eq(members.discordId, interaction.user.id), eq(members.isActive, true)),
            with: { gang: true }
        });

        if (!member || (member.gangRole !== 'TREASURER' && member.gangRole !== 'OWNER')) {
            await interaction.editReply('❌ เฉพาะเหรัญญิกหรือหัวหน้าแก๊งเท่านั้นที่สามารถอนุมัติได้');
            return;
        }

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });

        if (!transaction || transaction.status !== 'PENDING') {
            await interaction.editReply('❌ ไม่พบรายการนี้ หรือรายการนี้ถูกดำเนินการไปแล้ว');
            return;
        }

        // Use the centralized service
        const { FinanceService } = await import('@gang/database');
        await FinanceService.approveTransaction(db, {
            transactionId,
            actorId: member.id,
            actorName: member.name
        });

        await interaction.editReply('✅ อนุมัติรายการเรียบร้อยแล้ว');
    } catch (err: any) {
        console.error(err);
        await interaction.editReply(`❌ ผิดพลาด: ${err.message}`);
    }
});

registerButtonHandler('fn_reject_', async (interaction: ButtonInteraction) => {
    const transactionId = interaction.customId.replace('fn_reject_', '');
    await interaction.deferReply({ ephemeral: true });

    try {
        const approver = await db.query.members.findFirst({
            where: and(eq(members.discordId, interaction.user.id), eq(members.isActive, true)),
            columns: { id: true, gangRole: true }
        });

        if (!approver || (approver.gangRole !== 'TREASURER' && approver.gangRole !== 'OWNER')) {
            await interaction.editReply('❌ เฉพาะเหรัญญิกหรือหัวหน้าแก๊งเท่านั้นที่สามารถปฏิเสธได้');
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

        await interaction.editReply('❌ ปฏิเสธรายการเรียบร้อยแล้ว');
    } catch (err) {
        console.error(err);
        await interaction.editReply('❌ เกิดข้อผิดพลาด');
    }
});
