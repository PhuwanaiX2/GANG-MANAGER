import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { POST } from '@/app/api/stripe/checkout/route';

vi.mock('next-auth');
vi.mock('@gang/database');
vi.mock('@/lib/auth', () => ({ authOptions: {} }));
vi.mock('@/lib/stripe', () => ({
    getPriceId: vi.fn(),
    stripe: {
        customers: {
            create: vi.fn(),
        },
        checkout: {
            sessions: {
                create: vi.fn(),
            },
        },
    },
}));

import { getServerSession } from 'next-auth';
import { db, getTierRank, normalizeSubscriptionTier } from '@gang/database';
import { getPriceId, stripe } from '@/lib/stripe';

describe('POST /api/stripe/checkout', () => {
    const mockGangId = 'gang-123';
    const mockDiscordId = 'discord-123';

    const createRequest = (body: unknown) => new NextRequest('http://localhost:3000/api/stripe/checkout', {
        method: 'POST',
        body: JSON.stringify(body),
    });

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.NEXTAUTH_URL = 'http://localhost:3000';

        (getServerSession as any).mockResolvedValue({ user: { discordId: mockDiscordId } });
        (getPriceId as any).mockReturnValue('price_premium_monthly');
        (getTierRank as any).mockImplementation((tier: string) => tier === 'PREMIUM' ? 1 : 0);
        (normalizeSubscriptionTier as any).mockImplementation((tier: string) => tier === 'PREMIUM' ? 'PREMIUM' : 'FREE');

        (db as any).query = {
            members: {
                findFirst: vi.fn().mockResolvedValue({ gangRole: 'OWNER' }),
            },
            gangs: {
                findFirst: vi.fn().mockResolvedValue({
                    id: mockGangId,
                    name: 'Test Gang',
                    subscriptionTier: 'FREE',
                    stripeCustomerId: 'cus_existing',
                }),
            },
        };

        (stripe.checkout.sessions.create as any).mockResolvedValue({ url: 'https://stripe.test/session' });
        (stripe.customers.create as any).mockResolvedValue({ id: 'cus_new' });
        (db.update as any) = vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(undefined),
            }),
        });
    });

    it('returns 401 when unauthenticated', async () => {
        (getServerSession as any).mockResolvedValue(null);

        const res = await POST(createRequest({ gangId: mockGangId, tier: 'PREMIUM' }));
        expect(res.status).toBe(401);
    });

    it('rejects non-premium tiers', async () => {
        const res = await POST(createRequest({ gangId: mockGangId, tier: 'FREE' }));
        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({ error: 'Invalid tier' });
    });

    it('rejects invalid billing periods', async () => {
        const res = await POST(createRequest({ gangId: mockGangId, tier: 'PREMIUM', billing: 'weekly' }));
        expect(res.status).toBe(400);
        await expect(res.json()).resolves.toMatchObject({ error: 'Invalid billing period' });
    });

    it('rejects non-owner users', async () => {
        (db as any).query.members.findFirst.mockResolvedValue({ gangRole: 'ADMIN' });

        const res = await POST(createRequest({ gangId: mockGangId, tier: 'PREMIUM' }));
        expect(res.status).toBe(403);
        await expect(res.json()).resolves.toMatchObject({ error: 'Only gang OWNER can manage subscriptions' });
    });

    it('returns 500 when the Stripe price is not configured for the requested billing period', async () => {
        (getPriceId as any).mockReturnValue(null);

        const res = await POST(createRequest({ gangId: mockGangId, tier: 'PREMIUM', billing: 'yearly' }));
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toMatchObject({ error: 'Stripe price not configured for this tier/billing' });
    });

    it('creates a checkout session with normalized metadata', async () => {
        const res = await POST(createRequest({ gangId: mockGangId, tier: 'PREMIUM', billing: 'yearly' }));

        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toMatchObject({ url: 'https://stripe.test/session' });
        expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
            customer: 'cus_existing',
            metadata: expect.objectContaining({
                gangId: mockGangId,
                tier: 'PREMIUM',
                billing: 'yearly',
            }),
        }));
    });

    it('creates a Stripe customer when the gang does not have one yet', async () => {
        (db as any).query.gangs.findFirst.mockResolvedValue({
            id: mockGangId,
            name: 'Test Gang',
            subscriptionTier: 'FREE',
            stripeCustomerId: null,
        });

        const res = await POST(createRequest({ gangId: mockGangId, tier: 'PREMIUM' }));

        expect(res.status).toBe(200);
        expect(stripe.customers.create).toHaveBeenCalled();
        expect(db.update).toHaveBeenCalled();
    });
});
