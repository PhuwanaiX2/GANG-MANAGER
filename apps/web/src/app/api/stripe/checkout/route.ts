import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe, getPriceId } from '@/lib/stripe';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';

const TIER_RANK: Record<string, number> = { FREE: 0, TRIAL: 0, PRO: 1, PREMIUM: 2 };

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { gangId, tier, billing = 'monthly' } = body as { gangId: string; tier: 'PRO' | 'PREMIUM'; billing?: 'monthly' | 'yearly' };

        if (!['PRO', 'PREMIUM'].includes(tier)) {
            return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
        }

        if (!['monthly', 'yearly'].includes(billing)) {
            return NextResponse.json({ error: 'Invalid billing period' }, { status: 400 });
        }

        const priceId = getPriceId(tier, billing);
        if (!priceId) {
            return NextResponse.json({ error: 'Stripe price not configured for this tier/billing' }, { status: 500 });
        }

        // Verify user is OWNER of this gang
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true)
            ),
        });

        if (!member || member.gangRole !== 'OWNER') {
            return NextResponse.json({ error: 'Only gang OWNER can manage subscriptions' }, { status: 403 });
        }

        // Get gang and check for downgrade
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
        });

        if (!gang) {
            return NextResponse.json({ error: 'Gang not found' }, { status: 404 });
        }

        // Prevent downgrade (PREMIUM → PRO) but allow same-tier renewal (PRO → PRO)
        const currentRank = TIER_RANK[gang.subscriptionTier] ?? 0;
        const targetRank = TIER_RANK[tier] ?? 0;
        if (targetRank < currentRank) {
            return NextResponse.json({ error: 'ไม่สามารถซื้อแพลนที่ต่ำกว่าแพลนปัจจุบันได้' }, { status: 400 });
        }

        // Get or create Stripe customer
        let customerId = gang.stripeCustomerId;

        if (!customerId) {
            const customer = await stripe.customers.create({
                metadata: {
                    gangId: gangId,
                    discordId: session.user.discordId,
                    gangName: gang.name,
                },
            });
            customerId = customer.id;

            await db.update(gangs)
                .set({ stripeCustomerId: customerId })
                .where(eq(gangs.id, gangId));
        }

        // Create Stripe Checkout Session — payment mode (one-time) for QR + Card support
        const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

        const checkoutSession = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'payment',
            payment_method_types: ['card', 'promptpay'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            success_url: `${baseUrl}/dashboard/${gangId}/settings?subscription=success`,
            cancel_url: `${baseUrl}/dashboard/${gangId}/settings?subscription=cancelled`,
            metadata: {
                gangId: gangId,
                tier: tier,
                billing: billing,
            },
        });

        return NextResponse.json({ url: checkoutSession.url });

    } catch (error) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
