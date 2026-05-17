import http from 'http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger', () => ({
    logError: vi.fn(),
}));

import { maybeHandleAlertTestRequest } from '../src/utils/alertTestEndpoint';
import { logError } from '../src/utils/logger';

describe('bot alert test endpoint', () => {
    const token = 'alert-test-token-at-least-16-chars';
    let server: http.Server | null = null;
    let baseUrl = '';

    beforeEach(async () => {
        vi.clearAllMocks();
        delete process.env.ALERT_TEST_TOKEN;
        delete process.env.ALERT_WEBHOOK_URL;
        await startServer();
    });

    afterEach(async () => {
        await stopServer();
        delete process.env.ALERT_TEST_TOKEN;
    });

    async function startServer() {
        server = http.createServer((req, res) => {
            if (maybeHandleAlertTestRequest(req, res)) {
                return;
            }

            res.writeHead(418, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'fallback' }));
        });

        await new Promise<void>((resolve) => {
            server!.listen(0, '127.0.0.1', resolve);
        });

        const address = server.address();
        if (!address || typeof address === 'string') {
            throw new Error('Failed to start test server');
        }
        baseUrl = `http://127.0.0.1:${address.port}`;
    }

    async function stopServer() {
        if (!server) {
            return;
        }
        await new Promise<void>((resolve, reject) => {
            server!.close((error) => error ? reject(error) : resolve());
        });
        server = null;
    }

    it('stays disabled when ALERT_TEST_TOKEN is not configured', async () => {
        const response = await fetch(`${baseUrl}/alert-test`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
        });

        expect(response.status).toBe(404);
        expect(logError).not.toHaveBeenCalled();
    });

    it('uses ALERT_WEBHOOK_URL as the fallback test token', async () => {
        const webhookUrl = 'https://discord.com/api/webhooks/123/secret';
        process.env.ALERT_WEBHOOK_URL = webhookUrl;

        const response = await fetch(`${baseUrl}/alert-test`, {
            method: 'POST',
            headers: { authorization: `Bearer ${webhookUrl}` },
        });

        expect(response.status).toBe(200);
        expect(logError).toHaveBeenCalledWith(
            'manual.alert_test',
            expect.any(Error),
            expect.objectContaining({ source: 'bot-alert-test-endpoint' })
        );
    });

    it('rejects requests without the alert test token', async () => {
        process.env.ALERT_TEST_TOKEN = token;

        const response = await fetch(`${baseUrl}/alert-test`, { method: 'POST' });

        expect(response.status).toBe(401);
        expect(logError).not.toHaveBeenCalled();
    });

    it('rejects requests with the wrong alert test token', async () => {
        process.env.ALERT_TEST_TOKEN = token;

        const response = await fetch(`${baseUrl}/alert-test`, {
            method: 'POST',
            headers: { authorization: 'Bearer wrong-token' },
        });

        expect(response.status).toBe(401);
        expect(logError).not.toHaveBeenCalled();
    });

    it('dispatches a protected bot alert test', async () => {
        process.env.ALERT_TEST_TOKEN = token;

        const response = await fetch(`${baseUrl}/alert-test`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}` },
        });
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
            success: true,
            app: 'bot',
            event: 'manual.alert_test',
        });
        expect(logError).toHaveBeenCalledWith(
            'manual.alert_test',
            expect.any(Error),
            expect.objectContaining({ source: 'bot-alert-test-endpoint' })
        );
    });

    it('does not intercept other health server paths', async () => {
        const response = await fetch(`${baseUrl}/health`);
        const json = await response.json();

        expect(response.status).toBe(418);
        expect(json).toEqual({ error: 'fallback' });
    });
});
