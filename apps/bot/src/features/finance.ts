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
import { db, members, transactions, gangs, gangSettings, canAccessFeature } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Helper: send notification to admin finance/requests channel
async function notifyAdminChannel(
    client: Client,
    gangId: string,
    embed: EmbedBuilder
) {
    try {
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
            columns: { financeChannelId: true, requestsChannelId: true, logChannelId: true }
        });
        const channelId = settings?.requestsChannelId || settings?.financeChannelId || settings?.logChannelId;
        if (!channelId) return;
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({ content: '@here มีคำขอการเงินใหม่!', embeds: [embed] });
        }
    } catch (err) {
        console.error('Failed to notify admin channel (finance):', err);
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

    const reasonInput = new TextInputBuilder()
        .setCustomId('reason')
        .setLabel('เหตุผล')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('ค่ากระสุน / ค่าซ่อมรถ / ยืมส่วนตัว')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);

    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
});

// 2. Handle "Repay" Button -> Open Modal
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

    // Insert PENDING Transaction
    await db.insert(transactions).values({
        id: nanoid(),
        gangId: member.gangId,
        type: 'REPAYMENT',
        amount: amount,
        description: 'คืนเต็มจำนวน',
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
    await notifyAdminChannel(interaction.client, member.gangId, adminEmbed);
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

    const noteInput = new TextInputBuilder()
        .setCustomId('note')
        .setLabel('หมายเหตุ')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('คืนส่วนที่ยืมเมื่อวาน / ฝากคืนให้พี่...')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);

    modal.addComponents(row1, row2);
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

    const noteInput = new TextInputBuilder()
        .setCustomId('note')
        .setLabel('หมายเหตุ')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('ฝากเข้ากองกลาง / สำรองจ่ายค่าของ')
        .setRequired(true);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(noteInput);

    modal.addComponents(row1, row2);
    await interaction.showModal(modal);
});

