import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@gang/database', () => {
    class SubscriptionPaymentError extends Error {
        constructor(
            message: string,
            public readonly code: string,
            public readonly status = 400
        ) {
            super(message);
            this.name = 'SubscriptionPaymentError';
        }
    }

    return {
        db: {},
        listSubscriptionPaymentRequests: vi.fn(),
        approveSubscriptionPaymentRequest: vi.fn(),
        rejectSubscriptionPaymentRequest: vi.fn(),
        SubscriptionPaymentError,
    };
});
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'admin-subscription-payments:test'),
}));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
}));

import { getServerSession } from 'next-auth';
import { listSubscriptionPaymentRequests } from '@gang/database';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { GET } from '@/app/api/admin/subscription-payments/route';

describe('admin subscription payment route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_DISCORD_IDS = 'admin-123';
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'admin-123', name: 'Admin' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (listSubscriptionPaymentRequests as any).mockResolvedValue([]);
    });

    it('returns 400 for invalid status filters instead of leaking a server error', async () => {
        const request = new NextRequest('http://localhost:3000/api/admin/subscription-payments?status=NOPE');

        const response = await GET(request);

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ error: 'Invalid payment status filter' });
        expect(listSubscriptionPaymentRequests).not.toHaveBeenCalled();
    });

    it('lists payment requests for super admins with a valid optional status filter', async () => {
        const request = new NextRequest('http://localhost:3000/api/admin/subscription-payments?status=SUBMITTED');

        const response = await GET(request);

        expect(response.status).toBe(200);
        expect(listSubscriptionPaymentRequests).toHaveBeenCalledWith(expect.anything(), {
            status: 'SUBMITTED',
            limit: 100,
        });
    });
});
