import { REST, Routes, Client, SlashCommandBuilder } from 'discord.js';
import { setupCommand } from '../commands/setup';

// Only /setup command — all other features use buttons
const commands = [
    setupCommand.data,
];

// Command handlers map
export const commandHandlers = new Map([
    ['setup', setupCommand.execute],
]);

// Register commands to Discord
export async function registerCommands(client: Client) {
    const rest = new REST().setToken(process.env.DISCORD_BOT_TOKEN!);

    try {
        console.log('🔄 Registering slash commands...');

        await rest.put(
            Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
            { body: commands.map(c => c.toJSON()) }
        );

        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
}
