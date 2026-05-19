import { NextRequest, NextResponse } from 'next/server';
import {
    cancelSubscriptionPaymentRequest,
    db,
    SubscriptionPaymentError,
} from '@gang/database';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError } from '@/lib/logger';

function toPublicPaymentRequest(payment: any) {
    return {
        id: payment.id,
        requestRef: payment.requestRef,
        tier: payment.tier,
        billingPeriod: payment.billingPeriod,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        slipImageUrl: payment.slipImageUrl,
        verificationError: payment.verificationError,
        submittedAt: payment.submittedAt ? new Date(payment.submittedAt).toISOString() : null,
        verifiedAt: payment.verifiedAt ? new Date(payment.verifiedAt).toISOString() : null,
        approvedAt: payment.approvedAt ? new Date(payment.approvedAt).toISOString() : null,
        rejectedAt: payment.rejectedAt ? new Date(payment.rejectedAt).toISOString() : null,
        reviewNotes: payment.reviewNotes,
        expiresAt: payment.expiresAt ? new Date(payment.expiresAt).toISOString() : null,
        createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
    };
}

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; paymentRequestId: string }> }
) {
    const params = await props.params;
    const { gangId, paymentRequestId } = params;
    let actorDiscordId = 'unknown';

    try {
        const access = await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        actorDiscordId = access.session.user.discordId;

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:subscription-payment-requests:cancel',
            limit: 10,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('subscription-payment-requests-cancel', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const payment = await cancelSubscriptionPaymentRequest(db, {
            paymentRequestId,
            gangId,
            actorDiscordId,
            actorName: access.session.user.name || access.member.name || 'Owner',
        });

        return NextResponse.json({
            paymentRequest: toPublicPaymentRequest(payment),
        });
    } catch (error) {
        if (isGangAccessError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof SubscriptionPaymentError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }

        logError('api.subscription_payment_requests.cancel.failed', error, {
            gangId,
            paymentRequestId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
