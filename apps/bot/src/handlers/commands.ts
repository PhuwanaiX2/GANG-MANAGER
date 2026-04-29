import { REST, Routes, Client, SlashCommandBuilder } from 'discord.js';
import { setupCommand } from '../commands/setup';
import { logError, logInfo } from '../utils/logger';

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
        logInfo('bot.commands.register.started', {
            commandCount: commands.length,
            clientId,
        });

        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands.map(c => c.toJSON()) }
        );

        logInfo('bot.commands.register.completed', {
            commandCount: commands.length,
            clientId,
        });
    } catch (error) {
        logError('bot.commands.register.failed', error, {
            commandCount: commands.length,
            clientId,
        });
        throw error;
    }
}
