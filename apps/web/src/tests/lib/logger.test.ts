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
});
