
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('trigger_error')
    .setDescription('For testing error logging (Throw Error)');

export async function execute(interaction: ChatInputCommandInteraction) {
    const adminIds = (process.env.ADMIN_DISCORD_IDS || '').split(',');

    if (!adminIds.includes(interaction.user.id)) {
        await interaction.reply({ content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้', ephemeral: true });
        return;
    }

    throw new Error("This is a test error for Discord Webhook Logging!");
}
