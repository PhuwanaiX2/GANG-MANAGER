import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { checkGangSubscriptionFeatureAccess } from '../utils/featureGuard';

export const setupFinanceCommand = {
    data: new SlashCommandBuilder()
        .setName('setup_finance')
        .setDescription('Setup Finance system buttons')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.channel || !interaction.channel.isSendable()) {
            await interaction.reply({ content: '❌ ห้องนี้ไม่สามารถส่งข้อความได้', ephemeral: true });
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
            .setDescription('กดปุ่มด้านล่างเพื่อทำรายการ\n\n- **ยืมเงิน (Loan)**: ขอยืมเงินจากกองกลาง\n- **ชำระหนี้ยืม (Loan Repay)**: แจ้งชำระเฉพาะหนี้ยืมเข้ากองกลาง\n- **ชำระยอดเก็บ/ฝากเครดิต**: จ่ายค่าเก็บแก๊งหรือฝากเครดิตไว้กับกองกลาง\n- **ดูยอดของฉัน**: แยกยอดหนี้ยืม ยอดค้างเก็บ และเครดิต')
            .setColor('#FFD700') // Gold color
            .setFooter({ text: 'Gang Management System' });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('finance_request_loan')
                    .setLabel('ยืมเงิน (Loan)')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💸'),
                new ButtonBuilder()
                    .setCustomId('finance_request_repay')
                    .setLabel('ชำระหนี้ยืม (Repay)')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🏦'),
                new ButtonBuilder()
                    .setCustomId('finance_request_deposit')
                    .setLabel('ชำระยอดเก็บ/ฝากเครดิต')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('📥'),
                new ButtonBuilder()
                    .setCustomId('finance_balance')
                    .setLabel('ดูยอดของฉัน')
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji('💳')
            );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ สร้างปุ่ม Finance เรียบร้อยแล้ว!`, ephemeral: true });
    },
};
