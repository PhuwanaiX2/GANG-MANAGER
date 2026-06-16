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
import { isSlipOkDefinitiveRejection, SlipOkError, type SlipOkSlipData, verifySlipOkSlip } from '@/lib/slipOk';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError, logWarn } from '@/lib/logger';
import { getPromptPayBillingPauseMessage } from '@/lib/promptPayBilling';
import { isPromptPayBillingRuntimeEnabled, isSlipOkAutoVerifyRuntimeEnabled } from '@/lib/billingRuntimeFlags';
import { refreshFinanceDiscordPanelsForGang } from '@/lib/discordFinancePanels';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_SLIP_UPLOAD_SIZE = 5 * 1024 * 1024;
const ALLOWED_SLIP_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_SLIP_FORMATS = new Set(['jpg', 'jpeg', 'png', 'webp']);
const DEFAULT_TRUSTED_SLIP_IMAGE_HOSTS = [
    'cdn.discordapp.com',
    'media.discordapp.net',
    '*.discordapp.com',
    '*.discordapp.net',
    '*.fbcdn.net',
    '*.fbsbx.com',
];

const SubmitSlipSchema = z.object({
    payload: z.string().trim().min(16).max(2048).optional(),
    imageUrl: z.string().url().max(2048).optional(),
}).refine((value) => Boolean(value.payload) !== Boolean(value.imageUrl), {
    message: 'Provide exactly one slip payload or image URL',
});

function getTrustedSlipImageHostPatterns() {
    return [
        ...DEFAULT_TRUSTED_SLIP_IMAGE_HOSTS,
        ...(process.env.TRUSTED_SLIP_IMAGE_HOSTS || '')
            .split(',')
            .map((host) => host.trim().toLowerCase())
            .filter(Boolean),
    ];
}

function matchesTrustedSlipImageHost(hostname: string, pattern: string) {
    if (pattern.startsWith('*.')) {
        const suffix = pattern.slice(1);
        return hostname.endsWith(suffix) && hostname.length > suffix.length;
    }

    return hostname === pattern;
}

function isCloudinarySlipImageUrl(url: URL) {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    if (!cloudName) {
        return false;
    }

    return url.protocol === 'https:' &&
        url.hostname === 'res.cloudinary.com' &&
        url.pathname.startsWith(`/${cloudName}/image/upload/`);
}

function assertTrustedSlipImageUrl(imageUrl: string) {
    let parsed: URL;
    try {
        parsed = new URL(imageUrl);
    } catch {
        throw new Error('UNTRUSTED_SLIP_IMAGE_URL');
    }

    if (parsed.protocol !== 'https:') {
        throw new Error('UNTRUSTED_SLIP_IMAGE_URL');
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
        isCloudinarySlipImageUrl(parsed) ||
        getTrustedSlipImageHostPatterns().some((pattern) => matchesTrustedSlipImageHost(hostname, pattern))
    ) {
        return;
    }

    throw new Error('UNTRUSTED_SLIP_IMAGE_URL');
}

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

function getSlipFailureMessage(error: unknown) {
    if (error instanceof SlipOkError) {
        const messages: Record<string, string> = {
            INVALID_SLIP_PAYLOAD: 'ข้อมูลสลิปไม่ถูกต้อง กรุณาสร้างบิลใหม่และส่งรูปสลิปจากแอปธนาคาร',
            INVALID_SLIP_FILE: 'ไฟล์สลิปไม่ถูกต้อง กรุณาส่งรูปสลิปใหม่จากแอปธนาคาร',
            INVALID_SLIP_IMAGE: 'รูปสลิปไม่ชัดหรืออ่านข้อมูลไม่ได้ กรุณาสร้างบิลใหม่และส่งรูปสลิปใหม่',
            MISSING_SLIP_QR: 'ไม่พบ QR ในสลิป กรุณาส่งสลิปที่มี QR จากแอปธนาคาร',
            UNSUPPORTED_SLIP_QR: 'QR ในสลิปไม่รองรับการตรวจสอบ กรุณาสร้างบิลใหม่และส่งสลิปจากแอปธนาคาร',
            SLIP_NOT_FOUND_OR_EXPIRED: 'ยังยืนยันรายการโอนจากสลิปนี้ไม่ได้ บิลถูกปิดแล้ว หากเงินถูกตัดจริง ให้ติดต่อซัพพอร์ตพร้อมเลขอ้างอิงก่อนโอนซ้ำ',
            AMOUNT_MISMATCH: 'ยอดเงินในสลิปไม่ตรงกับยอดบิล กรุณาสร้างบิลใหม่และโอนตามยอดที่แสดง',
            ACCOUNT_MISMATCH: 'บัญชีปลายทางในสลิปไม่ตรงกับบัญชีรับเงินของระบบ บิลถูกปิดแล้ว หากคิดว่าโอนถูกบัญชี ให้ติดต่อซัพพอร์ตพร้อมเลขอ้างอิงก่อนโอนซ้ำ',
            DUPLICATE_SLIP: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว กรุณาสร้างบิลใหม่และใช้สลิปที่ยังไม่เคยส่ง',
            SLIPOK_MISSING_TRANS_REF: 'ระบบตรวจสลิปไม่พบเลขอ้างอิงธนาคาร กรุณาสร้างบิลใหม่และส่งสลิปใหม่',
            SLIPOK_PACKAGE_EXPIRED: 'ระบบตรวจสลิปอัตโนมัติยังใช้งานไม่ได้ชั่วคราว รายการถูกส่งให้แอดมินตรวจแล้ว กรุณารอผลและอย่าโอนซ้ำ',
        };
        return messages[error.code] || error.message;
    }

    if (error instanceof SubscriptionPaymentError) {
        const messages: Record<string, string> = {
            DUPLICATE_SLIP: 'สลิปนี้ถูกใช้กับรายการอื่นแล้ว กรุณาสร้างบิลใหม่และใช้สลิปที่ยังไม่เคยส่ง',
            AMOUNT_MISMATCH: 'ยอดบิลไม่ตรงกับราคาปัจจุบัน กรุณาสร้างบิลใหม่ก่อนชำระ',
        };
        return messages[error.code] || error.message;
    }

    return error instanceof Error ? error.message : 'ตรวจสลิปไม่สำเร็จ';
}

