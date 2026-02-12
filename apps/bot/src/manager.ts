import { ShardingManager } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const manager = new ShardingManager(join(__dirname, 'index.ts'), {
    token: process.env.DISCORD_BOT_TOKEN,
    totalShards: 'auto',
    // Key: This ensures that the spawned shard process (node) loads tsx to understand .ts files
    execArgv: ['--import', 'tsx'],
});

manager.on('shardCreate', (shard) => {
    console.log(`Launched shard ${shard.id}`);
});

manager.spawn().catch(error => {
    console.error('❌ Sharding Manager failed to spawn:', error);
});

// HTTP Server for Render Keep-alive
// This stays in the manager so it doesn't die when a shard crashes
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('OK (Manager Active)');
});

server.listen(port, () => {
    console.log(`🛡️ Manager Health Check Server listening on port ${port}`);
});
