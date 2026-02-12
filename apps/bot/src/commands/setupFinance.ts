import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ChatInputCommandInteraction, TextChannel } from 'discord.js';

export const setupFinanceCommand = {
    data: new SlashCommandBuilder()
        .setName('setup_finance')
        .setDescription('Setup Finance system buttons (Loan / Repay)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    execute: async (interaction: ChatInputCommandInteraction) => {
        if (!interaction.channel || !interaction.channel.isSendable()) {
            await interaction.reply({ content: '❌ ห้องนี้ไม่สามารถส่งข้อความได้', ephemeral: true });
            return;
        }

        // Send to current channel
        const channel = interaction.channel as TextChannel;

        const embed = new EmbedBuilder()
            .setTitle('💰 ระบบการเงิน (Finance System)')
            .setDescription('กดปุ่มด้านล่างเพื่อทำรายการ\n\n- **ยืมเงิน (Loan)**: ขอยืมเงินจากกองกลาง\n- **คืนเงิน (Repay)**: แจ้งคืนเงินกู้')
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
                    .setLabel('คืนเงิน (Repay)')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('🏦')
            );

        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ สร้างปุ่ม Finance เรียบร้อยแล้ว!`, ephemeral: true });
    },
};