// 3. Handle Loan Modal Submit
registerModalHandler('finance_loan_modal', async (interaction: ModalSubmitInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const amountStr = interaction.fields.getTextInputValue('amount');
    const reason = interaction.fields.getTextInputValue('reason');
    const amount = parseFloat(amountStr.replace(/,/g, '')); // Remove commas

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.editReply('❌ จำนวนเงินต้องเป็นตัวเลข, มากกว่า 0 และไม่เกิน 100,000,000');
        return;
    }

    try {
        // Find Member & Gang
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

        // Check gang balance BEFORE creating request
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, member.gangId),
            columns: { balance: true }
        });

        if (!gang || (gang.balance || 0) < amount) {
            await interaction.editReply(`❌ เงินกองกลางไม่เพียงพอ\n\nยอดคงเหลือ: ฿${(gang?.balance || 0).toLocaleString()}\nจำนวนที่ขอ: ฿${amount.toLocaleString()}`);
            return;
        }

        // Insert Transaction (PENDING)
        await db.insert(transactions).values({
            id: nanoid(),
            gangId: member.gangId,
            type: 'LOAN',
            amount,
            description: reason,
            memberId: member.id,
            status: 'PENDING',
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: gang.balance || 0,
            balanceAfter: (gang.balance || 0) - amount,
        });

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⏳ ส่งคำขอเบิกเงินแล้ว')
            .setDescription(`จำนวน: **฿${amount.toLocaleString()}**\nเหตุผล: ${reason}\n\nกรุณารอแอดมินอนุมัติ`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Notify admin channel
        const adminEmbed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('💸 คำขอเบิก/ยืมเงินใหม่')
            .setDescription(`**${member.name}** (<@${discordId}>) ขอเบิกเงิน`)
            .addFields(
                { name: '💰 จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: '📝 เหตุผล', value: reason, inline: true }
            )
            .setFooter({ text: 'อนุมัติ/ปฏิเสธได้ที่ Web Dashboard' })
            .setTimestamp();
        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed);

    } catch (error) {
        console.error('Loan Request Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 4. Handle Repay Modal Submit (Updated for Split Logic)
registerModalHandler('finance_repay_modal', async (interaction: ModalSubmitInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const amountStr = interaction.fields.getTextInputValue('amount');
    const note = interaction.fields.getTextInputValue('note');
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

        // Check for existing PENDING repayment/deposit
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

        const currentDebt = Math.abs(Math.min(member.balance || 0, 0)); // Only consider negative balance as debt
        let repayAmount = 0;
        let depositAmount = 0;

        if ((member.balance || 0) >= 0) {
            // No debt, everything is deposit
            depositAmount = amount;
        } else {
            // Has debt
            if (amount <= currentDebt) {
                repayAmount = amount;
            } else {
                repayAmount = currentDebt;
                depositAmount = amount - currentDebt;
            }
        }

        const msgs: string[] = [];

        // Transaction 1: Repayment (if applicable)
        if (repayAmount > 0) {
            await db.insert(transactions).values({
                id: nanoid(),
                gangId: member.gangId,
                type: 'REPAYMENT',
                amount: repayAmount,
                description: depositAmount > 0 ? `${note} (หักหนี้)` : note,
                memberId: member.id,
                status: 'PENDING',
                createdById: member.id,
                createdAt: new Date(),
                balanceBefore: 0, // Placeholder
                balanceAfter: 0,
            });
            msgs.push(`✅ แจ้งคืนหนี้: **฿${repayAmount.toLocaleString()}**`);
        }

        // Transaction 2: Deposit (if applicable)
        if (depositAmount > 0) {
            await db.insert(transactions).values({
                id: nanoid(),
                gangId: member.gangId,
                type: 'DEPOSIT',
                amount: depositAmount,
                description: repayAmount > 0 ? `${note} (ส่วนเกิน/ฝากเพิ่ม)` : note,
                memberId: member.id,
                status: 'PENDING',
                createdById: member.id,
                createdAt: new Date(), // Slightly after
                balanceBefore: 0,
                balanceAfter: 0,
            });
            msgs.push(`📥 ฝากเข้ากองกลาง: **฿${depositAmount.toLocaleString()}**`);
        }

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('⏳ บันทึกทำรายการแล้ว')
            .setDescription(msgs.join('\n') + `\n\nหมายเหตุ: ${note}`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        // Notify Admin
        const adminEmbed = new EmbedBuilder()
            .setColor(0x57F287)
            .setTitle('🏦 มีรายการการเงินใหม่')
            .setDescription(`**${member.name}** (<@${discordId}>) ทำรายการ:`)
            .addFields(
                { name: '📝 รายละเอียด', value: msgs.join('\n'), inline: false },
                { name: '💬 หมายเหตุ', value: note, inline: false }
            )
            .setTimestamp();

        // Notify Treasurer (@Treasurer) too if possible? 
        // Logic handled in notifyAdminChannel generic function, but we can enhance it later.
        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed);

    } catch (error) {
        console.error('Repay/Deposit Request Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 5. Handle Deposit Modal Submit
registerModalHandler('finance_deposit_modal', async (interaction: ModalSubmitInteraction) => {
    await interaction.deferReply({ ephemeral: true });

    const discordId = interaction.user.id;
    const amountStr = interaction.fields.getTextInputValue('amount');
    const note = interaction.fields.getTextInputValue('note');
    const amount = parseFloat(amountStr.replace(/,/g, ''));

    if (isNaN(amount) || amount <= 0 || amount > 100000000) {
        await interaction.editReply('❌ จำนวนเงินต้องเป็นตัวเลข, มากกว่า 0 และไม่เกิน 100,000,000');
        return;
    }

    try {
        const member = await db.query.members.findFirst({
            where: and(eq(members.discordId, discordId), eq(members.isActive, true)),
            with: { gang: true }
        });

        if (!member) {
            await interaction.editReply('❌ ไม่พบข้อมูลสมาชิก');
            return;
        }

        // Just Insert DEPOSIT Transaction (PENDING)
        await db.insert(transactions).values({
            id: nanoid(),
            gangId: member.gangId,
            type: 'DEPOSIT',
            amount: amount,
            description: note,
            memberId: member.id,
            status: 'PENDING',
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: 0,
            balanceAfter: 0,
        });

        const embed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('⏳ แจ้งฝากเงินแล้ว')
            .setDescription(`จำนวน: **฿${amount.toLocaleString()}**\nหมายเหตุ: ${note}\n\nกรุณารอแอดมินตรวจสอบ`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

        const adminEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📥 มีรายการฝากเงินใหม่')
            .setDescription(`**${member.name}** (<@${discordId}>) แจ้งฝากเงิน`)
            .addFields(
                { name: '💰 จำนวน', value: `฿${amount.toLocaleString()}`, inline: true },
                { name: '📝 หมายเหตุ', value: note, inline: true }
            )
            .setTimestamp();

        await notifyAdminChannel(interaction.client, member.gangId, adminEmbed);

    } catch (error) {
        console.error('Deposit Request Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาด');
    }
});
