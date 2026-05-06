import { NextRequest, NextResponse } from 'next/server';
import { v2 as cloudinary } from 'cloudinary';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
    approveSubscriptionPaymentRequest,
    db,
    markSubscriptionPaymentSubmitted,
    rejectSubscriptionPaymentRequest,
    subscriptionPaymentRequests,
    SubscriptionPaymentError,
} from '@gang/database';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isSlipOkAutoVerifyEnabled, SlipOkError, verifySlipOkSlip } from '@/lib/slipOk';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError, logWarn } from '@/lib/logger';
import { getPromptPayBillingPauseMessage, isPromptPayBillingEnabled } from '@/lib/promptPayBilling';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SLIP_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_SLIP_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_SLIP_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);

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

function ensureSlipUploadConfigured() {
    if (
        !process.env.CLOUDINARY_CLOUD_NAME ||
        !process.env.CLOUDINARY_API_KEY ||
        !process.env.CLOUDINARY_API_SECRET
    ) {
        throw new Error('UPLOAD_SERVICE_UNAVAILABLE');
    }
}

function isAllowedSlipUpload(result: any) {
    return result?.resource_type === 'image' && ALLOWED_SLIP_FORMATS.has(String(result?.format || '').toLowerCase());
}

async function discardUnsupportedUpload(result: any) {
    if (result?.public_id) {
        await cloudinary.uploader.destroy(result.public_id, { resource_type: 'image' }).catch(() => undefined);
    }
}

async function uploadSlipFile(file: File, gangId: string, paymentRequestId: string) {
    ensureSlipUploadConfigured();

    if (!ALLOWED_SLIP_MIME_TYPES.has(file.type)) {
        throw new Error('INVALID_SLIP_FILE_TYPE');
    }

    if (file.size <= 0 || file.size > MAX_SLIP_UPLOAD_SIZE) {
        throw new Error('INVALID_SLIP_FILE_SIZE');
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await new Promise<any>((resolve, reject) => {
        cloudinary.uploader.upload_stream(
            {
                folder: `payment-slips/${gangId}`,
                public_id: paymentRequestId,
                overwrite: true,
                resource_type: 'image',
            },
            (error, uploadResult) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(uploadResult);
            }
        ).end(buffer);
    });

    if (!isAllowedSlipUpload(result)) {
        await discardUnsupportedUpload(result);
        throw new Error('INVALID_SLIP_FILE_TYPE');
    }

    return result.secure_url as string;
}

async function readSlipInput(request: NextRequest, gangId: string, paymentRequestId: string) {
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!(file instanceof File)) {
            throw new Error('MISSING_SLIP_FILE');
        }

        const imageUrl = await uploadSlipFile(file, gangId, paymentRequestId);
        return { imageUrl };
    }

    return SubmitSlipSchema.parse(await request.json());
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

        const input = await readSlipInput(request, gangId, paymentRequestId);
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

            if (error instanceof SlipOkError && ['AMOUNT_MISMATCH', 'ACCOUNT_MISMATCH', 'DUPLICATE_SLIP'].includes(error.code)) {
                const rejected = await rejectSubscriptionPaymentRequest(db, {
                    paymentRequestId,
                    gangId,
                    actorDiscordId: 'slipok:auto',
                    actorName: 'SlipOK Auto Verify',
                    reviewNotes: message,
                });

                return NextResponse.json({
                    paymentRequest: toPublicPaymentRequest(rejected),
                    rejected: true,
                    error: message,
                    code: error.code,
                }, { status: error.status });
            }

            const submitted = await markSubscriptionPaymentSubmitted(db, {
                paymentRequestId,
                gangId,
                provider: 'SLIPOK',
                slipPayload: input.payload,
                slipImageUrl: input.imageUrl,
                verificationError: message,
            });

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
        if (
            error instanceof Error &&
            ['UPLOAD_SERVICE_UNAVAILABLE', 'INVALID_SLIP_FILE_TYPE', 'INVALID_SLIP_FILE_SIZE', 'MISSING_SLIP_FILE'].includes(error.message)
        ) {
            const messages: Record<string, string> = {
                UPLOAD_SERVICE_UNAVAILABLE: 'Upload service unavailable',
                INVALID_SLIP_FILE_TYPE: 'Only JPG, PNG, or WEBP slip images are allowed',
                INVALID_SLIP_FILE_SIZE: 'Slip image must be between 1 byte and 5MB',
                MISSING_SLIP_FILE: 'Slip image file is required',
            };
            return NextResponse.json({ error: messages[error.message] }, { status: error.message === 'UPLOAD_SERVICE_UNAVAILABLE' ? 503 : 400 });
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
