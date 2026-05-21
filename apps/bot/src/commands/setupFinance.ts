import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChatInputCommandInteraction, TextChannel, MessageFlags } from 'discord.js';
import { checkGangSubscriptionFeatureAccess } from '../utils/featureGuard';

export const setupFinanceCommand = {
    data: new SlashCommandBuilder()
        .setName('setup_finance')
        .setDescription('Setup Finance system buttons')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.channel || !interaction.channel.isSendable()) {
            await interaction.reply({ content: '❌ ห้องนี้ไม่สามารถส่งข้อความได้', flags: MessageFlags.Ephemeral });
            return;
        }

        const guildId = interaction.guildId;
        if (!guildId) return;

        const financeAccess = await checkGangSubscriptionFeatureAccess(
            interaction,
            guildId,
            'finance',
            'ระบบการเงิน'
        );
        if (!financeAccess.allowed) {
            return;
        }

        // Send to current channel
        const channel = interaction.channel as TextChannel;

        const embed = new EmbedBuilder()
            .setTitle('💰 ระบบการเงิน (Finance System)')
            .setDescription('กดปุ่มให้ตรงกับยอดที่ต้องการทำรายการ\n\n- **ขอเบิก/ยืมเงิน**: ขอใช้เงินจากกองกลาง\n- **ชำระหนี้ยืม**: ใช้เฉพาะยอดหนี้ยืมเท่านั้น\n- **จ่ายยอดเก็บ/ฝากเครดิต**: ใช้จ่ายค่าเก็บเงินแก๊ง หรือฝากเครดิต/สำรองจ่าย\n- **ดูยอดของฉัน**: เช็กหนี้ยืม ค้างเก็บ และเครดิตก่อนกดทำรายการ')
            .setColor('#FFD700') // Gold color
            .setFooter({ text: 'Gang Management System' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('finance_request_loan')
                    .setLabel('ขอเบิก/ยืมเงิน')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💸'),
                new ButtonBuilder()
                    .setCustomId('finance_request_repay')
                    .setLabel('ชำระหนี้ยืม')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🏦'),
                new ButtonBuilder()
                    .setCustomId('finance_request_deposit')
                    .setLabel('จ่ายยอดเก็บ/ฝากเครดิต')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📥'),
                new ButtonBuilder()
                    .setCustomId('finance_balance')
                    .setLabel('ดูยอดของฉัน')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💳')
            );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ สร้างปุ่ม Finance เรียบร้อยแล้ว!`, flags: MessageFlags.Ephemeral });
    },
};
