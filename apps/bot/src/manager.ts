import { ShardingManager } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import http from 'http';
import { getDatabaseConnectionFingerprint } from '@gang/database';
import { resolveHealthPort } from './utils/healthPort';
import { logError, logInfo, logWarn } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let readinessStatus: 'starting' | 'ready' | 'degraded' = 'starting';
let readinessError: string | null = null;
const databaseFingerprint = getDatabaseConnectionFingerprint();
const exposeHealthDiagnostics = process.env.EXPOSE_HEALTH_DIAGNOSTICS === 'true';

const manager = new ShardingManager(join(__dirname, 'index.ts'), {
    token: process.env.DISCORD_BOT_TOKEN,
    totalShards: 'auto',
    // Key: This ensures that the spawned shard process (node) loads tsx to understand .ts files
    execArgv: ['--import', 'tsx'],
});

manager.on('shardCreate', (shard) => {
    logInfo('bot.manager.shard_launched', { shardId: shard.id });
});

manager.spawn().then(() => {
    readinessStatus = 'ready';
    readinessError = null;
    logInfo('bot.manager.runtime_identity', {
        databaseConfigured: databaseFingerprint !== null,
        databaseFingerprint,
    });
}).catch(error => {
    readinessStatus = 'degraded';
    readinessError = error instanceof Error ? error.message : 'Unknown shard spawn error';
    logError('bot.manager.spawn_failed', error);
});

// HTTP Server for Render Keep-alive
// This stays in the manager so it doesn't die when a shard crashes
const healthPort = resolveHealthPort();
if (healthPort.ignoredInvalidKeys.length > 0) {
    logWarn('bot.manager.invalid_health_port_config', {
        ignoredInvalidKeys: healthPort.ignoredInvalidKeys,
        fallbackSource: healthPort.source,
    });
}

const server = http.createServer((req, res) => {
    const path = req.url || '/';
    const payload = {
        status: readinessStatus,
        app: 'bot',
        shardCount: manager.shards.size,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
        error: readinessError,
        ...(exposeHealthDiagnostics ? {
            diagnostics: {
                databaseFingerprint,
            },
        } : {}),
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

server.on('error', (error) => {
    logError('bot.manager.health_server_failed', error, {
        port: healthPort.port,
        source: healthPort.source,
    });
});

server.listen(healthPort.port, () => {
    logInfo('bot.manager.health_server_listening', {
        port: healthPort.port,
        source: healthPort.source,
    });
});
