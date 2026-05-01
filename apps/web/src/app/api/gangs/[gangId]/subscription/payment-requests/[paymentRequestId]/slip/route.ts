import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
    approveSubscriptionPaymentRequest,
    db,
    markSubscriptionPaymentSubmitted,
    subscriptionPaymentRequests,
    SubscriptionPaymentError,
} from '@gang/database';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isSlipOkAutoVerifyEnabled, SlipOkError, verifySlipOkSlip } from '@/lib/slipOk';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError, logWarn } from '@/lib/logger';
import { getPromptPayBillingPauseMessage, isPromptPayBillingEnabled } from '@/lib/promptPayBilling';

const SubmitSlipSchema = z.object({
    payload: z.string().trim().min(16).max(2048).optional(),
    imageUrl: z.string().url().max(2048).optional(),
}).refine((value) => Boolean(value.payload) !== Boolean(value.imageUrl), {
    message: 'Provide exactly one slip payload or image URL',
});

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

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; paymentRequestId: string }> }
) {
    const params = await props.params;
    const { gangId, paymentRequestId } = params;
    let actorDiscordId = 'unknown';

    try {
        if (!isPromptPayBillingEnabled()) {
            return NextResponse.json({ error: getPromptPayBillingPauseMessage() }, { status: 503 });
        }

        const access = await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        actorDiscordId = access.session.user.discordId;

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:subscription-payment-slip:submit',
            limit: 10,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('subscription-payment-slip-submit', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const input = SubmitSlipSchema.parse(await request.json());
        const payment = await db.query.subscriptionPaymentRequests.findFirst({
            where: eq(subscriptionPaymentRequests.id, paymentRequestId),
        });
        if (!payment || payment.gangId !== gangId) {
            return NextResponse.json({ error: 'Payment request not found' }, { status: 404 });
        }

        if (!isSlipOkAutoVerifyEnabled()) {
            const submitted = await markSubscriptionPaymentSubmitted(db, {
                paymentRequestId,
                gangId,
                provider: 'PROMPTPAY_MANUAL',
                slipPayload: input.payload,
                slipImageUrl: input.imageUrl,
                verificationError: 'SlipOK auto verification is not enabled',
            });

            return NextResponse.json({
                paymentRequest: toPublicPaymentRequest(submitted),
                manualReviewRequired: true,
                message: 'Slip submitted for manual review.',
            }, { status: 202 });
        }

        try {
            const verification = await verifySlipOkSlip(
                input.payload ? { payload: input.payload } : { imageUrl: input.imageUrl! },
                payment.amount
            );

            const verified = await markSubscriptionPaymentSubmitted(db, {
                paymentRequestId,
                gangId,
                provider: 'SLIPOK',
                slipPayload: input.payload,
                slipImageUrl: input.imageUrl,
                slipTransRef: verification.transRef ?? null,
                providerResponse: verification,
                status: 'VERIFIED',
            });

            const approved = await approveSubscriptionPaymentRequest(db, {
                paymentRequestId,
                gangId,
                actorDiscordId: 'slipok:auto',
                actorName: 'SlipOK Auto Verify',
                reviewNotes: `Auto-approved from SlipOK for ${access.session.user.discordId}`,
            });

            return NextResponse.json({
                paymentRequest: toPublicPaymentRequest(approved.payment ?? verified),
                activated: true,
                durationDays: approved.durationDays,
                bonusDays: approved.bonusDays,
                expiresAt: approved.expiresAt ? new Date(approved.expiresAt).toISOString() : null,
            });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'SlipOK verification failed';
            const submitted = await markSubscriptionPaymentSubmitted(db, {
                paymentRequestId,
                gangId,
                provider: 'SLIPOK',
                slipPayload: input.payload,
                slipImageUrl: input.imageUrl,
                verificationError: message,
            });

            if (error instanceof SlipOkError && ['AMOUNT_MISMATCH', 'ACCOUNT_MISMATCH', 'DUPLICATE_SLIP'].includes(error.code)) {
                return NextResponse.json({
                    paymentRequest: toPublicPaymentRequest(submitted),
                    manualReviewRequired: true,
                    error: error.message,
                    code: error.code,
                }, { status: error.status });
            }

            logWarn('api.subscription_payment_slip.slipok_fallback_to_manual', {
                gangId,
                paymentRequestId,
                error: message,
            });
            return NextResponse.json({
                paymentRequest: toPublicPaymentRequest(submitted),
                manualReviewRequired: true,
                message: 'SlipOK is unavailable, slip submitted for manual review.',
            }, { status: 202 });
        }
    } catch (error) {
        if (isGangAccessError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid slip submission' }, { status: 400 });
        }
        if (error instanceof SubscriptionPaymentError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }

        logError('api.subscription_payment_slip.submit.failed', error, {
            gangId,
            paymentRequestId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
