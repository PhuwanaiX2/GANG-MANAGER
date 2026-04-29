import path from 'node:path';
import { loadEnvConfig } from '@next/env';
import { defineConfig, devices } from '@playwright/test';

const projectDir = __dirname;

loadEnvConfig(projectDir);

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
