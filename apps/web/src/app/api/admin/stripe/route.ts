import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getStripeInstance } from '@/lib/stripe';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (!process.env.STRIPE_SECRET_KEY) {
            return NextResponse.json({ error: 'STRIPE_SECRET_KEY not configured' }, { status: 500 });
        }

        const stripe = getStripeInstance();
        const { searchParams } = new URL(request.url);
        const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d, all

        // Calculate date range
        const now = Math.floor(Date.now() / 1000);
        let created: { gte?: number } = {};
        if (period === '7d') created = { gte: now - 7 * 86400 };
        else if (period === '30d') created = { gte: now - 30 * 86400 };
        else if (period === '90d') created = { gte: now - 90 * 86400 };
        // 'all' = no filter

        // Fetch data in parallel
        const [balance, charges, checkoutSessions] = await Promise.all([
            stripe.balance.retrieve(),
            stripe.charges.list({
                limit: 100,
                ...(created.gte ? { created } : {}),
            }),
            stripe.checkout.sessions.list({
                limit: 100,
                ...(created.gte ? { created } : {}),
            }),
        ]);

        // Process balance
        const availableBalance = balance.available.map(b => ({
            amount: b.amount,
            currency: b.currency,
        }));
        const pendingBalance = balance.pending.map(b => ({
            amount: b.amount,
            currency: b.currency,
        }));

        // Process charges
        const successfulCharges = charges.data.filter(c => c.status === 'succeeded');
        const failedCharges = charges.data.filter(c => c.status === 'failed');
        const totalRevenue = successfulCharges.reduce((sum, c) => sum + c.amount, 0);
        const totalFees = successfulCharges.reduce((sum, c) => {
            const fee = c.balance_transaction && typeof c.balance_transaction === 'object'
                ? (c.balance_transaction as any).fee || 0
                : 0;
            return sum + fee;
        }, 0);
        const netRevenue = totalRevenue - totalFees;

        // Process checkout sessions
        const paidSessions = checkoutSessions.data.filter(s => s.payment_status === 'paid');
        const pendingSessions = checkoutSessions.data.filter(s => s.payment_status === 'unpaid' && s.status === 'open');

        // Revenue by tier (from checkout metadata)
        const revenueByTier: Record<string, { count: number; amount: number }> = {};
        paidSessions.forEach(s => {
            const tier = s.metadata?.tier || 'Unknown';
            if (!revenueByTier[tier]) revenueByTier[tier] = { count: 0, amount: 0 };
            revenueByTier[tier].count++;
            revenueByTier[tier].amount += s.amount_total || 0;
        });

        // Daily revenue breakdown (for chart)
        const dailyRevenue: Record<string, number> = {};
        successfulCharges.forEach(c => {
            const date = new Date(c.created * 1000).toISOString().split('T')[0];
            dailyRevenue[date] = (dailyRevenue[date] || 0) + c.amount;
        });

        // Recent transactions
        const recentTransactions = successfulCharges.slice(0, 20).map(c => ({
            id: c.id,
            amount: c.amount,
            currency: c.currency,
            status: c.status,
            created: c.created,
            description: c.description,
            receiptUrl: c.receipt_url,
            paymentMethod: c.payment_method_details?.type || 'unknown',
            metadata: c.metadata,
            customerEmail: c.billing_details?.email,
        }));

        // Payment method breakdown
        const paymentMethods: Record<string, number> = {};
        successfulCharges.forEach(c => {
            const method = c.payment_method_details?.type || 'unknown';
            paymentMethods[method] = (paymentMethods[method] || 0) + 1;
        });

        return NextResponse.json({
            balance: {
                available: availableBalance,
                pending: pendingBalance,
            },
            revenue: {
                total: totalRevenue,
                fees: totalFees,
                net: netRevenue,
                currency: 'thb',
            },
            charges: {
                successful: successfulCharges.length,
                failed: failedCharges.length,
                total: charges.data.length,
            },
            checkout: {
                paid: paidSessions.length,
                pending: pendingSessions.length,
            },
            revenueByTier,
            dailyRevenue,
            recentTransactions,
            paymentMethods,
            period,
        });

    } catch (error: any) {
        console.error('Admin Stripe API Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to fetch Stripe data',
            type: error.type || 'unknown',
        }, { status: 500 });
    }
}
