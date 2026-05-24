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

export type SubscriptionPaymentRequestCreateResult = {
    payment: any;
    reused: boolean;
    blockedByReview?: boolean;
};

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

export function calculateStackedSubscriptionExpiry(params: {
    currentTier: string | null | undefined;
    currentExpiry: Date | string | number | null | undefined;
    billing?: BillingPeriod;
    durationDays?: number;
    now: Date;
}) {
    const baseDays = params.durationDays ?? (params.billing ? getSubscriptionDurationDays(params.billing) : 0);
    const currentExpiry = params.currentExpiry ? new Date(params.currentExpiry) : null;
    const normalizedTier = normalizeSubscriptionTier(params.currentTier);
    const hasStackableTime = Boolean(
        currentExpiry &&
        !Number.isNaN(currentExpiry.getTime()) &&
        currentExpiry.getTime() > params.now.getTime() &&
        ['TRIAL', 'PREMIUM'].includes(normalizedTier)
    );
    const stackBase = hasStackableTime ? currentExpiry! : params.now;
    const remainingMs = hasStackableTime ? currentExpiry!.getTime() - params.now.getTime() : 0;
    const bonusDays = remainingMs > 0 ? Math.ceil(remainingMs / (1000 * 60 * 60 * 24)) : 0;

    return {
        bonusDays,
        durationDays: baseDays + bonusDays,
        expiresAt: addDays(stackBase, baseDays),
    };
}

const ACTIVE_PAYMENT_STATUSES: SubscriptionPaymentStatus[] = ['PENDING', 'SUBMITTED', 'VERIFIED'];
const TERMINAL_PAYMENT_STATUSES: SubscriptionPaymentStatus[] = ['APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'];

function isActivePaymentStatus(status: string): status is SubscriptionPaymentStatus {
    return ACTIVE_PAYMENT_STATUSES.includes(status as SubscriptionPaymentStatus);
}

function isTerminalPaymentStatus(status: string): status is SubscriptionPaymentStatus {
    return TERMINAL_PAYMENT_STATUSES.includes(status as SubscriptionPaymentStatus);
}

function getPaymentCreatedAtMs(payment: any) {
    return payment.createdAt ? new Date(payment.createdAt).getTime() : 0;
}

function isPaymentExpired(payment: any, now: Date) {
    return payment.expiresAt && new Date(payment.expiresAt).getTime() < now.getTime();
}

async function closePaymentRequest(
    tx: any,
    params: {
        payment: any;
        status: 'EXPIRED' | 'CANCELLED';
        reason: string;
        actorId: string;
        actorName: string;
        now: Date;
    }
) {
    await tx.update(subscriptionPaymentRequests)
        .set({
            status: params.status,
            reviewNotes: params.reason,
            updatedAt: params.now,
        })
        .where(eq(subscriptionPaymentRequests.id, params.payment.id));

    await tx.insert(auditLogs).values({
        id: uuid(),
        gangId: params.payment.gangId,
        actorId: params.actorId,
        actorName: params.actorName,
        action: params.status === 'EXPIRED'
            ? 'SUBSCRIPTION_PAYMENT_EXPIRE'
            : 'SUBSCRIPTION_PAYMENT_CANCEL',
        targetType: 'subscription_payment_request',
        targetId: params.payment.id,
        oldValue: JSON.stringify({ status: params.payment.status }),
        newValue: JSON.stringify({ status: params.status }),
        details: JSON.stringify({
            requestRef: params.payment.requestRef,
            reason: params.reason,
        }),
        createdAt: params.now,
    });
}

async function reconcileActivePaymentRequests(
    tx: any,
    params: {
        gangId: string;
        now: Date;
        actorId?: string;
        actorName?: string;
    }
) {
    const actorId = params.actorId || 'system:payment-reconcile';
    const actorName = params.actorName || 'Payment Reconcile';
    const payments = await tx.query.subscriptionPaymentRequests.findMany({
        where: eq(subscriptionPaymentRequests.gangId, params.gangId),
        orderBy: desc(subscriptionPaymentRequests.createdAt),
        limit: 100,
    });
    const latestTerminal = payments.find((payment: any) => isTerminalPaymentStatus(payment.status));
    const latestTerminalAt = latestTerminal ? getPaymentCreatedAtMs(latestTerminal) : 0;
    const liveActive: any[] = [];

    for (const payment of payments) {
        if (!isActivePaymentStatus(payment.status)) continue;

        if (isPaymentExpired(payment, params.now)) {
            await closePaymentRequest(tx, {
                payment,
                status: 'EXPIRED',
                reason: 'รายการชำระเงินหมดเวลาแล้ว กรุณาสร้างรายการใหม่',
                actorId,
                actorName,
                now: params.now,
            });
            continue;
        }

        if (latestTerminalAt > 0 && getPaymentCreatedAtMs(payment) < latestTerminalAt) {
            await closePaymentRequest(tx, {
                payment,
                status: 'CANCELLED',
                reason: 'ปิดรายการเก่าอัตโนมัติ เพราะมีรายการล่าสุดที่จบสถานะแล้ว',
                actorId,
                actorName,
                now: params.now,
            });
            continue;
        }

        liveActive.push(payment);
    }

    const [activePayment, ...stalePayments] = liveActive;
    for (const payment of stalePayments) {
        await closePaymentRequest(tx, {
            payment,
            status: 'CANCELLED',
            reason: 'ปิดรายการซ้ำอัตโนมัติ เพื่อให้แก๊งมีบิลที่ใช้งานอยู่ได้ครั้งละหนึ่งรายการ',
            actorId,
            actorName,
            now: params.now,
        });
    }

    return { activePayment: activePayment ?? null };
}

