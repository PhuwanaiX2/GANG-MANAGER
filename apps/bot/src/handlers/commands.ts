import { REST, Routes, Client, SlashCommandBuilder } from 'discord.js';
import { setupCommand } from '../commands/setup';
import { settingsCommand } from '../commands/settings';
import { setupLeaveCommand } from '../commands/setupLeave';
import { setupFinanceCommand } from '../commands/setupFinance';
import { incomeCommand, expenseCommand } from '../commands/financeOps';

// All commands
const commands = [
    setupCommand.data,
    settingsCommand.data,
    setupLeaveCommand.data,
    setupFinanceCommand.data,
    incomeCommand.data,
    expenseCommand.data,
];

// Command handlers map
export const commandHandlers = new Map([
    ['setup', setupCommand.execute],
    ['settings', settingsCommand.execute],
    ['setup_leave', setupLeaveCommand.execute],
    ['setup_finance', setupFinanceCommand.execute],
    ['income', incomeCommand.execute],
    ['expense', expenseCommand.execute],
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
