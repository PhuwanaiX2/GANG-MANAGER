import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo } from '@/lib/logger';

describe('web logger', () => {
    let infoSpy: ReturnType<typeof vi.spyOn>;
    let errorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        infoSpy.mockRestore();
        errorSpy.mockRestore();
        delete process.env.ALERT_WEBHOOK_URL;
        delete process.env.ALERT_WEBHOOK_TOKEN;
        delete process.env.ALERT_WEBHOOK_FORMAT;
        vi.unstubAllGlobals();
    });

    it('emits structured info logs', () => {
        logInfo('audit.checkpoint', {
            gangId: 'gang-123',
            actorDiscordId: 'user-123',
        });

        expect(infoSpy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);

        expect(payload).toMatchObject({
            level: 'info',
            service: 'web',
            event: 'audit.checkpoint',
            context: {
                gangId: 'gang-123',
                actorDiscordId: 'user-123',
            },
        });
        expect(payload.timestamp).toEqual(expect.any(String));
    });

    it('redacts sensitive keys and serializes errors safely', () => {
        logError('api.failed', new Error('boom'), {
            authorization: 'Bearer secret-token',
            nested: {
                webhookSecret: 'whsec_123',
                safe: 'visible',
            },
        });

        expect(errorSpy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(errorSpy.mock.calls[0][0] as string);

        expect(payload).toMatchObject({
            level: 'error',
            service: 'web',
            event: 'api.failed',
            context: {
                authorization: '[REDACTED]',
                nested: {
                    webhookSecret: '[REDACTED]',
                    safe: 'visible',
                },
            },
            error: {
                name: 'Error',
                message: 'boom',
            },
        });
    });

    it('dispatches configured error alerts with sanitized payloads', () => {
        process.env.ALERT_WEBHOOK_URL = 'https://alerts.example/webhook';
        process.env.ALERT_WEBHOOK_TOKEN = 'alert-token';
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
        vi.stubGlobal('fetch', fetchMock);

        logError('api.admin.subscription_payments.patch.failed', new Error('payment review failed'), {
            paymentRequestId: 'payment-1',
            webhookSecret: 'secret-value',
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [, init] = fetchMock.mock.calls[0];
        expect(init).toMatchObject({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer alert-token',
            },
        });

        const payload = JSON.parse(init.body as string);
        expect(payload).toMatchObject({
            level: 'error',
            service: 'web',
            event: 'api.admin.subscription_payments.patch.failed',
            environment: expect.any(String),
            context: {
                paymentRequestId: 'payment-1',
                webhookSecret: '[REDACTED]',
            },
            error: {
                name: 'Error',
                message: 'payment review failed',
            },
        });
    });

    it('formats Discord webhook alerts without bearer auth', () => {
        process.env.ALERT_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/discord-token';
        process.env.ALERT_WEBHOOK_TOKEN = 'alert-token';
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        logError('api.admin.subscription_payments.patch.failed', new Error('payment review failed'), {
            paymentRequestId: 'payment-1',
            webhookSecret: 'secret-value',
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://discord.com/api/webhooks/123/discord-token');
        expect(init).toMatchObject({
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        expect((init.headers as Record<string, string>).Authorization).toBeUndefined();

        const payload = JSON.parse(init.body as string);
        expect(payload).toMatchObject({
            username: 'Gang Manager Alerts',
            embeds: [
                {
                    title: expect.stringContaining('WEB ERROR'),
                    color: 0xed4245,
                    fields: expect.arrayContaining([
                        { name: 'Service', value: 'web', inline: true },
                        { name: 'Event', value: '`api.admin.subscription_payments.patch.failed`', inline: false },
                    ]),
                },
            ],
        });
        expect(JSON.stringify(payload)).toContain('[REDACTED]');
        expect(JSON.stringify(payload)).not.toContain('secret-value');
    });
});
