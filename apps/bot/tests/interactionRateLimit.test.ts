import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('@gang/database', () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    db: {},
}));

vi.mock('../src/utils/logger', () => ({
    logError: mocks.logError,
}));

import { checkInteractionRateLimit } from '../src/utils/interactionRateLimit';

describe('checkInteractionRateLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns the durable rate limit result when the counter works', async () => {
        const result = {
            allowed: true,
            count: 1,
            limit: 5,
            remaining: 4,
            resetAt: new Date('2026-05-14T00:00:10.000Z'),
            retryAfterSeconds: 0,
        };
        mocks.consumeRateLimit.mockResolvedValue(result);

        await expect(checkInteractionRateLimit('discord-1')).resolves.toBe(result);
    });

    it('fails closed when the durable counter is unavailable', async () => {
        mocks.consumeRateLimit.mockRejectedValue(new Error('rate db unavailable'));

        const result = await checkInteractionRateLimit('discord-1');

        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
        expect(result.retryAfterSeconds).toBe(5);
        expect(mocks.logError).toHaveBeenCalledWith(
            'bot.rate_limit.failed',
            expect.any(Error),
            expect.objectContaining({ userId: 'discord-1' })
        );
    });
});