function isDefinitivePaymentRejection(error: unknown) {
    return isSlipOkDefinitiveRejection(error)
        || (error instanceof SubscriptionPaymentError && ['DUPLICATE_SLIP', 'AMOUNT_MISMATCH'].includes(error.code));
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

    const secureUrl = result.secure_url as string;
    assertTrustedSlipImageUrl(secureUrl);
    return secureUrl;
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

    const input = SubmitSlipSchema.parse(await request.json());
    if (input.imageUrl) {
        assertTrustedSlipImageUrl(input.imageUrl);
    }
    return input;
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; paymentRequestId: string }> }
) {
    const params = await props.params;
    const { gangId, paymentRequestId } = params;
    let actorDiscordId = 'unknown';

    try {
        if (!await isPromptPayBillingRuntimeEnabled()) {
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

        if (!await isSlipOkAutoVerifyRuntimeEnabled()) {
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
                message: 'ส่งสลิปเข้าคิวตรวจแล้ว กรุณารอผลและอย่าโอนซ้ำ',
            }, { status: 202 });
        }

        let verification: SlipOkSlipData | null = null;
        try {
            verification = await verifySlipOkSlip(
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
            const discordPanelRefresh = await refreshFinanceDiscordPanelsForGang(gangId);

            return NextResponse.json({
                paymentRequest: toPublicPaymentRequest(approved.payment ?? verified),
                activated: true,
                durationDays: approved.durationDays,
                bonusDays: approved.bonusDays,
                expiresAt: approved.expiresAt ? new Date(approved.expiresAt).toISOString() : null,
                discordPanelRefresh,
            });
        } catch (error) {
            const message = getSlipFailureMessage(error);

            if (isDefinitivePaymentRejection(error)) {
                const rejected = await rejectSubscriptionPaymentRequest(db, {
                    paymentRequestId,
                    gangId,
                    actorDiscordId: 'slipok:auto',
                    actorName: 'SlipOK Auto Verify',
                    reviewNotes: message,
                    provider: 'SLIPOK',
                    slipPayload: input.payload,
                    slipImageUrl: input.imageUrl,
                    slipTransRef: verification?.transRef ?? (error instanceof SlipOkError ? error.slipData?.transRef ?? null : null),
                    providerResponse: verification ?? (error instanceof SlipOkError ? error.slipData ?? undefined : undefined),
                    verificationError: message,
                });

                return NextResponse.json({
                    paymentRequest: toPublicPaymentRequest(rejected),
                    rejected: true,
                    error: message,
                    code: error instanceof SlipOkError || error instanceof SubscriptionPaymentError ? error.code : 'SLIP_REJECTED',
                }, { status: error instanceof SlipOkError || error instanceof SubscriptionPaymentError
                    ? error.status >= 400 && error.status < 500 ? error.status : 422
                    : 422 });
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
                code: error instanceof SlipOkError ? error.code : undefined,
                status: error instanceof SlipOkError ? error.status : undefined,
            });
            const manualReviewMessage = error instanceof SlipOkError && error.code === 'SLIPOK_PACKAGE_EXPIRED'
                ? message
                : 'ตรวจอัตโนมัติยังยืนยันรายการไม่ได้ ส่งสลิปเข้าคิวตรวจแล้ว กรุณาอย่าโอนซ้ำ';
            return NextResponse.json({
                paymentRequest: toPublicPaymentRequest(submitted),
                manualReviewRequired: true,
                code: error instanceof SlipOkError ? error.code : undefined,
                message: manualReviewMessage,
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
            ['UPLOAD_SERVICE_UNAVAILABLE', 'INVALID_SLIP_FILE_TYPE', 'INVALID_SLIP_FILE_SIZE', 'MISSING_SLIP_FILE', 'UNTRUSTED_SLIP_IMAGE_URL'].includes(error.message)
        ) {
            const messages: Record<string, string> = {
                UPLOAD_SERVICE_UNAVAILABLE: 'Upload service unavailable',
                INVALID_SLIP_FILE_TYPE: 'Only JPG, PNG, or WEBP slip images are allowed',
                INVALID_SLIP_FILE_SIZE: 'Slip image must be between 1 byte and 5MB',
                MISSING_SLIP_FILE: 'Slip image file is required',
                UNTRUSTED_SLIP_IMAGE_URL: 'Slip image URL must be an HTTPS image URL from Cloudinary, Discord, Facebook CDN, or a trusted payment evidence host',
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
