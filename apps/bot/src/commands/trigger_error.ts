
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';

export const data = new SlashCommandBuilder()
    .setName('trigger_error')
    .setDescription('For testing error logging (Throw Error)');

export async function execute(interaction: ChatInputCommandInteraction) {
    throw new Error("This is a test error for Discord Webhook Logging!");
}
