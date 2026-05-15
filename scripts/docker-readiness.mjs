import { spawnSync } from 'node:child_process';
import process from 'node:process';

const WEB_HEALTH_URL = process.env.WEB_HEALTH_URL || 'http://localhost:3000/api/health';
const BOT_HEALTH_URL = process.env.BOT_HEALTH_URL || 'http://localhost:8080/health';
const BOT_READY_URL = process.env.BOT_READY_URL || 'http://localhost:8080/ready';
const HEALTH_ATTEMPTS = Number(process.env.DOCKER_HEALTH_ATTEMPTS || 12);
const HEALTH_INTERVAL_MS = Number(process.env.DOCKER_HEALTH_INTERVAL_MS || 1000);
const HEALTH_TIMEOUT_MS = Number(process.env.DOCKER_HEALTH_TIMEOUT_MS || 5000);

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

async function fetchJsonWithTimeout(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            headers: { accept: 'application/json' },
            signal: controller.signal,
        });
        const payload = await response.json();
        return { response, payload };
    } finally {
        clearTimeout(timeout);
    }
}

async function probeJson(label, url, validator) {
    let lastError = null;

    for (let attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt += 1) {
        try {
            const { response, payload } = await fetchJsonWithTimeout(url);
            validator(response, payload);
            console.log(`OK ${label}: ${url}`);
            return;
        } catch (error) {
            lastError = error;
            if (attempt < HEALTH_ATTEMPTS) {
                await sleep(HEALTH_INTERVAL_MS);
            }
        }
    }

    throw new Error(`${label} failed after retries: ${lastError instanceof Error ? lastError.message : lastError}`);
}

async function main() {
    if (![HEALTH_ATTEMPTS, HEALTH_INTERVAL_MS, HEALTH_TIMEOUT_MS].every((value) => Number.isFinite(value) && value > 0)) {
        throw new Error('Docker health settings must be positive numbers');
    }

    console.log('Docker readiness verification started');
    console.log(`Health probe budget: attempts=${HEALTH_ATTEMPTS}, timeoutMs=${HEALTH_TIMEOUT_MS}, intervalMs=${HEALTH_INTERVAL_MS}`);

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
