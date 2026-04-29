import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

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
        db: {
            query: {
                subscriptionPaymentRequests: {
                    findFirst: vi.fn(),
                },
            },
        },
        subscriptionPaymentRequests: {
            id: 'subscription_payment_requests.id',
        },
        createSubscriptionPaymentRequest: vi.fn(),
        listSubscriptionPaymentRequests: vi.fn(),
        markSubscriptionPaymentSubmitted: vi.fn(),
        approveSubscriptionPaymentRequest: vi.fn(),
        SubscriptionPaymentError,
    };
});
vi.mock('drizzle-orm', () => ({
    eq: vi.fn(() => ({})),
}));
vi.mock('@/lib/gangAccess', () => {
    class GangAccessError extends Error {
        constructor(
            message: string,
            public readonly status: number
        ) {
            super(message);
            this.name = 'GangAccessError';
        }
    }

    return {
        GangAccessError,
        isGangAccessError: (error: unknown) => error instanceof GangAccessError,
        requireGangAccess: vi.fn(),
    };
});
vi.mock('@/lib/apiRateLimit', () => ({
    enforceRouteRateLimit: vi.fn().mockResolvedValue(null),
    buildRateLimitSubject: vi.fn(() => 'subscription-payment:test'),
}));
vi.mock('@/lib/logger', () => ({
    logError: vi.fn(),
    logWarn: vi.fn(),
}));
vi.mock('@/lib/slipOk', () => ({
    SlipOkError: class SlipOkError extends Error {
        constructor(
            message: string,
            public readonly code: string,
            public readonly status = 422
        ) {
            super(message);
            this.name = 'SlipOkError';
        }
    },
    isSlipOkAutoVerifyEnabled: vi.fn(),
    verifySlipOkSlip: vi.fn(),
}));

import {
    approveSubscriptionPaymentRequest,
    createSubscriptionPaymentRequest,
    db,
    markSubscriptionPaymentSubmitted,
} from '@gang/database';
import { requireGangAccess } from '@/lib/gangAccess';
import { isSlipOkAutoVerifyEnabled, verifySlipOkSlip } from '@/lib/slipOk';
import { POST as createPaymentRequest } from '@/app/api/gangs/[gangId]/subscription/payment-requests/route';
import { POST as submitSlip } from '@/app/api/gangs/[gangId]/subscription/payment-requests/[paymentRequestId]/slip/route';

