import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('next-auth');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/stripe', () => ({
    getStripeInstance: vi.fn(),
}));

describe('GET /api/admin/stripe', () => {
    let getServerSessionMock: any;
    let getStripeInstanceMock: any;
    let GET: typeof import('@/app/api/admin/stripe/route').GET;

    const createRequest = (period = '30d') => new NextRequest(`http://localhost:3000/api/admin/stripe?period=${period}`);

    beforeEach(async () => {
        vi.clearAllMocks();
        vi.resetModules();
        process.env.ADMIN_DISCORD_IDS = 'admin-123';
        process.env.STRIPE_SECRET_KEY = 'sk_test';

        const nextAuth = await import('next-auth');
        const stripeLib = await import('@/lib/stripe');
        ({ GET } = await import('@/app/api/admin/stripe/route'));

        getServerSessionMock = nextAuth.getServerSession as any;
        getStripeInstanceMock = stripeLib.getStripeInstance as any;

        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'admin-123' },
        });

        getStripeInstanceMock.mockReturnValue({
            balance: {
                retrieve: vi.fn().mockResolvedValue({
                    available: [{ amount: 12345, currency: 'thb' }],
                    pending: [{ amount: 500, currency: 'thb' }],
                }),
            },
            charges: {
                list: vi.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'ch_success_1',
                            amount: 19900,
                            currency: 'thb',
                            status: 'succeeded',
                            created: 1713500000,
                            description: 'Premium monthly',
                            receipt_url: 'https://stripe.test/receipt-1',
                            payment_method_details: { type: 'card' },
                            metadata: { gangId: 'gang-1', tier: 'PREMIUM', billing: 'monthly' },
                            billing_details: { email: 'owner@example.com' },
                            balance_transaction: { fee: 1000 },
                        },
                        {
                            id: 'ch_failed_1',
                            amount: 19900,
                            currency: 'thb',
                            status: 'failed',
                            created: 1713503600,
                            description: 'Failed payment',
                            receipt_url: null,
                            payment_method_details: { type: 'promptpay' },
                            metadata: {},
                            billing_details: { email: null },
                        },
                    ],
                }),
            },
            checkout: {
                sessions: {
                    list: vi.fn().mockResolvedValue({
                        data: [
                            {
                                id: 'cs_paid_1',
                                payment_status: 'paid',
                                status: 'complete',
                                amount_total: 19900,
                                metadata: { tier: 'PREMIUM', gangId: 'gang-1' },
                            },
                            {
                                id: 'cs_open_1',
                                payment_status: 'unpaid',
                                status: 'open',
                                amount_total: 19900,
                                metadata: { tier: 'PREMIUM', gangId: 'gang-1' },
                            },
                        ],
                    }),
                },
            },
        });
    });

    it('returns 403 for non-admin users', async () => {
        getServerSessionMock.mockResolvedValue({
            user: { discordId: 'user-999' },
        });

        const res = await GET(createRequest());
        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Unauthorized' });
    });

    it('returns 500 when Stripe is not configured', async () => {
        delete process.env.STRIPE_SECRET_KEY;

        const res = await GET(createRequest());
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toMatchObject({ error: 'STRIPE_SECRET_KEY not configured' });
    });

    it('returns Stripe payment aggregates using the new payment-oriented response fields', async () => {
        const res = await GET(createRequest('7d'));
        expect(res.status).toBe(200);

        const json = await res.json();
        expect(json.revenue).toMatchObject({
            total: 19900,
            fees: 1000,
            net: 18900,
            currency: 'thb',
        });
        expect(json.charges).toMatchObject({ successful: 1, failed: 1, total: 2 });
        expect(json.checkout).toMatchObject({ paid: 1, pending: 1 });
        expect(json.paymentsByTier).toMatchObject({
            PREMIUM: { count: 1, amount: 19900 },
        });
        expect(json.dailyStripeRevenue).toBeTruthy();
        expect(json.recentPayments).toHaveLength(1);
        expect(json.paymentMethods).toMatchObject({ card: 1 });
        expect(json.period).toBe('7d');
    });

    it('passes the selected period to Stripe list calls', async () => {
        const stripe = {
            balance: {
                retrieve: vi.fn().mockResolvedValue({ available: [], pending: [] }),
            },
            charges: {
                list: vi.fn().mockResolvedValue({ data: [] }),
            },
            checkout: {
                sessions: {
                    list: vi.fn().mockResolvedValue({ data: [] }),
                },
            },
        };
        getStripeInstanceMock.mockReturnValue(stripe);

        const res = await GET(createRequest('90d'));
        expect(res.status).toBe(200);
        expect(stripe.charges.list).toHaveBeenCalledWith(expect.objectContaining({
            limit: 100,
            created: expect.objectContaining({ gte: expect.any(Number) }),
        }));
        expect(stripe.checkout.sessions.list).toHaveBeenCalledWith(expect.objectContaining({
            limit: 100,
            created: expect.objectContaining({ gte: expect.any(Number) }),
        }));
    });
});
