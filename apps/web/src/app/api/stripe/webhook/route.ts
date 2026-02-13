import { NextRequest, NextResponse } from 'next/server';
import { Stripe, getStripeInstance } from '@/lib/stripe';
import { db, gangs } from '@gang/database';
import { eq } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
        return new NextResponse('Missing signature or webhook secret', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        event = getStripeInstance().webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return new NextResponse(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        switch (event.type) {
            // Payment mode (one-time) — จ่ายครั้งเดียว รองรับ Card + PromptPay QR
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                // Only process paid sessions
                if (session.payment_status !== 'paid') {
                    console.log(`[Stripe] Session ${session.id} not yet paid (${session.payment_status}), waiting for async payment`);
                    break;
                }

                await activateSubscription(session);
                break;
            }

            // PromptPay/async payments — จ่ายสำเร็จหลังจาก checkout session สร้างแล้ว
            case 'checkout.session.async_payment_succeeded': {
                const session = event.data.object as Stripe.Checkout.Session;
                await activateSubscription(session);
                break;
            }

            // PromptPay/async payments — จ่ายไม่สำเร็จ
            case 'checkout.session.async_payment_failed': {
                const session = event.data.object as Stripe.Checkout.Session;
                const gangId = session.metadata?.gangId;
                console.log(`[Stripe] Async payment failed for gang ${gangId}`);
                break;
            }

            default:
                console.log(`[Stripe Webhook] Unhandled event: ${event.type}`);
        }

        return NextResponse.json({ received: true });

    } catch (error) {
        console.error('[Stripe Webhook] Processing error:', error);
        return new NextResponse('Webhook processing error', { status: 500 });
    }
}

// Monthly prices (THB) — used to calculate prorated value on upgrade
const TIER_MONTHLY_PRICE: Record<string, number> = {
    FREE: 0,
    TRIAL: 0,
    PRO: 149,
    PREMIUM: 299,
};

// Helper: activate subscription after successful payment
async function activateSubscription(session: Stripe.Checkout.Session) {
    const gangId = session.metadata?.gangId;
    const tier = session.metadata?.tier;
    const billing = session.metadata?.billing || 'monthly';

    if (!gangId || !tier) {
        console.error('[Stripe] Missing metadata in session:', session.id);
        return;
    }

    console.log(`[Stripe] Payment completed for gang ${gangId} → ${tier} (${billing})`);

    // Fetch current gang to check remaining days for proration
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionExpiresAt: true, subscriptionTier: true },
    });

    // Prorate remaining value from old plan → equivalent days on new plan
    let bonusDays = 0;
    if (gang?.subscriptionExpiresAt && gang.subscriptionTier) {
        const now = new Date();
        const currentExpiry = new Date(gang.subscriptionExpiresAt);
        if (currentExpiry > now) {
            const remainingDays = Math.ceil((currentExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const oldDailyRate = (TIER_MONTHLY_PRICE[gang.subscriptionTier] ?? 0) / 30;
            const newDailyRate = (TIER_MONTHLY_PRICE[tier] ?? 0) / 30;

            if (oldDailyRate > 0 && newDailyRate > 0) {
                // remainingValue = remainingDays × oldDailyRate
                // bonusDays = remainingValue / newDailyRate
                bonusDays = Math.floor(remainingDays * (oldDailyRate / newDailyRate));
                console.log(`[Stripe] Prorated: ${remainingDays} days of ${gang.subscriptionTier} (฿${(remainingDays * oldDailyRate).toFixed(0)}) → ${bonusDays} days of ${tier}`);
            }
        }
    }

    // Calculate new expiry: billing period + prorated bonus days
    const expiresAt = new Date();
    if (billing === 'yearly') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    } else {
        expiresAt.setDate(expiresAt.getDate() + 30);
    }
    if (bonusDays > 0) {
        expiresAt.setDate(expiresAt.getDate() + bonusDays);
    }

    await db.update(gangs)
        .set({
            subscriptionTier: tier as 'FREE' | 'TRIAL' | 'PRO' | 'PREMIUM',
            subscriptionExpiresAt: expiresAt,
            stripeCustomerId: session.customer as string,
            updatedAt: new Date(),
        })
        .where(eq(gangs.id, gangId));

    console.log(`[Stripe] Gang ${gangId} activated ${tier}, expires ${expiresAt.toISOString()}${bonusDays > 0 ? ` (+${bonusDays} prorated days)` : ''}`);
}
