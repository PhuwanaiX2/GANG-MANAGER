import { ShardingManager } from 'discord.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import http from 'http';
import { getDatabaseConnectionFingerprint } from '@gang/database';
import { maybeHandleAlertTestRequest } from './utils/alertTestEndpoint';
import { resolveHealthPort } from './utils/healthPort';
import { logError, logInfo, logWarn } from './utils/logger';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
let readinessStatus: 'starting' | 'ready' | 'degraded' = 'starting';
let readinessError: string | null = null;
const databaseFingerprint = getDatabaseConnectionFingerprint();
const exposeHealthDiagnostics = process.env.EXPOSE_HEALTH_DIAGNOSTICS === 'true';

function summarizeStartupError(error: unknown) {
    if (error instanceof Error) {
        return error.message || error.name || 'Shard spawn failed';
    }

    if (typeof error === 'string') {
        return error || 'Shard spawn failed';
    }

    if (error && typeof error === 'object') {
        const record = error as Record<string, unknown>;
        const fields = ['message', 'name', 'code', 'status', 'method', 'path']
            .map((key) => {
                const value = record[key];
                return value === undefined || value === null ? null : `${key}=${String(value)}`;
            })
            .filter(Boolean);

        if (fields.length > 0) {
            return fields.join(' ');
        }
    }

    return 'Shard spawn failed with an uninspectable error';
}

function getProcessField(process: unknown, field: string) {
    if (!process || typeof process !== 'object' || !(field in process)) {
        return undefined;
    }

    const value = (process as Record<string, unknown>)[field];
    return value === undefined || value === null ? undefined : value;
}

const manager = new ShardingManager(join(__dirname, 'index.ts'), {
    token: process.env.DISCORD_BOT_TOKEN,
    totalShards: 'auto',
    // Key: This ensures that the spawned shard process (node) loads tsx to understand .ts files
    execArgv: ['--import', 'tsx'],
});

manager.on('shardCreate', (shard) => {
    logInfo('bot.manager.shard_launched', { shardId: shard.id });
    shard.on('ready', () => {
        logInfo('bot.manager.shard_ready', { shardId: shard.id });
    });
    shard.on('death', (process) => {
        logError('bot.manager.shard_died_before_ready', new Error(`Discord shard ${shard.id} died`), {
            shardId: shard.id,
            exitCode: getProcessField(process, 'exitCode'),
            signalCode: getProcessField(process, 'signalCode'),
            spawnfile: getProcessField(process, 'spawnfile'),
            spawnargs: getProcessField(process, 'spawnargs'),
        });
    });
    shard.on('disconnect', () => {
        logWarn('bot.manager.shard_disconnected', { shardId: shard.id });
    });
    shard.on('reconnecting', () => {
        logWarn('bot.manager.shard_reconnecting', { shardId: shard.id });
    });
    shard.on('error', (error) => {
        logError('bot.manager.shard_error', error, { shardId: shard.id });
    });
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
    readinessError = summarizeStartupError(error);
    logError('bot.manager.spawn_failed', error, { readinessError });
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
    if (maybeHandleAlertTestRequest(req, res)) {
        return;
    }

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
