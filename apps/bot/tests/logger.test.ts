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
        delete process.env.ALERT_WEBHOOK_FORMAT;
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

    it('formats Discord webhook bot alerts without bearer auth', () => {
        process.env.ALERT_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/discord-token';
        process.env.ALERT_WEBHOOK_TOKEN = 'alert-token';
        const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
        vi.stubGlobal('fetch', fetchMock);

        logError('bot.discord_shard_disconnected', new Error('shard disconnected'), {
            shardId: 0,
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
                    title: expect.stringContaining('BOT ERROR'),
                    color: 0xed4245,
                    fields: expect.arrayContaining([
                        { name: 'Service', value: 'bot', inline: true },
                        { name: 'Event', value: '`bot.discord_shard_disconnected`', inline: false },
                    ]),
                },
            ],
        });
        expect(JSON.stringify(payload)).toContain('[REDACTED]');
        expect(JSON.stringify(payload)).not.toContain('secret-value');
    });
});
