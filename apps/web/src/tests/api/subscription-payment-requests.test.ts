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
        reconcileSubscriptionPaymentRequestsForGang: vi.fn(),
        markSubscriptionPaymentSubmitted: vi.fn(),
        approveSubscriptionPaymentRequest: vi.fn(),
        rejectSubscriptionPaymentRequest: vi.fn(),
        cancelSubscriptionPaymentRequest: vi.fn(),
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
    isSlipOkDefinitiveRejection: vi.fn((error: any) => error?.name === 'SlipOkError' && [
        'INVALID_SLIP_PAYLOAD',
        'INVALID_SLIP_FILE',
        'INVALID_SLIP_IMAGE',
        'MISSING_SLIP_QR',
        'UNSUPPORTED_SLIP_QR',
        'SLIP_NOT_FOUND_OR_EXPIRED',
        'AMOUNT_MISMATCH',
        'ACCOUNT_MISMATCH',
        'DUPLICATE_SLIP',
        'SLIPOK_MISSING_TRANS_REF',
    ].includes(error.code)),
    verifySlipOkSlip: vi.fn(),
}));
vi.mock('@/lib/billingRuntimeFlags', () => ({
    isPromptPayBillingRuntimeEnabled: vi.fn(),
    isSlipOkAutoVerifyRuntimeEnabled: vi.fn(),
}));

