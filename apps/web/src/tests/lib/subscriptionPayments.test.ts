import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    approveSubscriptionPaymentRequest,
    calculateStackedSubscriptionExpiry,
    rejectSubscriptionPaymentRequest,
    SubscriptionPaymentError,
} from '@gang/database';

function createApprovalHarness(
    paymentOverrides: Record<string, unknown> = {},
    gangOverrides: Record<string, unknown> = {}
) {
    const payment = {
        id: 'payment-1',
        gangId: 'gang-1',
        requestRef: 'GX-GANG-1',
        tier: 'PREMIUM',
        billingPeriod: 'monthly',
        amount: 179,
        currency: 'THB',
        provider: 'SLIPOK',
        status: 'REJECTED',
        slipPayload: null,
        slipImageUrl: 'https://cdn.discordapp.com/slip.png',
        slipTransRef: 'bank-trans-ref',
        submittedAt: new Date('2026-05-19T12:00:00.000Z'),
        expiresAt: new Date('2020-01-01T00:00:00.000Z'),
        reviewNotes: 'Auto verification could not confirm receiver account',
        approvedAt: null,
        ...paymentOverrides,
    };
    const gang = {
        id: 'gang-1',
        subscriptionTier: 'FREE',
        subscriptionExpiresAt: null,
        ...gangOverrides,
    };
    const updateCalls: Record<string, unknown>[] = [];
    const auditCalls: Record<string, unknown>[] = [];

    const tx = {
        query: {
            subscriptionPaymentRequests: {
                findFirst: vi.fn(async () => payment),
            },
            gangs: {
                findFirst: vi.fn(async () => gang),
            },
        },
        update: vi.fn(() => ({
            set: (values: Record<string, unknown>) => ({
                where: vi.fn(async () => {
                    updateCalls.push(values);
                    if ('status' in values) Object.assign(payment, values);
                    if ('subscriptionTier' in values) Object.assign(gang, values);
                }),
            }),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(async (values: Record<string, unknown>) => {
                auditCalls.push(values);
            }),
        })),
    };

    const db = {
        transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    return { db, payment, gang, updateCalls, auditCalls };
}

function createRejectionHarness(options: {
    paymentOverrides?: Record<string, unknown>;
    duplicateSlipRef?: string;
} = {}) {
    const payment = {
        id: 'payment-1',
        gangId: 'gang-1',
        requestRef: 'GX-GANG-1',
        tier: 'PREMIUM',
        billingPeriod: 'monthly',
        amount: 179,
        currency: 'THB',
        provider: 'PROMPTPAY_MANUAL',
        status: 'PENDING',
        slipPayload: null,
        slipImageUrl: null,
        slipTransRef: null,
        submittedAt: null,
        providerResponse: null,
        verificationError: null,
        reviewNotes: null,
        ...options.paymentOverrides,
    };
    const updateCalls: Record<string, unknown>[] = [];
    const auditCalls: Record<string, unknown>[] = [];
    const duplicatePayment = options.duplicateSlipRef
        ? { id: 'payment-already-used', slipTransRef: options.duplicateSlipRef }
        : null;

    const db = {
        query: {
            subscriptionPaymentRequests: {
                findFirst: vi.fn()
                    .mockResolvedValueOnce(payment)
                    .mockResolvedValueOnce(duplicatePayment)
                    .mockImplementation(async () => payment),
            },
        },
        update: vi.fn(() => ({
            set: (values: Record<string, unknown>) => ({
                where: vi.fn(async () => {
                    updateCalls.push(values);
                    Object.assign(payment, values);
                }),
            }),
        })),
        insert: vi.fn(() => ({
            values: vi.fn(async (values: Record<string, unknown>) => {
                auditCalls.push(values);
            }),
        })),
    };

    return { db, payment, updateCalls, auditCalls };
}

describe('subscription payment approval recovery', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows admin approval for a rejected payment that still has slip evidence', async () => {
        const { db, payment, gang, updateCalls, auditCalls } = createApprovalHarness();

        const result = await approveSubscriptionPaymentRequest(db, {
            paymentRequestId: payment.id,
            gangId: payment.gangId,
            actorDiscordId: 'admin-1',
            actorName: 'Admin',
            reviewNotes: 'เงินจริงเข้าแล้ว อนุมัติจากหลังบ้าน',
        });

        expect(result.payment.status).toBe('APPROVED');
        expect(gang.subscriptionTier).toBe('PREMIUM');
        expect(updateCalls).toEqual(expect.arrayContaining([
            expect.objectContaining({ subscriptionTier: 'PREMIUM' }),
            expect.objectContaining({ status: 'APPROVED', approvedById: 'admin-1' }),
        ]));
        expect(auditCalls).toEqual(expect.arrayContaining([
            expect.objectContaining({ action: 'SUBSCRIPTION_PAYMENT_APPROVE' }),
        ]));
    });

    it('stacks remaining Trial days when upgrading to Premium', async () => {
        const trialExpiresAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
        const { db, payment, auditCalls } = createApprovalHarness({}, {
            subscriptionTier: 'TRIAL',
            subscriptionExpiresAt: trialExpiresAt,
        });

        const result = await approveSubscriptionPaymentRequest(db, {
            paymentRequestId: payment.id,
            gangId: payment.gangId,
            actorDiscordId: 'admin-1',
            actorName: 'Admin',
        });

        expect(result.bonusDays).toBeGreaterThanOrEqual(4);
        expect(result.durationDays).toBeGreaterThan(30);
        expect(auditCalls).toEqual(expect.arrayContaining([
            expect.objectContaining({
                details: expect.stringContaining('"bonusDays"'),
            }),
        ]));
    });

    it('adds purchased time on top of the exact current expiry instead of rounding from now', () => {
        const now = new Date('2026-05-20T12:00:00.000Z');
        const currentExpiry = new Date('2026-06-03T18:30:00.000Z');

        const stacked = calculateStackedSubscriptionExpiry({
            currentTier: 'TRIAL',
            currentExpiry,
            billing: 'monthly',
            now,
        });

        expect(stacked.bonusDays).toBe(15);
        expect(stacked.durationDays).toBe(45);
        expect(stacked.expiresAt.toISOString()).toBe('2026-07-03T18:30:00.000Z');
    });

    it('stacks a monthly payment into 37 days when a 7 day trial is still active', () => {
        const now = new Date('2026-05-20T12:00:00.000Z');
        const currentExpiry = new Date('2026-05-27T12:00:00.000Z');

        const stacked = calculateStackedSubscriptionExpiry({
            currentTier: 'TRIAL',
            currentExpiry,
            billing: 'monthly',
            now,
        });

        expect(stacked.bonusDays).toBe(7);
        expect(stacked.durationDays).toBe(37);
        expect(stacked.expiresAt.toISOString()).toBe('2026-06-26T12:00:00.000Z');
    });

    it('stacks a monthly payment into 44 days when 14 premium days remain', () => {
        const now = new Date('2026-05-20T12:00:00.000Z');
        const currentExpiry = new Date('2026-06-03T12:00:00.000Z');

        const stacked = calculateStackedSubscriptionExpiry({
            currentTier: 'PREMIUM',
            currentExpiry,
            billing: 'monthly',
            now,
        });

        expect(stacked.bonusDays).toBe(14);
        expect(stacked.durationDays).toBe(44);
        expect(stacked.expiresAt.toISOString()).toBe('2026-07-03T12:00:00.000Z');
    });

    it('keeps rejected payments without evidence locked from manual approval', async () => {
        const { db, payment, updateCalls } = createApprovalHarness({
            slipPayload: null,
            slipImageUrl: null,
            slipTransRef: null,
            submittedAt: null,
        });

        await expect(approveSubscriptionPaymentRequest(db, {
            paymentRequestId: payment.id,
            gangId: payment.gangId,
            actorDiscordId: 'admin-1',
            actorName: 'Admin',
        })).rejects.toMatchObject({
            code: 'NOT_SUBMITTED',
        } satisfies Partial<SubscriptionPaymentError>);

        expect(updateCalls).toHaveLength(0);
    });
});

describe('subscription payment rejection safety', () => {
    it('does not write a duplicate bank reference into the rejected payment row', async () => {
        const { db, payment, updateCalls, auditCalls } = createRejectionHarness({
            duplicateSlipRef: 'BANK-TRANS-USED',
        });

        const result = await rejectSubscriptionPaymentRequest(db, {
            paymentRequestId: payment.id,
            gangId: payment.gangId,
            actorDiscordId: 'slipok:auto',
            actorName: 'SlipOK Auto Verify',
            reviewNotes: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว',
            provider: 'SLIPOK',
            slipPayload: 'payload',
            slipTransRef: 'BANK-TRANS-USED',
            verificationError: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว',
        });

        expect(result.status).toBe('REJECTED');
        expect(updateCalls[0]).toEqual(expect.objectContaining({
            status: 'REJECTED',
            slipTransRef: null,
            verificationError: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว',
        }));
        expect(auditCalls[0]).toEqual(expect.objectContaining({
            action: 'SUBSCRIPTION_PAYMENT_REJECT',
            details: expect.stringContaining('"slipTransRef":null'),
        }));
    });
});
