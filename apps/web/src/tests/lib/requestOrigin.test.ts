import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { enforceSameOriginMutationRequest } from '@/lib/requestOrigin';

function createRequest(url: string, init: RequestInit = {}) {
    return new NextRequest(url, init);
}

describe('enforceSameOriginMutationRequest', () => {
    it('ignores safe methods', () => {
        const res = enforceSameOriginMutationRequest(createRequest('http://localhost:3000/api/gangs/gang-1/finance', {
            method: 'GET',
            headers: { origin: 'https://evil.example' },
        }));

        expect(res).toBeNull();
    });

    it('rejects state-changing API requests from a foreign origin', () => {
        const res = enforceSameOriginMutationRequest(createRequest('http://localhost:3000/api/gangs/gang-1/finance', {
            method: 'POST',
            headers: { origin: 'https://evil.example' },
        }));

        expect(res?.status).toBe(403);
    });

    it('allows state-changing API requests from the same origin', () => {
        const res = enforceSameOriginMutationRequest(createRequest('http://localhost:3000/api/gangs/gang-1/finance', {
            method: 'POST',
            headers: { origin: 'http://localhost:3000' },
        }));

        expect(res).toBeNull();
    });

    it('rejects a foreign referer when origin is absent', () => {
        const res = enforceSameOriginMutationRequest(createRequest('http://localhost:3000/api/gangs/gang-1/finance/txn-1', {
            method: 'PATCH',
            headers: { referer: 'https://evil.example/form' },
        }));

        expect(res?.status).toBe(403);
    });

    it('allows requests without browser origin headers for server-to-server clients', () => {
        const res = enforceSameOriginMutationRequest(createRequest('http://localhost:3000/api/gangs/gang-1/finance', {
            method: 'POST',
        }));

        expect(res).toBeNull();
    });

    it('leaves NextAuth routes to NextAuth CSRF handling', () => {
        const res = enforceSameOriginMutationRequest(createRequest('http://localhost:3000/api/auth/signout', {
            method: 'POST',
            headers: { origin: 'https://evil.example' },
        }));

        expect(res).toBeNull();
    });
});
