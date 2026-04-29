import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import type { FullConfig } from '@playwright/test';
import { loadEnvConfig } from '@next/env';
import { encode } from 'next-auth/jwt';

const projectDir = path.resolve(__dirname, '..', '..');
const workspaceRoot = path.resolve(projectDir, '..', '..');

loadEnvConfig(workspaceRoot);
loadEnvConfig(projectDir);

function loadLocalE2EEnv() {
    const localEnvPath = path.join(projectDir, '.env.local');
    if (!fsSync.existsSync(localEnvPath)) {
        return;
    }

    const text = fsSync.readFileSync(localEnvPath, 'utf-8');
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
        if (!match) {
            continue;
        }

        const [, key, rawValue] = match;
        if (!key.startsWith('E2E_') && key !== 'PLAYWRIGHT_STORAGE_STATE') {
            continue;
        }

        if (!process.env[key]) {
            process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
        }
    }
}

loadLocalE2EEnv();

function getBaseUrl(config: FullConfig) {
    return config.projects[0]?.use?.baseURL?.toString() || 'http://127.0.0.1:3000';
}

function getCookieName(baseUrl: string) {
    return baseUrl.startsWith('https://') ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}

function getCookieDomain(baseUrl: string) {
    const { hostname } = new URL(baseUrl);
    return hostname;
}

export default async function globalSetup(config: FullConfig) {
    const enabled = process.env.PLAYWRIGHT_RUN_ATTENDANCE_SMOKE === '1'
        || process.env.PLAYWRIGHT_RUN_PRODUCTION_SMOKE === '1';
    if (!enabled) {
        return;
    }

    const sessionSecret = process.env.NEXTAUTH_SECRET;
    const discordId = process.env.E2E_DISCORD_ID;
    const accessToken = process.env.E2E_DISCORD_ACCESS_TOKEN || 'playwright-e2e-access-token';
    const userName = process.env.E2E_USER_NAME || 'Playwright Attendance Officer';
    const userEmail = process.env.E2E_USER_EMAIL || 'playwright@example.com';
    const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE || path.join(projectDir, '.playwright/auth/attendance-officer.json');

    if (!sessionSecret || !discordId) {
        throw new Error('NEXTAUTH_SECRET and E2E_DISCORD_ID are required when Playwright smoke tests are enabled');
    }

    const baseUrl = getBaseUrl(config);
    const sessionToken = await encode({
        token: {
            name: userName,
            email: userEmail,
            picture: null,
            sub: discordId,
            discordId,
            accessToken,
        },
        secret: sessionSecret,
        maxAge: 30 * 24 * 60 * 60,
    });

    await fs.mkdir(path.dirname(storageStatePath), { recursive: true });

    const state = {
        cookies: [
            {
                name: getCookieName(baseUrl),
                value: sessionToken,
                domain: getCookieDomain(baseUrl),
                path: '/',
                httpOnly: true,
                secure: baseUrl.startsWith('https://'),
                sameSite: 'Lax',
                expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            },
        ],
        origins: [],
    };

    await fs.writeFile(storageStatePath, JSON.stringify(state, null, 2), 'utf-8');
}
