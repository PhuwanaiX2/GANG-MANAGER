import path from 'node:path';
import fs from 'node:fs';
import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

const projectDir = __dirname;
const workspaceRoot = path.resolve(projectDir, '..', '..');

loadEnvConfig(workspaceRoot);
loadEnvConfig(projectDir);

function loadLocalE2EEnv() {
    const localEnvPath = path.join(projectDir, '.env.local');
    if (!fs.existsSync(localEnvPath)) {
        return;
    }

    const text = fs.readFileSync(localEnvPath, 'utf-8');
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

const shouldRunSmoke = process.env.PLAYWRIGHT_RUN_ATTENDANCE_SMOKE === '1'
    || process.env.PLAYWRIGHT_RUN_PRODUCTION_SMOKE === '1';
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';
const parsedBaseUrl = new URL(baseURL);
const startHostname = parsedBaseUrl.hostname;
const startPort = parsedBaseUrl.port || (parsedBaseUrl.protocol === 'https:' ? '443' : '80');
const webServerCommand = `node "${path.join(projectDir, 'tests', 'e2e', 'start-web-server.cjs')}"`;
const storageState = process.env.PLAYWRIGHT_STORAGE_STATE || path.join(projectDir, '.playwright/auth/attendance-officer.json');

export default defineConfig({
    testDir: './tests/e2e',
    testMatch: ['**/*.spec.ts'],
    timeout: 30_000,
    fullyParallel: false,
    retries: 0,
    reporter: 'list',
    globalSetup: './tests/e2e/global-setup.ts',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        storageState,
    },
    webServer: shouldRunSmoke ? {
        command: webServerCommand,
        cwd: projectDir,
        env: {
            ...process.env,
            PLAYWRIGHT_WEB_HOST: startHostname,
            PLAYWRIGHT_WEB_PORT: startPort,
        },
        url: `${baseURL}/api/health`,
        reuseExistingServer: true,
        timeout: 120_000,
    } : undefined,
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
