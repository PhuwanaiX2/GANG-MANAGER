import 'dotenv/config';
import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { registerCommands, handleInteraction } from './handlers';
// Load features (registers button/modal handlers)
import './features';
import { registerRoleSync } from './features/roleSync';

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
    console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);
    console.log(`📊 Serving ${c.guilds.cache.size} guilds`);
    const shardIds = c.shard?.ids ?? [];
    const isPrimaryShard = shardIds.length === 0 || shardIds.includes(0);

    // Register Role Sync
    registerRoleSync();

    if (isPrimaryShard) {
        try {
            await registerCommands(c);
            startAttendanceScheduler();
            startBackupScheduler();
            startLicenseScheduler();
        } catch (error) {
            console.error('❌ Primary shard startup failed:', error);
            await logErrorToDiscord(error, { source: 'Primary shard startup' });
            process.exit(1);
        }
    } else {
        console.log(`⏭️ Skipping global startup tasks on shard ${shardIds.join(',') || 'unknown'}`);
    }
});

// Interaction event (commands, buttons, modals)
client.on(Events.InteractionCreate, async (interaction) => {
    await handleInteraction(interaction);
});

// Error handling
client.on(Events.Error, (error) => {
    console.error('❌ Discord client error:', error);
});

// Login
client.login(process.env.DISCORD_BOT_TOKEN);

// --- Global Error Handling ---
import { logErrorToDiscord } from './utils/errorLogger';

process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    await logErrorToDiscord(reason, { source: 'Global: Unhandled Rejection' });
});

process.on('uncaughtException', async (error) => {
    console.error('❌ Uncaught Exception:', error);
    await logErrorToDiscord(error, { source: 'Global: Uncaught Exception' });
    // Exit so Docker/process manager can restart with clean state
    process.exit(1);
});