describe('subscription payment request APIs', () => {
    const gangId = 'gang-123';
    const paymentRequestId = 'pay-123';

    const payment = {
        id: paymentRequestId,
        gangId,
        requestRef: 'GX-GANG-REF',
        tier: 'PREMIUM',
        billingPeriod: 'monthly',
        amount: 179,
        currency: 'THB',
        provider: 'PROMPTPAY_MANUAL',
        status: 'PENDING',
        slipImageUrl: null,
        verificationError: null,
        submittedAt: null,
        verifiedAt: null,
        approvedAt: null,
        rejectedAt: null,
        reviewNotes: null,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.ENABLE_PROMPTPAY_BILLING = 'true';
        process.env.PROMPTPAY_RECEIVER_NAME = 'GangX';
        process.env.PROMPTPAY_IDENTIFIER = '0812345678';
        process.env.ENABLE_SLIPOK_AUTO_VERIFY = 'false';

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: gangId },
            member: { id: 'owner-member', gangRole: 'OWNER', name: 'Owner' },
            session: { user: { discordId: 'discord-owner', name: 'Owner' } },
        });
        (createSubscriptionPaymentRequest as any).mockResolvedValue(payment);
        (markSubscriptionPaymentSubmitted as any).mockResolvedValue({
            ...payment,
            status: 'SUBMITTED',
            submittedAt: new Date(),
        });
        (approveSubscriptionPaymentRequest as any).mockResolvedValue({
            payment: {
                ...payment,
                provider: 'SLIPOK',
                status: 'APPROVED',
                approvedAt: new Date(),
            },
            durationDays: 30,
            bonusDays: 0,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
        (db as any).query.subscriptionPaymentRequests.findFirst.mockResolvedValue(payment);
        (isSlipOkAutoVerifyEnabled as any).mockReturnValue(false);
    });

    it('keeps billing closed when PromptPay billing is not explicitly enabled', async () => {
        process.env.ENABLE_PROMPTPAY_BILLING = 'false';

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
            method: 'POST',
            body: JSON.stringify({ tier: 'PREMIUM', billingPeriod: 'monthly' }),
        });
        const response = await createPaymentRequest(request, { params: { gangId } });

        expect(response.status).toBe(503);
        expect(createSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('keeps billing closed when the PromptPay receiver is not configured', async () => {
        process.env.PROMPTPAY_IDENTIFIER = '';

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
            method: 'POST',
            body: JSON.stringify({ tier: 'PREMIUM', billingPeriod: 'monthly' }),
        });
        const response = await createPaymentRequest(request, { params: { gangId } });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ error: 'PromptPay receiver is not configured' });
        expect(requireGangAccess).not.toHaveBeenCalled();
        expect(createSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('keeps billing closed when the PromptPay identifier is invalid', async () => {
        process.env.PROMPTPAY_IDENTIFIER = 'not-a-promptpay-id';

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
            method: 'POST',
            body: JSON.stringify({ tier: 'PREMIUM', billingPeriod: 'monthly' }),
        });
        const response = await createPaymentRequest(request, { params: { gangId } });

        expect(response.status).toBe(503);
        await expect(response.json()).resolves.toMatchObject({ error: 'PromptPay receiver identifier is invalid' });
        expect(requireGangAccess).not.toHaveBeenCalled();
        expect(createSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('creates a PromptPay payment request for the gang owner', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
            method: 'POST',
            body: JSON.stringify({ tier: 'PREMIUM', billingPeriod: 'monthly' }),
        });
        const response = await createPaymentRequest(request, { params: { gangId } });

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toMatchObject({
            paymentRequest: {
                id: paymentRequestId,
                amount: 179,
                status: 'PENDING',
            },
            promptPay: {
                receiverName: 'GangX',
                identifier: '0812345678',
            },
        });
        expect(createSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            gangId,
            actorDiscordId: 'discord-owner',
            tier: 'PREMIUM',
            billingPeriod: 'monthly',
        }));
    });

    it('submits slips for manual review when SlipOK auto verify is disabled', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: 'https://cdn.discordapp.com/slip.png' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(202);
        expect(verifySlipOkSlip).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(markSubscriptionPaymentSubmitted).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            provider: 'PROMPTPAY_MANUAL',
            slipImageUrl: 'https://cdn.discordapp.com/slip.png',
        }));
    });

    it('keeps slip submission closed while PromptPay billing is disabled', async () => {
        process.env.ENABLE_PROMPTPAY_BILLING = 'false';

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ payload: '0002010102123456' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(503);
        expect(requireGangAccess).not.toHaveBeenCalled();
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('rejects slip submissions that provide both payload and image URL', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({
                payload: '0002010102123456',
                imageUrl: 'https://cdn.discordapp.com/slip.png',
            }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(400);
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('auto-approves only after SlipOK verification succeeds', async () => {
        (isSlipOkAutoVerifyEnabled as any).mockReturnValue(true);
        (verifySlipOkSlip as any).mockResolvedValue({
            amount: 179,
            transRef: 'BANK-TRANS-123',
        });
        (markSubscriptionPaymentSubmitted as any).mockResolvedValue({
            ...payment,
            provider: 'SLIPOK',
            status: 'VERIFIED',
            verifiedAt: new Date(),
        });

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ payload: '0002010102123456' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ activated: true, durationDays: 30 });
        expect(verifySlipOkSlip).toHaveBeenCalledWith(expect.objectContaining({
            payload: '0002010102123456',
        }), 179);
        expect(markSubscriptionPaymentSubmitted).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            provider: 'SLIPOK',
            status: 'VERIFIED',
            slipTransRef: 'BANK-TRANS-123',
        }));
        expect(approveSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            actorDiscordId: 'slipok:auto',
        }));
    });
});
