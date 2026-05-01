import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import QRCode from 'qrcode';
import {
    createSubscriptionPaymentRequest,
    db,
    listSubscriptionPaymentRequests,
    SubscriptionPaymentError,
} from '@gang/database';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError } from '@/lib/logger';
import {
    getPromptPayBillingPauseMessage,
    getPromptPayReceiverConfig,
    isPromptPayBillingEnabled,
} from '@/lib/promptPayBilling';
import { buildPromptPayQrPayload } from '@/lib/promptPayQr';

const CreatePaymentRequestSchema = z.object({
    tier: z.literal('PREMIUM'),
    billingPeriod: z.enum(['monthly', 'yearly']).optional(),
    billing: z.enum(['monthly', 'yearly']).optional(),
}).transform((value) => ({
    tier: value.tier,
    billingPeriod: value.billingPeriod ?? value.billing ?? 'monthly',
}));

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
        submittedAt: payment.submittedAt ? new Date(payment.submittedAt).toISOString() : null,
        verifiedAt: payment.verifiedAt ? new Date(payment.verifiedAt).toISOString() : null,
        approvedAt: payment.approvedAt ? new Date(payment.approvedAt).toISOString() : null,
        rejectedAt: payment.rejectedAt ? new Date(payment.rejectedAt).toISOString() : null,
        reviewNotes: payment.reviewNotes,
        expiresAt: payment.expiresAt ? new Date(payment.expiresAt).toISOString() : null,
        createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
    };
}

async function getPromptPayViewForPayment(payment: any) {
    if (!isPromptPayBillingEnabled()) return null;

    const receiver = getPromptPayReceiverConfig();
    if (!receiver.isConfigured) return null;

    const qrPayload = buildPromptPayQrPayload({
        identifier: receiver.identifier,
        amount: payment.amount,
        reference: payment.requestRef,
    });
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: {
            dark: '#111827',
            light: '#FFFFFF',
        },
    });

    return {
        receiverName: receiver.displayName,
        identifier: receiver.identifier,
        qrPayload,
        qrDataUrl,
        instructions: 'Transfer the exact amount and submit the slip before the request expires.',
    };
}

function getBillingUnavailableResponse() {
    if (!isPromptPayBillingEnabled()) {
        return NextResponse.json({ error: getPromptPayBillingPauseMessage() }, { status: 503 });
    }

    const receiver = getPromptPayReceiverConfig();
    if (!receiver.isConfigured) {
        return NextResponse.json(
            { error: 'PromptPay receiver is not configured' },
            { status: 503 }
        );
    }
    try {
        buildPromptPayQrPayload({ identifier: receiver.identifier, amount: 1 });
    } catch {
        return NextResponse.json(
            { error: 'PromptPay receiver identifier is invalid' },
            { status: 503 }
        );
    }

    return null;
}

export async function GET(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId = 'unknown';

    try {
        const { session } = await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        actorDiscordId = session.user.discordId;

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:subscription-payment-requests:get',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('subscription-payment-requests-get', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const payments = await listSubscriptionPaymentRequests(db, { gangId, limit: 50 });
        const activePayment = payments.find((payment: any) => ['PENDING', 'SUBMITTED', 'VERIFIED'].includes(payment.status));
        let promptPay = null;
        if (activePayment) {
            try {
                promptPay = await getPromptPayViewForPayment(activePayment);
            } catch (error) {
                logError('api.subscription_payment_requests.promptpay_view.failed', error, { gangId, actorDiscordId });
            }
        }

        return NextResponse.json({
            paymentRequests: payments.map(toPublicPaymentRequest),
            promptPay,
        });
    } catch (error) {
        if (isGangAccessError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }

        logError('api.subscription_payment_requests.get.failed', error, { gangId, actorDiscordId });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId = 'unknown';

    try {
        const unavailable = getBillingUnavailableResponse();
        if (unavailable) {
            return unavailable;
        }

        const access = await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        actorDiscordId = access.session.user.discordId;

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:subscription-payment-requests:create',
            limit: 10,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('subscription-payment-requests-create', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const input = CreatePaymentRequestSchema.parse(await request.json());
        const payment = await createSubscriptionPaymentRequest(db, {
            gangId,
            actorDiscordId,
            actorName: access.session.user.name || access.member.name || 'Owner',
            tier: input.tier,
            billingPeriod: input.billingPeriod,
        });
        const promptPay = await getPromptPayViewForPayment(payment);

        return NextResponse.json({
            paymentRequest: toPublicPaymentRequest(payment),
            promptPay,
        }, { status: 201 });
    } catch (error) {
        if (isGangAccessError(error)) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid payment request' }, { status: 400 });
        }
        if (error instanceof SubscriptionPaymentError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }

        logError('api.subscription_payment_requests.create.failed', error, { gangId, actorDiscordId });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
