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

// Ready event
client.once(Events.ClientReady, async (c) => {
    console.log(`✅ Bot is ready! Logged in as ${c.user.tag}`);
    console.log(`📊 Serving ${c.guilds.cache.size} guilds`);

    // Register slash commands
    await registerCommands(c);

    // Register Role Sync
    registerRoleSync();

    // Start attendance scheduler
    startAttendanceScheduler();

    // Start auto-backup
    startBackupScheduler();
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


