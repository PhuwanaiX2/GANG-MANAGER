import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { mockRefreshFinanceDiscordPanelsForGang } = vi.hoisted(() => ({
    mockRefreshFinanceDiscordPanelsForGang: vi.fn(),
}));

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
vi.mock('@/lib/discordFinancePanels', () => ({
    refreshFinanceDiscordPanelsForGang: mockRefreshFinanceDiscordPanelsForGang,
}));

import { getServerSession } from 'next-auth';
import { approveSubscriptionPaymentRequest, listSubscriptionPaymentRequests } from '@gang/database';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { GET, PATCH } from '@/app/api/admin/subscription-payments/route';

describe('admin subscription payment route', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ADMIN_DISCORD_IDS = 'admin-123';
        (getServerSession as any).mockResolvedValue({
            user: { discordId: 'admin-123', name: 'Admin' },
        });
        (enforceRouteRateLimit as any).mockResolvedValue(null);
        (listSubscriptionPaymentRequests as any).mockResolvedValue([]);
        (approveSubscriptionPaymentRequest as any).mockResolvedValue({
            payment: {
                id: 'pay-123',
                gangId: 'gang-123',
                requestRef: 'GX-123',
                actorDiscordId: 'owner-123',
                actorName: 'Owner',
                tier: 'PREMIUM',
                billingPeriod: 'monthly',
                amount: 179,
                currency: 'THB',
                provider: 'SLIPOK',
                status: 'APPROVED',
                slipImageUrl: null,
                slipTransRef: 'bank-ref',
                verificationError: null,
                submittedAt: new Date(),
                verifiedAt: new Date(),
                approvedAt: new Date(),
                approvedById: 'admin-123',
                rejectedAt: null,
                rejectedById: null,
                reviewNotes: null,
                expiresAt: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
            },
            durationDays: 30,
            bonusDays: 0,
            expiresAt: new Date(),
        });
        mockRefreshFinanceDiscordPanelsForGang.mockResolvedValue({ updated: 2 });
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

    it('refreshes Discord finance panels after manual payment approval', async () => {
        const request = new NextRequest('http://localhost:3000/api/admin/subscription-payments', {
            method: 'PATCH',
            body: JSON.stringify({
                action: 'approve',
                paymentRequestId: 'pay-123',
                gangId: 'gang-123',
            }),
        });

        const response = await PATCH(request);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            activated: true,
            discordPanelRefresh: { updated: 2 },
        });
        expect(mockRefreshFinanceDiscordPanelsForGang).toHaveBeenCalledWith('gang-123');
    });
});
