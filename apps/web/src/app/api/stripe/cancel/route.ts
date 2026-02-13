import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { stripe } from '@/lib/stripe';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { gangId } = body as { gangId: string };

        if (!gangId) {
            return NextResponse.json({ error: 'gangId is required' }, { status: 400 });
        }

        // Verify user is OWNER
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true)
            ),
        });

        if (!member || member.gangRole !== 'OWNER') {
            return NextResponse.json({ error: 'Only gang OWNER can cancel subscriptions' }, { status: 403 });
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
        });

        if (!gang) {
            return NextResponse.json({ error: 'Gang not found' }, { status: 404 });
        }

        if (!gang.stripeCustomerId) {
            return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
        }

        // Find active subscriptions for this customer
        const subscriptionsList = await stripe.subscriptions.list({
            customer: gang.stripeCustomerId,
            status: 'active',
        });

        if (subscriptionsList.data.length === 0) {
            return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
        }

        // Cancel at period end (user keeps access until end of billing period)
        for (const sub of subscriptionsList.data) {
            await stripe.subscriptions.update(sub.id, {
                cancel_at_period_end: true,
            });
        }

        console.log(`[Stripe] Subscription cancel requested for gang ${gangId} by ${session.user.discordId}`);

        return NextResponse.json({
            success: true,
            message: 'Subscription will be cancelled at end of billing period',
            cancelAt: subscriptionsList.data[0]?.current_period_end
                ? new Date(subscriptionsList.data[0].current_period_end * 1000).toISOString()
                : null,
        });

    } catch (error) {
        console.error('Stripe Cancel Error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
