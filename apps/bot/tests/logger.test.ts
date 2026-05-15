import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logError, logInfo } from '../src/utils/logger';

describe('bot logger', () => {
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

    it('emits structured bot info logs', () => {
        logInfo('bot.ready', { guildCount: 2 });

        expect(infoSpy).toHaveBeenCalledTimes(1);
        const payload = JSON.parse(infoSpy.mock.calls[0][0] as string);

        expect(payload).toMatchObject({
            level: 'info',
            service: 'bot',
            event: 'bot.ready',
            context: {
                guildCount: 2,
            },
        });
        expect(payload.timestamp).toEqual(expect.any(String));
    });

    it('dispatches configured bot error alerts with sanitized payloads', () => {
        process.env.ALERT_WEBHOOK_URL = 'https://alerts.example/webhook';
        process.env.ALERT_WEBHOOK_TOKEN = 'alert-token';
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 202 }));
        vi.stubGlobal('fetch', fetchMock);

        logError('bot.discord_shard_disconnected', new Error('shard disconnected'), {
            shardId: 0,
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
            service: 'bot',
            event: 'bot.discord_shard_disconnected',
            environment: expect.any(String),
            context: {
                shardId: 0,
                webhookSecret: '[REDACTED]',
            },
            error: {
                name: 'Error',
                message: 'shard disconnected',
            },
        });
    });
});
