import { and, eq, lt } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';
import { webhookEvents } from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any;

type ClaimWebhookEventInput = {
    provider: string;
    eventId: string;
    eventType?: string | null;
};

type WebhookClaimResult = {
    claimed: boolean;
    status: 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'UNKNOWN';
};

const WEBHOOK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const WEBHOOK_CLEANUP_INTERVAL_MS = 12 * 60 * 60 * 1000;

let lastWebhookCleanupAt = 0;

function buildWebhookEventRowId(provider: string, eventId: string) {
    return `${provider}:${eventId}`.slice(0, 255);
}

function isUniqueConstraintError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT_UNIQUE');
}

async function maybeCleanupWebhookEvents(db: DbType, now: Date) {
    const nowMs = now.getTime();
    if (nowMs - lastWebhookCleanupAt < WEBHOOK_CLEANUP_INTERVAL_MS) {
        return;
    }

    lastWebhookCleanupAt = nowMs;
    const cutoff = new Date(nowMs - WEBHOOK_RETENTION_MS);
    await db.delete(webhookEvents).where(lt(webhookEvents.updatedAt, cutoff));
}

export async function claimWebhookEvent(db: DbType, input: ClaimWebhookEventInput): Promise<WebhookClaimResult> {
    const now = new Date();
    await maybeCleanupWebhookEvents(db, now);

    const rowId = buildWebhookEventRowId(input.provider, input.eventId);
    try {
        await db.insert(webhookEvents).values({
            id: rowId,
            provider: input.provider,
            eventId: input.eventId,
            eventType: input.eventType ?? null,
            status: 'PROCESSING',
            attempts: 1,
            createdAt: now,
            updatedAt: now,
        });
        return { claimed: true, status: 'PROCESSING' };
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }
    }

    const existing = await db.query.webhookEvents.findFirst({
        where: and(
            eq(webhookEvents.provider, input.provider),
            eq(webhookEvents.eventId, input.eventId)
        ),
        columns: {
            status: true,
            attempts: true,
        },
    });

    if (!existing) {
        return { claimed: true, status: 'UNKNOWN' };
    }

    if (existing.status === 'FAILED') {
        await db.update(webhookEvents)
            .set({
                status: 'PROCESSING',
                attempts: (existing.attempts ?? 1) + 1,
                lastError: null,
                updatedAt: now,
            })
            .where(and(
                eq(webhookEvents.provider, input.provider),
                eq(webhookEvents.eventId, input.eventId)
            ));

        return { claimed: true, status: 'PROCESSING' };
    }

    return {
        claimed: false,
        status: existing.status === 'PROCESSED' || existing.status === 'PROCESSING'
            ? existing.status
            : 'UNKNOWN',
    };
}

export async function markWebhookEventProcessed(db: DbType, provider: string, eventId: string) {
    await db.update(webhookEvents)
        .set({
            status: 'PROCESSED',
            processedAt: new Date(),
            lastError: null,
            updatedAt: new Date(),
        })
        .where(and(
            eq(webhookEvents.provider, provider),
            eq(webhookEvents.eventId, eventId)
        ));
}

export async function markWebhookEventFailed(db: DbType, provider: string, eventId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await db.update(webhookEvents)
        .set({
            status: 'FAILED',
            lastError: message.slice(0, 1000),
            updatedAt: new Date(),
        })
        .where(and(
            eq(webhookEvents.provider, provider),
            eq(webhookEvents.eventId, eventId)
        ));
}
