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
    const botToken = process.env.DISCORD_BOT_TOKEN;
    const clientId = process.env.DISCORD_CLIENT_ID;

    if (!botToken || !clientId) {
        throw new Error('DISCORD_BOT_TOKEN and DISCORD_CLIENT_ID are required to register slash commands');
    }

    const rest = new REST().setToken(botToken);

    try {
        console.log('🔄 Registering slash commands...');

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands.map(c => c.toJSON()) }
        );

        console.log('✅ Slash commands registered!');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
        throw error;
    }
}
