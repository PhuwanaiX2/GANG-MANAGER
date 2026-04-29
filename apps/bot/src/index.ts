import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { registerCommands, handleInteraction } from './handlers';
// Load features (registers button/modal handlers)
import './features';
import { registerRoleSync } from './features/roleSync';
import { logError, logInfo } from './utils/logger';

// Extend Client type
declare module 'discord.js' {
    interface Client {
        commands: Collection<string, any>;
    }
}

// Create client
export const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
    ],
});

// Initialize commands collection
client.commands = new Collection();

import { startAttendanceScheduler } from './services/attendanceScheduler';
import { startBackupScheduler } from './services/backupScheduler';
import { startLicenseScheduler } from './services/licenseScheduler';

// Ready event
client.once(Events.ClientReady, async (c) => {
    const shardIds = c.shard?.ids ?? [];
    const isPrimaryShard = shardIds.length === 0 || shardIds.includes(0);
    logInfo('bot.ready', {
        botUserTag: c.user.tag,
        guildCount: c.guilds.cache.size,
        shardIds,
        isPrimaryShard,
    });

    // Register Role Sync
    registerRoleSync();

    if (isPrimaryShard) {
        try {
            await registerCommands(c);
            startAttendanceScheduler();
            startBackupScheduler();
            startLicenseScheduler();
        } catch (error) {
            logError('bot.primary_shard_startup_failed', error, { shardIds });
            process.exit(1);
        }
    } else {
        logInfo('bot.global_startup_skipped', { shardIds });
    }
});

// Interaction event (commands, buttons, modals)
client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction);
});

// Error handling
client.on(Events.Error, (error) => {
    logError('bot.discord_client_error', error);
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);

process.on('unhandledRejection', async (reason, promise) => {
    logError('bot.unhandled_rejection', reason, { promise: String(promise) });
});

process.on('uncaughtException', async (error) => {
    logError('bot.uncaught_exception', error);
    // Exit so Docker/process manager can restart with clean state
    process.exit(1);
});


