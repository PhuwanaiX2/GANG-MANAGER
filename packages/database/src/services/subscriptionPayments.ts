import { randomUUID } from 'crypto';
import { and, desc, eq, ne } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';
import { auditLogs, gangs, subscriptionPaymentRequests } from '../schema';
import {
    getSubscriptionAmount,
    getSubscriptionDurationDays,
    normalizeSubscriptionTier,
    type BillingPeriod,
} from '../tierConfig';

type DbType = LibSQLDatabase<typeof schema> | any;

export type SubscriptionPaymentStatus =
    | 'PENDING'
    | 'SUBMITTED'
    | 'VERIFIED'
    | 'APPROVED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'CANCELLED';

export type SubscriptionPaymentProvider = 'PROMPTPAY_MANUAL' | 'SLIPOK';

export class SubscriptionPaymentError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status = 400
    ) {
        super(message);
        this.name = 'SubscriptionPaymentError';
    }
}

function uuid() {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    return randomUUID();
}

function buildPaymentRef(gangId: string) {
    const suffix = uuid().replace(/-/g, '').slice(0, 8).toUpperCase();
    return `GX-${gangId.slice(0, 6).toUpperCase()}-${Date.now().toString(36).toUpperCase()}-${suffix}`;
}

function addDays(from: Date, days: number) {
    const next = new Date(from);
    next.setDate(next.getDate() + days);
    return next;
}

function getStackedExpiry(params: {
    currentTier: string | null | undefined;
    currentExpiry: Date | null | undefined;
    billing: BillingPeriod;
    now: Date;
}) {
    const baseDays = getSubscriptionDurationDays(params.billing);
    const currentExpiry = params.currentExpiry ? new Date(params.currentExpiry) : null;
    const remainingMs = currentExpiry ? currentExpiry.getTime() - params.now.getTime() : 0;
    const remainingDays = remainingMs > 0 && normalizeSubscriptionTier(params.currentTier) === 'PREMIUM'
        ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24))
        : 0;

    return {
        bonusDays: remainingDays,
        durationDays: baseDays + remainingDays,
        expiresAt: addDays(params.now, baseDays + remainingDays),
    };
}

export async function createSubscriptionPaymentRequest(
    db: DbType,
    data: {
        gangId: string;
        actorDiscordId: string;
        actorName: string;
        tier: 'PREMIUM';
        billingPeriod: BillingPeriod;
    }
) {
    if (data.tier !== 'PREMIUM') {
        throw new SubscriptionPaymentError('Only PREMIUM can be purchased', 'INVALID_TIER');
    }
    if (!['monthly', 'yearly'].includes(data.billingPeriod)) {
        throw new SubscriptionPaymentError('Invalid billing period', 'INVALID_BILLING');
    }

    const now = new Date();
    const expiresAt = addDays(now, 1);
    const amount = getSubscriptionAmount(data.tier, data.billingPeriod);
    const id = uuid();
    const requestRef = buildPaymentRef(data.gangId);

    await db.insert(subscriptionPaymentRequests).values({
        id,
        gangId: data.gangId,
        requestRef,
        actorDiscordId: data.actorDiscordId,
        actorName: data.actorName,
        tier: data.tier,
        billingPeriod: data.billingPeriod,
        amount,
        currency: 'THB',
        provider: 'PROMPTPAY_MANUAL',
        status: 'PENDING',
        expiresAt,
        createdAt: now,
        updatedAt: now,
    });

    await db.insert(auditLogs).values({
        id: uuid(),
        gangId: data.gangId,
        actorId: data.actorDiscordId,
        actorName: data.actorName,
        action: 'SUBSCRIPTION_PAYMENT_REQUEST_CREATE',
        targetType: 'subscription_payment_request',
        targetId: id,
        newValue: JSON.stringify({
            requestRef,
            tier: data.tier,
            billingPeriod: data.billingPeriod,
            amount,
            currency: 'THB',
            status: 'PENDING',
        }),
        createdAt: now,
    });

    return db.query.subscriptionPaymentRequests.findFirst({
        where: eq(subscriptionPaymentRequests.id, id),
    });
}

export async function listSubscriptionPaymentRequests(
    db: DbType,
    filters: {
        gangId?: string;
        status?: SubscriptionPaymentStatus;
        limit?: number;
    } = {}
) {
    const where = filters.gangId && filters.status
        ? and(
            eq(subscriptionPaymentRequests.gangId, filters.gangId),
            eq(subscriptionPaymentRequests.status, filters.status)
        )
        : filters.gangId
            ? eq(subscriptionPaymentRequests.gangId, filters.gangId)
            : filters.status
                ? eq(subscriptionPaymentRequests.status, filters.status)
                : undefined;

    return db.query.subscriptionPaymentRequests.findMany({
        where,
        orderBy: desc(subscriptionPaymentRequests.createdAt),
        limit: Math.min(Math.max(filters.limit ?? 50, 1), 100),
    });
}

