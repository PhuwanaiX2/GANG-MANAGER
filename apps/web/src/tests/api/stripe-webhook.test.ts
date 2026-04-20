import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@gang/database');
vi.mock('@/lib/stripe', () => ({
    getStripeInstance: vi.fn(),
    Stripe: {},
}));

import { db, getTierConfig, normalizeSubscriptionTier } from '@gang/database';
import { getStripeInstance } from '@/lib/stripe';
import { POST } from '@/app/api/stripe/webhook/route';

describe('POST /api/stripe/webhook', () => {
    let consoleLogSpy: ReturnType<typeof vi.spyOn>;
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    const createRequest = (body: string, signature = 'sig_test') => new NextRequest('http://localhost:3000/api/stripe/webhook', {
        method: 'POST',
        body,
        headers: signature ? { 'stripe-signature': signature } : {},
    });

    const setCalls: Array<Record<string, unknown>> = [];

    beforeEach(() => {
        vi.clearAllMocks();
        setCalls.length = 0;
        consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';

        (getStripeInstance as any).mockReturnValue({
            webhooks: {
                constructEvent: vi.fn(),
            },
        });

        (normalizeSubscriptionTier as any).mockImplementation((tier: string | null | undefined) => (
            tier === 'PREMIUM' || tier === 'PRO' || tier === 'TRIAL' ? 'PREMIUM' : 'FREE'
        ));
        (getTierConfig as any).mockImplementation((tier: string) => ({
            price: tier === 'PREMIUM' ? 199 : 0,
            name: tier === 'PREMIUM' ? 'Premium' : 'Free',
        }));

        (db as any).query = {
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    subscriptionTier: 'PREMIUM',
                    subscriptionExpiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
                }),
            },
        };

        (db.update as any) = vi.fn(() => ({
            set: vi.fn((payload) => {
                setCalls.push(payload);
                return {
                    where: vi.fn().mockResolvedValue(undefined),
                };
            }),
        }));
    });

    afterEach(() => {
        consoleLogSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });

    it('returns 400 when signature or webhook secret is missing', async () => {
        delete process.env.STRIPE_WEBHOOK_SECRET;

        const res = await POST(createRequest('payload', ''));
        expect(res.status).toBe(400);
    });

    it('returns 400 when Stripe signature verification fails', async () => {
        (getStripeInstance as any).mockReturnValue({
            webhooks: {
                constructEvent: vi.fn(() => {
                    throw new Error('Invalid signature');
                }),
            },
        });

        const res = await POST(createRequest('payload'));
        expect(res.status).toBe(400);
        await expect(res.text()).resolves.toContain('Webhook Error');
    });

    it('ignores unpaid checkout.session.completed events', async () => {
        (getStripeInstance as any).mockReturnValue({
            webhooks: {
                constructEvent: vi.fn().mockReturnValue({
                    id: 'evt_unpaid',
                    type: 'checkout.session.completed',
                    data: {
                        object: {
                            id: 'cs_unpaid',
                            payment_status: 'unpaid',
                            metadata: { gangId: 'gang-123', tier: 'PREMIUM', billing: 'monthly' },
                        },
                    },
                }),
            },
        });

        const res = await POST(createRequest('payload'));
        expect(res.status).toBe(200);
        expect(db.update).not.toHaveBeenCalled();
    });

    it('activates a paid checkout session and updates the gang subscription', async () => {
        (getStripeInstance as any).mockReturnValue({
            webhooks: {
                constructEvent: vi.fn().mockReturnValue({
                    id: 'evt_paid',
                    type: 'checkout.session.completed',
                    data: {
                        object: {
                            id: 'cs_paid',
                            payment_status: 'paid',
                            customer: 'cus_123',
                            metadata: { gangId: 'gang-123', tier: 'PRO', billing: 'monthly' },
                        },
                    },
                }),
            },
        });

        const res = await POST(createRequest('payload'));

        expect(res.status).toBe(200);
        expect(db.update).toHaveBeenCalledTimes(1);
        expect(setCalls[0]).toMatchObject({
            subscriptionTier: 'PREMIUM',
            stripeCustomerId: 'cus_123',
        });
        expect(setCalls[0].subscriptionExpiresAt).toBeInstanceOf(Date);
        expect((setCalls[0].subscriptionExpiresAt as Date).getTime()).toBeGreaterThan(Date.now() + 35 * 24 * 60 * 60 * 1000);
    });

    it('is idempotent for duplicate event ids', async () => {
        const event = {
            id: 'evt_duplicate',
            type: 'checkout.session.async_payment_succeeded',
            data: {
                object: {
                    id: 'cs_duplicate',
                    payment_status: 'paid',
                    customer: 'cus_dup',
                    metadata: { gangId: 'gang-123', tier: 'PREMIUM', billing: 'monthly' },
                },
            },
        };

        (getStripeInstance as any).mockReturnValue({
            webhooks: {
                constructEvent: vi.fn().mockReturnValue(event),
            },
        });

        const first = await POST(createRequest('payload'));
        const second = await POST(createRequest('payload'));

        expect(first.status).toBe(200);
        expect(second.status).toBe(200);
        expect(db.update).toHaveBeenCalledTimes(1);
    });
});
