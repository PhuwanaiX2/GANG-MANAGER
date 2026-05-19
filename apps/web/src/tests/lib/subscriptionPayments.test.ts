import { describe, expect, it, vi } from 'vitest';
import { approveSubscriptionPaymentRequest, SubscriptionPaymentError } from '@gang/database';

function createApprovalHarness(paymentOverrides: Record<string, unknown> = {}) {
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

describe('subscription payment approval recovery', () => {
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