export async function markSubscriptionPaymentSubmitted(
    db: DbType,
    data: {
        paymentRequestId: string;
        gangId: string;
        provider: SubscriptionPaymentProvider;
        slipPayload?: string | null;
        slipImageUrl?: string | null;
        slipTransRef?: string | null;
        providerResponse?: unknown;
        verificationError?: string | null;
        status?: 'SUBMITTED' | 'VERIFIED';
    }
) {
    const now = new Date();

    return db.transaction(async (tx: any) => {
        const payment = await tx.query.subscriptionPaymentRequests.findFirst({
            where: and(
                eq(subscriptionPaymentRequests.id, data.paymentRequestId),
                eq(subscriptionPaymentRequests.gangId, data.gangId)
            ),
        });

        if (!payment) {
            throw new SubscriptionPaymentError('Payment request not found', 'NOT_FOUND', 404);
        }
        if (payment.status === 'APPROVED') {
            throw new SubscriptionPaymentError('Payment request is already approved', 'ALREADY_APPROVED');
        }
        if (['REJECTED', 'EXPIRED', 'CANCELLED'].includes(payment.status)) {
            throw new SubscriptionPaymentError('Payment request is no longer active', 'NOT_ACTIVE');
        }
        if (payment.expiresAt && new Date(payment.expiresAt).getTime() < now.getTime()) {
            await tx.update(subscriptionPaymentRequests)
                .set({ status: 'EXPIRED', updatedAt: now })
                .where(eq(subscriptionPaymentRequests.id, payment.id));
            throw new SubscriptionPaymentError('Payment request expired', 'EXPIRED', 410);
        }

        if (data.slipTransRef) {
            const duplicate = await tx.query.subscriptionPaymentRequests.findFirst({
                where: and(
                    eq(subscriptionPaymentRequests.slipTransRef, data.slipTransRef),
                    ne(subscriptionPaymentRequests.id, data.paymentRequestId)
                ),
            });
            if (duplicate) {
                throw new SubscriptionPaymentError('Duplicate slip reference', 'DUPLICATE_SLIP', 409);
            }
        }

        await tx.update(subscriptionPaymentRequests)
            .set({
                provider: data.provider,
                status: data.status ?? 'SUBMITTED',
                slipPayload: data.slipPayload ?? payment.slipPayload,
                slipImageUrl: data.slipImageUrl ?? payment.slipImageUrl,
                slipTransRef: data.slipTransRef ?? payment.slipTransRef,
                providerResponse: data.providerResponse ? JSON.stringify(data.providerResponse) : payment.providerResponse,
                verificationError: data.verificationError ?? null,
                submittedAt: payment.submittedAt ?? now,
                verifiedAt: data.status === 'VERIFIED' ? now : payment.verifiedAt,
                updatedAt: now,
            })
            .where(eq(subscriptionPaymentRequests.id, payment.id));

        return tx.query.subscriptionPaymentRequests.findFirst({
            where: eq(subscriptionPaymentRequests.id, payment.id),
        });
    });
}