export async function reconcileSubscriptionPaymentRequestsForGang(
    db: DbType,
    data: {
        gangId: string;
        actorDiscordId?: string;
        actorName?: string;
    }
) {
    return db.transaction((tx: any) => reconcileActivePaymentRequests(tx, {
        gangId: data.gangId,
        now: new Date(),
        actorId: data.actorDiscordId,
        actorName: data.actorName,
    }));
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

    return db.transaction(async (tx: any): Promise<SubscriptionPaymentRequestCreateResult> => {
        const now = new Date();
        const expiresAt = addDays(now, 1);
        const amount = getSubscriptionAmount(data.tier, data.billingPeriod);
        const reconciled = await reconcileActivePaymentRequests(tx, {
            gangId: data.gangId,
            now,
            actorId: data.actorDiscordId,
            actorName: data.actorName,
        });

        if (reconciled.activePayment) {
            const active = reconciled.activePayment;
            const sameOpenBill = active.status === 'PENDING'
                && active.tier === data.tier
                && active.billingPeriod === data.billingPeriod
                && active.amount === amount;

            if (sameOpenBill) {
                return { payment: active, reused: true };
            }

            if (active.status === 'PENDING') {
                await closePaymentRequest(tx, {
                    payment: active,
                    status: 'CANCELLED',
                    reason: 'ยกเลิกรายการเดิมอัตโนมัติ เพราะมีการสร้างบิลใหม่ก่อนส่งสลิป',
                    actorId: data.actorDiscordId,
                    actorName: data.actorName,
                    now,
                });
            } else {
                return { payment: active, reused: true, blockedByReview: true };
            }
        }

        const id = uuid();
        const requestRef = buildPaymentRef(data.gangId);

        await tx.insert(subscriptionPaymentRequests).values({
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

        await tx.insert(auditLogs).values({
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

        const payment = await tx.query.subscriptionPaymentRequests.findFirst({
            where: eq(subscriptionPaymentRequests.id, id),
        });
        return { payment, reused: false };
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

export async function cancelSubscriptionPaymentRequest(
    db: DbType,
    data: {
        paymentRequestId: string;
        gangId: string;
        actorDiscordId: string;
        actorName: string;
        reason?: string | null;
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
            throw new SubscriptionPaymentError('Approved payment requests cannot be cancelled', 'ALREADY_APPROVED', 409);
        }
        if (['SUBMITTED', 'VERIFIED'].includes(payment.status)) {
            throw new SubscriptionPaymentError('Payment request already has slip evidence and cannot be cancelled by the user', 'ALREADY_SUBMITTED', 409);
        }
        if (['REJECTED', 'EXPIRED', 'CANCELLED'].includes(payment.status)) {
            return payment;
        }

        await closePaymentRequest(tx, {
            payment,
            status: 'CANCELLED',
            reason: data.reason || 'ยกเลิกบิลโดยผู้ใช้ก่อนส่งสลิป',
            actorId: data.actorDiscordId,
            actorName: data.actorName,
            now,
        });

        return tx.query.subscriptionPaymentRequests.findFirst({
            where: eq(subscriptionPaymentRequests.id, payment.id),
        });
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
        const hasSlipEvidence = Boolean(payment.slipPayload || payment.slipImageUrl || payment.slipTransRef || payment.submittedAt);
        const isManualRecovery = ['REJECTED', 'EXPIRED'].includes(payment.status) && hasSlipEvidence;
        if (!['SUBMITTED', 'VERIFIED'].includes(payment.status) && !isManualRecovery) {
            throw new SubscriptionPaymentError('Payment request must be submitted before approval', 'NOT_SUBMITTED');
        }
        if (payment.amount !== getSubscriptionAmount(payment.tier, payment.billingPeriod)) {
            throw new SubscriptionPaymentError('Payment amount no longer matches plan price', 'AMOUNT_MISMATCH');
        }
        if (!isManualRecovery && payment.expiresAt && new Date(payment.expiresAt).getTime() < now.getTime()) {
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

        const stacked = calculateStackedSubscriptionExpiry({
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
        provider?: SubscriptionPaymentProvider;
        slipPayload?: string | null;
        slipImageUrl?: string | null;
        slipTransRef?: string | null;
        providerResponse?: unknown;
        verificationError?: string | null;
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

    let nextSlipTransRef = data.slipTransRef ?? payment.slipTransRef;
    if (data.slipTransRef) {
        const duplicate = await db.query.subscriptionPaymentRequests.findFirst({
            where: and(
                eq(subscriptionPaymentRequests.slipTransRef, data.slipTransRef),
                ne(subscriptionPaymentRequests.id, data.paymentRequestId)
            ),
        });
        if (duplicate) {
            nextSlipTransRef = payment.slipTransRef ?? null;
        }
    }

    await db.update(subscriptionPaymentRequests)
        .set({
            provider: data.provider ?? payment.provider,
            status: 'REJECTED',
            slipPayload: data.slipPayload ?? payment.slipPayload,
            slipImageUrl: data.slipImageUrl ?? payment.slipImageUrl,
            slipTransRef: nextSlipTransRef,
            providerResponse: data.providerResponse ? JSON.stringify(data.providerResponse) : payment.providerResponse,
            verificationError: data.verificationError ?? payment.verificationError,
            submittedAt: payment.submittedAt ?? (data.slipPayload || data.slipImageUrl ? now : payment.submittedAt),
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
        details: JSON.stringify({
            requestRef: payment.requestRef,
            reviewNotes: data.reviewNotes,
            provider: data.provider ?? payment.provider,
            slipTransRef: nextSlipTransRef,
        }),
        createdAt: now,
    });

    return db.query.subscriptionPaymentRequests.findFirst({
        where: eq(subscriptionPaymentRequests.id, payment.id),
    });
}