import {
    approveSubscriptionPaymentRequest,
    createSubscriptionPaymentRequest,
    db,
    listSubscriptionPaymentRequests,
    reconcileSubscriptionPaymentRequestsForGang,
    markSubscriptionPaymentSubmitted,
    rejectSubscriptionPaymentRequest,
    cancelSubscriptionPaymentRequest,
    SubscriptionPaymentError,
} from '@gang/database';
import { requireGangAccess } from '@/lib/gangAccess';
import { SlipOkError, verifySlipOkSlip } from '@/lib/slipOk';
import { isPromptPayBillingRuntimeEnabled, isSlipOkAutoVerifyRuntimeEnabled } from '@/lib/billingRuntimeFlags';
import { GET as listPaymentRequests, POST as createPaymentRequest } from '@/app/api/gangs/[gangId]/subscription/payment-requests/route';
import { DELETE as cancelPaymentRequest } from '@/app/api/gangs/[gangId]/subscription/payment-requests/[paymentRequestId]/route';
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
        process.env.CLOUDINARY_CLOUD_NAME = 'gangx';
        delete process.env.TRUSTED_SLIP_IMAGE_HOSTS;

        (requireGangAccess as any).mockResolvedValue({
            gang: { id: gangId },
            member: { id: 'owner-member', gangRole: 'OWNER', name: 'Owner' },
            session: { user: { discordId: 'discord-owner', name: 'Owner' } },
        });
        (createSubscriptionPaymentRequest as any).mockResolvedValue({ payment, reused: false });
        (listSubscriptionPaymentRequests as any).mockResolvedValue([payment]);
        (reconcileSubscriptionPaymentRequestsForGang as any).mockResolvedValue({ activePayment: payment });
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
        (rejectSubscriptionPaymentRequest as any).mockResolvedValue({
            ...payment,
            provider: 'SLIPOK',
            status: 'REJECTED',
            rejectedAt: new Date(),
            reviewNotes: 'Slip amount does not match',
        });
        (cancelSubscriptionPaymentRequest as any).mockResolvedValue({
            ...payment,
            status: 'CANCELLED',
            reviewNotes: 'ยกเลิกบิลโดยผู้ใช้ก่อนส่งสลิป',
        });
        (db as any).query.subscriptionPaymentRequests.findFirst.mockResolvedValue(payment);
        (isPromptPayBillingRuntimeEnabled as any).mockResolvedValue(true);
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(false);
    });

    it('keeps billing closed when PromptPay billing is not explicitly enabled', async () => {
        process.env.ENABLE_PROMPTPAY_BILLING = 'false';
        (isPromptPayBillingRuntimeEnabled as any).mockResolvedValue(false);

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

    it('lists payment requests with reusable PromptPay details for an active request', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
            method: 'GET',
        });
        const response = await listPaymentRequests(request, { params: { gangId } });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            paymentRequests: [
                {
                    id: paymentRequestId,
                    status: 'PENDING',
                    requestRef: 'GX-GANG-REF',
                },
            ],
            promptPay: {
                receiverName: 'GangX',
                identifier: '0812345678',
            },
        });
        expect(listSubscriptionPaymentRequests).toHaveBeenCalledWith(expect.anything(), {
            gangId,
            limit: 50,
        });
        expect(reconcileSubscriptionPaymentRequestsForGang).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            gangId,
            actorDiscordId: 'discord-owner',
        }));
    });

    it('reuses an existing open bill instead of creating duplicate active payment requests', async () => {
        (createSubscriptionPaymentRequest as any).mockResolvedValue({ payment, reused: true });

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
            method: 'POST',
            body: JSON.stringify({ tier: 'PREMIUM', billingPeriod: 'monthly' }),
        });
        const response = await createPaymentRequest(request, { params: { gangId } });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            reused: true,
            blockedByReview: false,
            paymentRequest: {
                id: paymentRequestId,
                status: 'PENDING',
            },
        });
    });

    it('submits slips for manual review when SlipOK auto verify is disabled', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: 'https://res.cloudinary.com/gangx/image/upload/v1/payment-slips/slip.png' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(202);
        expect(verifySlipOkSlip).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(markSubscriptionPaymentSubmitted).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            provider: 'PROMPTPAY_MANUAL',
            slipImageUrl: 'https://res.cloudinary.com/gangx/image/upload/v1/payment-slips/slip.png',
        }));
    });

    it('allows Discord and Facebook CDN slip image URLs without extra env', async () => {
        const imageUrls = [
            'https://cdn.discordapp.com/attachments/123/456/slip.png',
            'https://scontent.fbkk12-4.fna.fbcdn.net/v/t39.30808-6/slip.jpg',
        ];

        for (const imageUrl of imageUrls) {
            const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
                method: 'POST',
                body: JSON.stringify({ imageUrl }),
            });
            const response = await submitSlip(request, { params: { gangId, paymentRequestId } });
            expect(response.status).toBe(202);
        }

        expect(markSubscriptionPaymentSubmitted).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            slipImageUrl: imageUrls[0],
        }));
        expect(markSubscriptionPaymentSubmitted).toHaveBeenNthCalledWith(2, expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            slipImageUrl: imageUrls[1],
        }));
    });

    it('rejects arbitrary external slip image URLs before saving or verifying', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: 'https://example.com/slip.png' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({
            error: 'Slip image URL must be an HTTPS image URL from Cloudinary, Discord, Facebook CDN, or a trusted payment evidence host',
        });
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
        expect(verifySlipOkSlip).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('allows explicitly configured trusted slip image hosts', async () => {
        process.env.TRUSTED_SLIP_IMAGE_HOSTS = 'pay-cdn.example.com';
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: 'https://pay-cdn.example.com/slips/slip.png' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(202);
        expect(markSubscriptionPaymentSubmitted).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            slipImageUrl: 'https://pay-cdn.example.com/slips/slip.png',
        }));
    });

    it('allows configured wildcard trusted slip image hosts', async () => {
        process.env.TRUSTED_SLIP_IMAGE_HOSTS = '*.pay-cdn.example.com';
        const imageUrl = 'https://tenant.pay-cdn.example.com/slips/slip.png';
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(202);
        expect(markSubscriptionPaymentSubmitted).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            slipImageUrl: imageUrl,
        }));
    });

    it('keeps slip submission closed while PromptPay billing is disabled', async () => {
        process.env.ENABLE_PROMPTPAY_BILLING = 'false';
        (isPromptPayBillingRuntimeEnabled as any).mockResolvedValue(false);

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
                imageUrl: 'https://res.cloudinary.com/gangx/image/upload/v1/payment-slips/slip.png',
            }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(400);
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
    });

    it('auto-approves only after SlipOK verification succeeds', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
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

    it('covers the enabled paid billing API flow from request to verified approval', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
        (verifySlipOkSlip as any).mockResolvedValue({
            amount: 179,
            transRef: 'BANK-TRANS-123',
        });
        (markSubscriptionPaymentSubmitted as any).mockResolvedValue({
            ...payment,
            provider: 'SLIPOK',
            status: 'VERIFIED',
            verifiedAt: new Date(),
            slipTransRef: 'BANK-TRANS-123',
        });

        const createResponse = await createPaymentRequest(
            new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
                method: 'POST',
                body: JSON.stringify({ tier: 'PREMIUM', billingPeriod: 'monthly' }),
            }),
            { params: { gangId } }
        );
        expect(createResponse.status).toBe(201);

        const listResponse = await listPaymentRequests(
            new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests`, {
                method: 'GET',
            }),
            { params: { gangId } }
        );
        expect(listResponse.status).toBe(200);

        const submitResponse = await submitSlip(
            new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
                method: 'POST',
                body: JSON.stringify({ payload: '0002010102123456' }),
            }),
            { params: { gangId, paymentRequestId } }
        );
        expect(submitResponse.status).toBe(200);
        await expect(submitResponse.json()).resolves.toMatchObject({
            activated: true,
            durationDays: 30,
            paymentRequest: {
                status: 'APPROVED',
            },
        });

        expect(createSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            gangId,
            tier: 'PREMIUM',
            billingPeriod: 'monthly',
        }));
        expect(listSubscriptionPaymentRequests).toHaveBeenCalledWith(expect.anything(), { gangId, limit: 50 });
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

    it('rejects invalid SlipOK results instead of sending them to manual review', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
        (verifySlipOkSlip as any).mockRejectedValue(
            new SlipOkError('ยอดเงินในสลิปไม่ตรงกับรายการชำระเงิน', 'AMOUNT_MISMATCH', 422)
        );

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ payload: '0002010102123456' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(422);
        const json = await response.json();
        expect(json).toMatchObject({
            rejected: true,
            paymentRequest: {
                status: 'REJECTED',
            },
            code: 'AMOUNT_MISMATCH',
        });
        expect(json.manualReviewRequired).toBeUndefined();
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(rejectSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            actorDiscordId: 'slipok:auto',
        }));
    });

    it('rejects expired or not-yet-found QR slips instead of leaving the bill pending', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
        (verifySlipOkSlip as any).mockRejectedValue(
            new SlipOkError('QR Code expired or transaction was not found', 'SLIP_NOT_FOUND_OR_EXPIRED', 422)
        );

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ payload: '0002010102123456' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(422);
        await expect(response.json()).resolves.toMatchObject({
            rejected: true,
            code: 'SLIP_NOT_FOUND_OR_EXPIRED',
            paymentRequest: {
                status: 'REJECTED',
            },
        });
        expect(rejectSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            provider: 'SLIPOK',
            verificationError: 'ระบบตรวจอัตโนมัติยืนยันรายการโอนนี้ไม่ได้ รายการถูกปฏิเสธแล้ว กรุณาสร้างบิลใหม่ก่อนส่งหลักฐานอีกครั้ง',
        }));
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
    });

    it('rejects account mismatch slips so the current bill does not stay pending', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
        (verifySlipOkSlip as any).mockRejectedValue(
            new SlipOkError('Receiver account does not match', 'ACCOUNT_MISMATCH', 422)
        );

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ imageUrl: 'https://cdn.discordapp.com/attachments/123/456/slip.png' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(422);
        await expect(response.json()).resolves.toMatchObject({
            rejected: true,
            code: 'ACCOUNT_MISMATCH',
            paymentRequest: {
                status: 'REJECTED',
            },
        });
        expect(rejectSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            provider: 'SLIPOK',
            slipImageUrl: 'https://cdn.discordapp.com/attachments/123/456/slip.png',
            verificationError: 'บัญชีผู้รับเงินในสลิปไม่ตรงกับบัญชีตรวจอัตโนมัติ รายการถูกปฏิเสธแล้ว กรุณาตรวจบัญชีผู้รับและสร้างบิลใหม่',
        }));
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(markSubscriptionPaymentSubmitted).not.toHaveBeenCalled();
    });

    it('rejects duplicate bank references instead of leaving the bill in review', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
        (verifySlipOkSlip as any).mockResolvedValue({
            amount: 179,
            transRef: 'BANK-TRANS-USED',
        });
        (markSubscriptionPaymentSubmitted as any).mockRejectedValue(
            new SubscriptionPaymentError('Duplicate slip reference', 'DUPLICATE_SLIP', 409)
        );

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ payload: '0002010102123456' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toMatchObject({
            rejected: true,
            code: 'DUPLICATE_SLIP',
            paymentRequest: {
                status: 'REJECTED',
            },
        });
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(rejectSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            provider: 'SLIPOK',
            slipTransRef: 'BANK-TRANS-USED',
            verificationError: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว กรุณาสร้างบิลใหม่และใช้สลิปที่ยังไม่เคยส่ง',
        }));
    });

    it('lets owners cancel a pending payment request before slip submission', async () => {
        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}`, {
            method: 'DELETE',
        });

        const response = await cancelPaymentRequest(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            paymentRequest: {
                id: paymentRequestId,
                status: 'CANCELLED',
            },
        });
        expect(cancelSubscriptionPaymentRequest).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            paymentRequestId,
            gangId,
            actorDiscordId: 'discord-owner',
            actorName: 'Owner',
        }));
    });

    it('keeps provider-outage SlipOK results in manual review instead of auto-rejecting', async () => {
        (isSlipOkAutoVerifyRuntimeEnabled as any).mockResolvedValue(true);
        (verifySlipOkSlip as any).mockRejectedValue(
            new SlipOkError('Bank verification is temporarily delayed', 'BANK_DELAY', 429)
        );

        const request = new NextRequest(`http://localhost/api/gangs/${gangId}/subscription/payment-requests/${paymentRequestId}/slip`, {
            method: 'POST',
            body: JSON.stringify({ payload: '0002010102123456' }),
        });
        const response = await submitSlip(request, { params: { gangId, paymentRequestId } });

        expect(response.status).toBe(202);
        await expect(response.json()).resolves.toMatchObject({
            manualReviewRequired: true,
            paymentRequest: {
                status: 'SUBMITTED',
            },
        });
        expect(rejectSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(approveSubscriptionPaymentRequest).not.toHaveBeenCalled();
        expect(markSubscriptionPaymentSubmitted).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            provider: 'SLIPOK',
            verificationError: 'Bank verification is temporarily delayed',
        }));
    });
});