export async function approveSubscriptionPaymentRequest(
    db: DbType,
    data: {
        paymentRequestId: string;
        gangId: string;
        actorDiscordId: string;
        actorName: string;
        reviewNotes?: string | null;
    }
) {
    const now = new Date();

    return db.transaction(async (tx: any) => {
        const payment = await tx.query.subscriptionPaymentRequests.findFirst({
            where: and(
                eq(subscriptionPaymentRequests.id, data.paymentRequestId),
                eq(subscriptionPaymentRequests.gangId, data.gangId)
            ),
        });

        if (!payment) {
            throw new SubscriptionPaymentError('Payment request not found', 'NOT_FOUND', 404);
        }
        if (payment.status === 'APPROVED') {
            return {
                payment,
                alreadyApproved: true,
                durationDays: 0,
                bonusDays: 0,
                expiresAt: payment.approvedAt,
            };
        }
        if (!['SUBMITTED', 'VERIFIED'].includes(payment.status)) {
            throw new SubscriptionPaymentError('Payment request must be submitted before approval', 'NOT_SUBMITTED');
        }
        if (payment.amount !== getSubscriptionAmount(payment.tier, payment.billingPeriod)) {
            throw new SubscriptionPaymentError('Payment amount no longer matches plan price', 'AMOUNT_MISMATCH');
        }
        if (payment.expiresAt && new Date(payment.expiresAt).getTime() < now.getTime()) {
            await tx.update(subscriptionPaymentRequests)
                .set({ status: 'EXPIRED', updatedAt: now })
                .where(eq(subscriptionPaymentRequests.id, payment.id));
            throw new SubscriptionPaymentError('Payment request expired', 'EXPIRED', 410);
        }

        const gang = await tx.query.gangs.findFirst({
            where: eq(gangs.id, data.gangId),
            columns: {
                subscriptionTier: true,
                subscriptionExpiresAt: true,
            },
        });
        if (!gang) {
            throw new SubscriptionPaymentError('Gang not found', 'GANG_NOT_FOUND', 404);
        }

        const stacked = getStackedExpiry({
            currentTier: gang.subscriptionTier,
            currentExpiry: gang.subscriptionExpiresAt,
            billing: payment.billingPeriod,
            now,
        });

        await tx.update(gangs)
            .set({
                subscriptionTier: 'PREMIUM',
                subscriptionExpiresAt: stacked.expiresAt,
                updatedAt: now,
            })
            .where(eq(gangs.id, data.gangId));

        await tx.update(subscriptionPaymentRequests)
            .set({
                status: 'APPROVED',
                approvedAt: now,
                approvedById: data.actorDiscordId,
                reviewNotes: data.reviewNotes ?? payment.reviewNotes,
                updatedAt: now,
            })
            .where(eq(subscriptionPaymentRequests.id, payment.id));

        await tx.insert(auditLogs).values({
            id: uuid(),
            gangId: data.gangId,
            actorId: data.actorDiscordId,
            actorName: data.actorName,
            action: 'SUBSCRIPTION_PAYMENT_APPROVE',
            targetType: 'subscription_payment_request',
            targetId: payment.id,
            oldValue: JSON.stringify({
                previousTier: gang.subscriptionTier,
                previousExpiresAt: gang.subscriptionExpiresAt,
            }),
            newValue: JSON.stringify({
                tier: 'PREMIUM',
                expiresAt: stacked.expiresAt.toISOString(),
                requestRef: payment.requestRef,
                billingPeriod: payment.billingPeriod,
                amount: payment.amount,
            }),
            details: JSON.stringify({
                provider: payment.provider,
                durationDays: stacked.durationDays,
                bonusDays: stacked.bonusDays,
                reviewNotes: data.reviewNotes ?? null,
            }),
            createdAt: now,
        });

        const approvedPayment = await tx.query.subscriptionPaymentRequests.findFirst({
            where: eq(subscriptionPaymentRequests.id, payment.id),
        });

        return {
            payment: approvedPayment,
            alreadyApproved: false,
            durationDays: stacked.durationDays,
            bonusDays: stacked.bonusDays,
            expiresAt: stacked.expiresAt,
        };
    });
}

export async function rejectSubscriptionPaymentRequest(
    db: DbType,
    data: {
        paymentRequestId: string;
        gangId: string;
        actorDiscordId: string;
        actorName: string;
        reviewNotes: string;
    }
) {
    const now = new Date();

    const payment = await db.query.subscriptionPaymentRequests.findFirst({
        where: and(
            eq(subscriptionPaymentRequests.id, data.paymentRequestId),
            eq(subscriptionPaymentRequests.gangId, data.gangId)
        ),
    });

    if (!payment) {
        throw new SubscriptionPaymentError('Payment request not found', 'NOT_FOUND', 404);
    }
    if (payment.status === 'APPROVED') {
        throw new SubscriptionPaymentError('Approved payment requests cannot be rejected', 'ALREADY_APPROVED');
    }

    await db.update(subscriptionPaymentRequests)
        .set({
            status: 'REJECTED',
            rejectedAt: now,
            rejectedById: data.actorDiscordId,
            reviewNotes: data.reviewNotes,
            updatedAt: now,
        })
        .where(eq(subscriptionPaymentRequests.id, payment.id));

    await db.insert(auditLogs).values({
        id: uuid(),
        gangId: data.gangId,
        actorId: data.actorDiscordId,
        actorName: data.actorName,
        action: 'SUBSCRIPTION_PAYMENT_REJECT',
        targetType: 'subscription_payment_request',
        targetId: payment.id,
        details: JSON.stringify({ requestRef: payment.requestRef, reviewNotes: data.reviewNotes }),
        createdAt: now,
    });

    return db.query.subscriptionPaymentRequests.findFirst({
        where: eq(subscriptionPaymentRequests.id, payment.id),
    });
}
