import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
    consumeRateLimit: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('@gang/database', () => ({
    consumeRateLimit: mocks.consumeRateLimit,
    db: {},
}));

vi.mock('@/lib/logger', () => ({
    logError: mocks.logError,
}));

import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

function request() {
    return new NextRequest('http://localhost:3000/api/gangs/gang-1/finance', {
        headers: { 'x-real-ip': '127.0.0.1' },
    });
}

describe('enforceRouteRateLimit', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('allows requests when the counter is under limit', async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: true,
            count: 1,
            limit: 5,
            remaining: 4,
            resetAt: new Date('2026-05-14T00:01:00.000Z'),
            retryAfterSeconds: 0,
        });

        const res = await enforceRouteRateLimit(request(), {
            scope: 'api:finance:create',
            limit: 5,
            windowMs: 60_000,
        });

        expect(res).toBeNull();
    });

    it('returns 429 when the counter is over limit', async () => {
        mocks.consumeRateLimit.mockResolvedValue({
            allowed: false,
            count: 6,
            limit: 5,
            remaining: 0,
            resetAt: new Date('2026-05-14T00:01:00.000Z'),
            retryAfterSeconds: 11,
        });

        const res = await enforceRouteRateLimit(request(), {
            scope: 'api:finance:create',
            limit: 5,
            windowMs: 60_000,
        });

        expect(res?.status).toBe(429);
        expect(res?.headers.get('Retry-After')).toBe('11');
    });

    it('fails closed for finance/admin critical scopes when the counter service fails', async () => {
        mocks.consumeRateLimit.mockRejectedValue(new Error('rate db unavailable'));

        const financeRes = await enforceRouteRateLimit(request(), {
            scope: 'api:finance:create',
            limit: 5,
            windowMs: 60_000,
        });

        const adminRes = await enforceRouteRateLimit(request(), {
            scope: 'api:admin:licenses:post',
            limit: 5,
            windowMs: 60_000,
        });

        expect(financeRes?.status).toBe(503);
        await expect(financeRes?.json()).resolves.toMatchObject({
            error: 'Rate limit service unavailable. Please retry shortly.',
        });
        expect(adminRes?.status).toBe(503);
        expect(mocks.logError).toHaveBeenCalledWith(
            'api.rate_limit.failed',
            expect.any(Error),
            expect.objectContaining({ scope: 'api:finance:create' })
        );
    });

    it('keeps non-critical telemetry fail-open to avoid blocking client logging', async () => {
        mocks.consumeRateLimit.mockRejectedValue(new Error('rate db unavailable'));

        const res = await enforceRouteRateLimit(request(), {
            scope: 'api:client-events',
            limit: 60,
            windowMs: 60_000,
        });

        expect(res).toBeNull();
    });
});
