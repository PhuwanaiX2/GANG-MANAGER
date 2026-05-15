import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth/jwt', () => ({
    getToken: vi.fn(),
}));

import { middleware } from '../../middleware';

describe('middleware sensitive API cache headers', () => {
    it('adds no-store to gang APIs', async () => {
        const res = await middleware(new NextRequest('http://localhost:3000/api/gangs/gang-1/finance'));

        expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    });

    it('adds no-store to admin APIs', async () => {
        const res = await middleware(new NextRequest('http://localhost:3000/api/admin/announcements'));

        expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    });

    it('does not mark public auth APIs as sensitive application data', async () => {
        const res = await middleware(new NextRequest('http://localhost:3000/api/auth/session'));

        expect(res.headers.get('Cache-Control')).toBeNull();
    });

    it('throttles repeated failed attempts against finance gang APIs by client IP', async () => {
        const headers = { 'x-forwarded-for': '203.0.113.51' };
        let res = await middleware(new NextRequest('http://localhost:3000/api/gangs/gang-1/finance', { headers }));

        for (let i = 0; i < 20; i += 1) {
            res = await middleware(new NextRequest('http://localhost:3000/api/gangs/gang-1/finance', { headers }));
        }

        expect(res.status).toBe(429);
        expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    });

    it('throttles repeated failed attempts against admin APIs by client IP', async () => {
        const headers = { 'x-forwarded-for': '203.0.113.52' };
        let res = await middleware(new NextRequest('http://localhost:3000/api/admin/announcements', { headers }));

        for (let i = 0; i < 10; i += 1) {
            res = await middleware(new NextRequest('http://localhost:3000/api/admin/announcements', { headers }));
        }

        expect(res.status).toBe(429);
        expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');
    });
});
