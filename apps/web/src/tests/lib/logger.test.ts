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
});
