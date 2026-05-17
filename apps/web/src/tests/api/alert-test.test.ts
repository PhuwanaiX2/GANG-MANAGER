import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
}));

import { POST } from '@/app/api/ops/alert-test/route';
import { logError } from '@/lib/logger';

describe('POST /api/ops/alert-test', () => {
    const token = 'alert-test-token-at-least-16-chars';

    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.ALERT_TEST_TOKEN;
        delete process.env.ALERT_WEBHOOK_URL;
    });

    function createRequest(headers?: Record<string, string>) {
        return new NextRequest('http://localhost:3000/api/ops/alert-test', {
            method: 'POST',
            headers,
        });
    }

    it('stays disabled when ALERT_TEST_TOKEN is not configured', async () => {
        const response = await POST(createRequest({ authorization: `Bearer ${token}` }));

        expect(response.status).toBe(404);
        expect(logError).not.toHaveBeenCalled();
    });

    it('uses ALERT_WEBHOOK_URL as the fallback test token', async () => {
        const webhookUrl = 'https://discord.com/api/webhooks/123/secret';
        process.env.ALERT_WEBHOOK_URL = webhookUrl;

        const response = await POST(createRequest({ authorization: `Bearer ${webhookUrl}` }));

        expect(response.status).toBe(200);
        expect(logError).toHaveBeenCalledWith(
            'manual.alert_test',
            expect.any(Error),
            expect.objectContaining({ source: 'web-alert-test-endpoint' })
        );
    });

    it('rejects requests without the alert test token', async () => {
        process.env.ALERT_TEST_TOKEN = token;

        const response = await POST(createRequest());

        expect(response.status).toBe(401);
        expect(logError).not.toHaveBeenCalled();
    });

    it('rejects requests with the wrong alert test token', async () => {
        process.env.ALERT_TEST_TOKEN = token;

        const response = await POST(createRequest({ authorization: 'Bearer wrong-token' }));

        expect(response.status).toBe(401);
        expect(logError).not.toHaveBeenCalled();
    });

    it('dispatches a protected web alert test', async () => {
        process.env.ALERT_TEST_TOKEN = token;

        const response = await POST(createRequest({ authorization: `Bearer ${token}` }));
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
            success: true,
            app: 'web',
            event: 'manual.alert_test',
        });
        expect(logError).toHaveBeenCalledWith(
            'manual.alert_test',
            expect.any(Error),
            expect.objectContaining({ source: 'web-alert-test-endpoint' })
        );
    });
});
