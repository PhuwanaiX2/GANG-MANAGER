import {
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    ModalSubmitInteraction,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle
} from 'discord.js';
import { registerButtonHandler } from '../handlers/buttons';
import { registerModalHandler } from '../handlers/modals';
import { db, members, transactions, gangs } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// ==================== HANDLERS ====================

// 1. Handle "Loan" Button -> Open Modal
registerButtonHandler('finance_request_loan', async (interaction: ButtonInteraction) => {
    const modal = new ModalBuilder()
        .setCustomId('finance_loan_modal')
        .setTitle('💸 ขอเบิก/ยืมเงิน');

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
        balanceBefore: 0,
        balanceAfter: 0,
    });

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('⏳ ส่งคำขอคืนเงินแล้ว')
        .setDescription(`จำนวน: **฿${amount.toLocaleString()}** (คืนเต็มจำนวน)\n\nกรุณารอแอดมินตรวจสอบ`)
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
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

        if (!gang || gang.balance < amount) {
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
            balanceBefore: gang.balance,
            balanceAfter: gang.balance - amount,
        });

        const embed = new EmbedBuilder()
            .setColor('#FFA500')
            .setTitle('⏳ ส่งคำขอเบิกเงินแล้ว')
            .setDescription(`จำนวน: **฿${amount.toLocaleString()}**\nเหตุผล: ${reason}\n\nกรุณารอแอดมินอนุมัติ`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Loan Request Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});

// 4. Handle Repay Modal Submit
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

        // Check if member has debt (Balance < 0)
        if ((member.balance || 0) >= 0) {
            await interaction.editReply('❌ คุณไม่มีหนี้สินที่ต้องชำระ (ยอดเงินสะสมของคุณเป็นบวก ✅)');
            return;
        }

        const currentDebt = Math.abs(member.balance);
        if (amount > currentDebt) {
            await interaction.editReply(`❌ คุณระบุยอดเกินหนี้สินจริง (หนี้ของคุณ: ฿${currentDebt.toLocaleString()})`);
            return;
        }

        // Check for existing PENDING repayment
        const existingPending = await db.query.transactions.findFirst({
            where: and(
                eq(transactions.memberId, member.id),
                eq(transactions.status, 'PENDING'),
                eq(transactions.type, 'REPAYMENT')
            )
        });

        if (existingPending) {
            await interaction.editReply('❌ คุณมีรายการขอคืนเงินที่รอการตรวจสอบอยู่แล้ว กรุณารอแอดมินดำเนินการก่อน');
            return;
        }

        // Insert Transaction (PENDING)
        await db.insert(transactions).values({
            id: nanoid(),
            gangId: member.gangId,
            type: 'REPAYMENT',
            amount,
            description: note,
            memberId: member.id,
            status: 'PENDING', // Wait for Admin approval
            createdById: member.id,
            createdAt: new Date(),
            balanceBefore: 0,
            balanceAfter: 0,
        });

        const embed = new EmbedBuilder()
            .setColor('#00FF00')
            .setTitle('⏳ แจ้งคืนเงินแล้ว')
            .setDescription(`จำนวน: **฿${amount.toLocaleString()}**\nหมายเหตุ: ${note}\n\nกรุณารอแอดมินตรวจสอบ`)
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error('Repay Request Error:', error);
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการส่งคำขอ');
    }
});
