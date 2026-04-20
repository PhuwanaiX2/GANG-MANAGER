import { ShardingManager } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let readinessStatus: 'starting' | 'ready' | 'degraded' = 'starting';
let readinessError: string | null = null;

const manager = new ShardingManager(join(__dirname, 'index.ts'), {
    token: process.env.DISCORD_BOT_TOKEN,
    totalShards: 'auto',
    // Key: This ensures that the spawned shard process (node) loads tsx to understand .ts files
    execArgv: ['--import', 'tsx'],
});

manager.on('shardCreate', (shard) => {
    console.log(`Launched shard ${shard.id}`);
});

manager.spawn().then(() => {
    readinessStatus = 'ready';
    readinessError = null;
}).catch(error => {
    readinessStatus = 'degraded';
    readinessError = error instanceof Error ? error.message : 'Unknown shard spawn error';
    console.error('❌ Sharding Manager failed to spawn:', error);
});

// HTTP Server for Render Keep-alive
// This stays in the manager so it doesn't die when a shard crashes
const port = process.env.BOT_PORT || process.env.PORT || 8080;
const server = http.createServer((req, res) => {
    const path = req.url || '/';
    const payload = {
        status: readinessStatus,
        app: 'bot',
        shardCount: manager.shards.size,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        error: readinessError,
    };

    res.setHeader('Content-Type', 'application/json');

    if (path === '/ready') {
        res.writeHead(readinessStatus === 'ready' ? 200 : 503);
        res.end(JSON.stringify(payload));
        return;
    }

    if (path === '/health' || path === '/') {
        res.writeHead(200);
        res.end(JSON.stringify(payload));
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(port, () => {
    console.log(`🛡️ Manager Health Check Server listening on port ${port}`);
});
