import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn((...parts: unknown[]) => parts.filter(Boolean).join(':')),
    getClientIp: vi.fn(() => '127.0.0.1'),
}));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { POST } from '@/app/api/client-events/route';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';

describe('POST /api/client-events', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (getServerSession as any).mockResolvedValue({ user: { discordId: 'user-123' } });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
    });

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api/client-events', {
        method: 'POST',
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });

    it('rate limits client event ingestion before parsing the body', async () => {
        (enforceRouteRateLimit as any).mockResolvedValue(new Response(
            JSON.stringify({ error: 'Too Many Requests' }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
        ));

        const res = await POST(createRequest('{not-json'));

        expect(res.status).toBe(429);
        expect(logError).not.toHaveBeenCalled();
        expect(logWarn).not.toHaveBeenCalled();
    });

    it('logs valid client errors with actor and page context', async () => {
        const res = await POST(createRequest({
            level: 'error',
            event: 'dashboard.finance.export.failed',
            page: '/dashboard/gang-1/finance',
            timestamp: '2026-04-25T14:00:00.000Z',
            error: { name: 'Error', message: 'Export failed' },
            context: { gangId: 'gang-1' },
        }));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ success: true });
        expect(logError).toHaveBeenCalledWith('client.error.reported', { name: 'Error', message: 'Export failed' }, expect.objectContaining({
            actorDiscordId: 'user-123',
            clientIp: '127.0.0.1',
            clientEvent: 'dashboard.finance.export.failed',
            page: '/dashboard/gang-1/finance',
            clientTimestamp: '2026-04-25T14:00:00.000Z',
            clientContext: { gangId: 'gang-1' },
        }));
    });

    it('logs warning-level client events separately', async () => {
        const res = await POST(createRequest({
            level: 'warn',
            event: 'dashboard.preview.image_failed',
            error: { message: 'preview unavailable' },
        }));

        expect(res.status).toBe(200);
        expect(logWarn).toHaveBeenCalledWith('client.warn.reported', expect.objectContaining({
            actorDiscordId: 'user-123',
            clientEvent: 'dashboard.preview.image_failed',
            warning: { message: 'preview unavailable' },
        }));
        expect(logError).not.toHaveBeenCalled();
    });

    it('rejects invalid event names', async () => {
        const res = await POST(createRequest({
            level: 'error',
            event: 'bad event name',
            error: { message: 'boom' },
        }));

        expect(res.status).toBe(400);
        expect(logError).not.toHaveBeenCalled();
    });

    it('rejects oversized payloads', async () => {
        const res = await POST(createRequest('x'.repeat(12_001)));

        expect(res.status).toBe(413);
        expect(logError).not.toHaveBeenCalled();
    });
});
