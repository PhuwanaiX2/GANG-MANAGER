import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import {
    approveSubscriptionPaymentRequest,
    db,
    listSubscriptionPaymentRequests,
    rejectSubscriptionPaymentRequest,
    SubscriptionPaymentError,
    type SubscriptionPaymentStatus,
} from '@gang/database';
import { authOptions } from '@/lib/auth';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';
import { logError } from '@/lib/logger';

const StatusSchema = z.enum(['PENDING', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']);

const ReviewPaymentSchema = z.object({
    action: z.enum(['approve', 'reject']),
    paymentRequestId: z.string().min(1),
    gangId: z.string().min(1),
    reviewNotes: z.string().trim().max(1000).optional(),
}).refine((value) => value.action === 'approve' || Boolean(value.reviewNotes), {
    message: 'Review notes are required when rejecting a payment request',
});

function toPublicPaymentRequest(payment: any) {
    return {
        id: payment.id,
        gangId: payment.gangId,
        requestRef: payment.requestRef,
        actorDiscordId: payment.actorDiscordId,
        actorName: payment.actorName,
        tier: payment.tier,
        billingPeriod: payment.billingPeriod,
        amount: payment.amount,
        currency: payment.currency,
        provider: payment.provider,
        status: payment.status,
        slipImageUrl: payment.slipImageUrl,
        slipTransRef: payment.slipTransRef,
        verificationError: payment.verificationError,
        submittedAt: payment.submittedAt ? new Date(payment.submittedAt).toISOString() : null,
        verifiedAt: payment.verifiedAt ? new Date(payment.verifiedAt).toISOString() : null,
        approvedAt: payment.approvedAt ? new Date(payment.approvedAt).toISOString() : null,
        approvedById: payment.approvedById,
        rejectedAt: payment.rejectedAt ? new Date(payment.rejectedAt).toISOString() : null,
        rejectedById: payment.rejectedById,
        reviewNotes: payment.reviewNotes,
        expiresAt: payment.expiresAt ? new Date(payment.expiresAt).toISOString() : null,
        createdAt: payment.createdAt ? new Date(payment.createdAt).toISOString() : null,
        updatedAt: payment.updatedAt ? new Date(payment.updatedAt).toISOString() : null,
    };
}

async function requireAdminSession() {
    const session = await getServerSession(authOptions);
    const adminDiscordId = session?.user?.discordId;
    if (!isAdminDiscordId(adminDiscordId)) {
        return { session: null, adminDiscordId: null };
    }

    return { session, adminDiscordId };
}

export async function GET(request: NextRequest) {
    let adminDiscordId: string | null = null;

    try {
        const sessionResult = await requireAdminSession();
        adminDiscordId = sessionResult.adminDiscordId;
        if (!sessionResult.session || !adminDiscordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:admin:subscription-payments:get',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('admin-subscription-payments-get', adminDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const { searchParams } = new URL(request.url);
        const statusParam = searchParams.get('status');
        const status = statusParam ? StatusSchema.parse(statusParam) as SubscriptionPaymentStatus : undefined;
        const paymentRequests = await listSubscriptionPaymentRequests(db, { status, limit: 100 });

        return NextResponse.json({ paymentRequests: paymentRequests.map(toPublicPaymentRequest) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid payment status filter' }, { status: 400 });
        }

        logError('api.admin.subscription_payments.get.failed', error, { adminDiscordId });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest) {
    const { session, adminDiscordId } = await requireAdminSession();
    if (!session || !adminDiscordId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    try {
        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:admin:subscription-payments:patch',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('admin-subscription-payments-patch', adminDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const input = ReviewPaymentSchema.parse(await request.json());
        const actorName = session.user.name || 'Admin';

        if (input.action === 'approve') {
            const approved = await approveSubscriptionPaymentRequest(db, {
                paymentRequestId: input.paymentRequestId,
                gangId: input.gangId,
                actorDiscordId: adminDiscordId,
                actorName,
                reviewNotes: input.reviewNotes ?? 'Manual approval by admin',
            });

            return NextResponse.json({
                paymentRequest: toPublicPaymentRequest(approved.payment),
                activated: true,
                durationDays: approved.durationDays,
                bonusDays: approved.bonusDays,
                expiresAt: approved.expiresAt ? new Date(approved.expiresAt).toISOString() : null,
            });
        }

        const rejected = await rejectSubscriptionPaymentRequest(db, {
            paymentRequestId: input.paymentRequestId,
            gangId: input.gangId,
            actorDiscordId: adminDiscordId,
            actorName,
            reviewNotes: input.reviewNotes!,
        });

        return NextResponse.json({ paymentRequest: toPublicPaymentRequest(rejected) });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid review request' }, { status: 400 });
        }
        if (error instanceof SubscriptionPaymentError) {
            return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
        }

        logError('api.admin.subscription_payments.patch.failed', error, { adminDiscordId });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
