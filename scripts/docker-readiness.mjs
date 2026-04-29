import { spawnSync } from 'node:child_process';
import process from 'node:process';

const WEB_HEALTH_URL = process.env.WEB_HEALTH_URL || 'http://localhost:3000/api/health';
const BOT_HEALTH_URL = process.env.BOT_HEALTH_URL || 'http://localhost:8080/health';
const BOT_READY_URL = process.env.BOT_READY_URL || 'http://localhost:8080/ready';

function runCommand(label, command) {
    console.log(`\n==> ${label}`);
    console.log(`$ ${command}`);

    const result = spawnSync(command, {
        cwd: process.cwd(),
        shell: true,
        stdio: 'inherit',
        env: process.env,
    });

    if (result.status !== 0) {
        throw new Error(`${label} failed with exit code ${result.status ?? 'unknown'}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeJson(label, url, validator) {
    let lastError = null;

    for (let attempt = 1; attempt <= 12; attempt += 1) {
        try {
            const response = await fetch(url, { headers: { accept: 'application/json' } });
            const payload = await response.json();
            validator(response, payload);
            console.log(`OK ${label}: ${url}`);
            return;
        } catch (error) {
            lastError = error;
            await sleep(1000);
        }
    }

    throw new Error(`${label} failed after retries: ${lastError instanceof Error ? lastError.message : lastError}`);
}

async function main() {
    console.log('Docker readiness verification started');

    runCommand('Build Docker images', 'docker compose build web bot');
    runCommand('Start Docker services', 'docker compose up -d --force-recreate web bot');

    await probeJson('Web health probe', WEB_HEALTH_URL, (response, payload) => {
        if (!response.ok) {
            throw new Error(`Web health returned ${response.status}`);
        }
        if (payload.status !== 'ok' || payload.app !== 'web' || payload.database !== 'up') {
            throw new Error(`Unexpected web health payload: ${JSON.stringify(payload)}`);
        }
    });

    await probeJson('Bot health probe', BOT_HEALTH_URL, (response, payload) => {
        if (!response.ok) {
            throw new Error(`Bot health returned ${response.status}`);
        }
        if (payload.app !== 'bot') {
            throw new Error(`Unexpected bot health payload: ${JSON.stringify(payload)}`);
        }
    });

    await probeJson('Bot readiness probe', BOT_READY_URL, (response, payload) => {
        if (!response.ok) {
            throw new Error(`Bot readiness returned ${response.status}`);
        }
        if (payload.status !== 'ready' || payload.app !== 'bot') {
            throw new Error(`Unexpected bot readiness payload: ${JSON.stringify(payload)}`);
        }
    });

    console.log('\nDocker readiness verification passed');
}

main().catch((error) => {
    console.error('\nDocker readiness verification failed');
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
