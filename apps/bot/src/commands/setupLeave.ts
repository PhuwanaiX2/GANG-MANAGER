import { ActionRowBuilder, ChatInputCommandInteraction, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { logError } from '../utils/logger';

export const setupLeaveCommand = {
    data: new SlashCommandBuilder()
        .setName('setup_leave')
        .setDescription('สร้างปุ่มแจ้งลา/เข้าช้าในห้องนี้')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    execute: async (interaction: ChatInputCommandInteraction) => {
        try {
            await interaction.deferReply({ ephemeral: true });

            const embed = {
                title: '📝 แจ้งลา / เข้าช้า',
                description: 'กดปุ่มด้านล่างเพื่อส่งใบลา หรือแจ้งเข้าช้า\nระบบจะส่งข้อมูลให้หัวหน้าพิจารณา',
                color: 0xFEE75C, // Yellow
            };

            const row = new ActionRowBuilder<any>()
                .addComponents(
                    {
                        type: 2,
                        style: 2, // Secondary
                        label: '🟡 เข้าช้า (Late)',
                        custom_id: 'request_leave_late',
                    },
                    {
                        type: 2,
                        style: 3, // Success
                        label: '🟢 ลา 1 วัน (1 Day)',
                        custom_id: 'request_leave_1day',
                    },
                    {
                        type: 2,
                        style: 4, // Danger
                        label: '🔴 ลาหลายวัน (Multi-Day)',
                        custom_id: 'request_leave_multi',
                    }
                );

            if (interaction.channel && interaction.channel.isSendable()) {
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.editReply({ content: '✅ สร้างปุ่มแจ้งลาเรียบร้อยแล้ว!' });
            } else {
                await interaction.editReply({ content: '❌ ห้องนี้ไม่สามารถส่งข้อความได้' });
            }

        } catch (error) {
            logError('bot.setup_leave.failed', error, {
                guildId: interaction.guildId,
                channelId: interaction.channelId,
                userDiscordId: interaction.user.id,
            });
            await interaction.editReply({ content: '❌ เกิดข้อผิดพลาด' });
        }
    }
};
