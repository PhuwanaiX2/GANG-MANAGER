import { eq, lt, sql } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';
import { rateLimitCounters } from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any;

type ConsumeRateLimitInput = {
    scope: string;
    subject: string;
    limit: number;
    windowMs: number;
    now?: Date;
};

type RateLimitResult = {
    allowed: boolean;
    count: number;
    limit: number;
    remaining: number;
    resetAt: Date;
    retryAfterSeconds: number;
};

const RATE_LIMIT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

let lastRateLimitCleanupAt = 0;

function normalizeSubject(subject: string) {
    return subject.trim().slice(0, 180) || 'anonymous';
}

function buildBucketId(scope: string, subject: string, windowStartMs: number) {
    return `${scope}:${subject}:${windowStartMs}`.slice(0, 255);
}

function isUniqueConstraintError(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('UNIQUE constraint failed') || message.includes('SQLITE_CONSTRAINT_UNIQUE');
}

async function maybeCleanupRateLimitCounters(db: DbType, now: Date) {
    const nowMs = now.getTime();
    if (nowMs - lastRateLimitCleanupAt < RATE_LIMIT_CLEANUP_INTERVAL_MS) {
        return;
    }

    lastRateLimitCleanupAt = nowMs;
    const cutoff = new Date(nowMs - RATE_LIMIT_RETENTION_MS);
    await db.delete(rateLimitCounters).where(lt(rateLimitCounters.expiresAt, cutoff));
}

export async function consumeRateLimit(db: DbType, input: ConsumeRateLimitInput): Promise<RateLimitResult> {
    const now = input.now ?? new Date();
    const nowMs = now.getTime();
    const windowStartMs = Math.floor(nowMs / input.windowMs) * input.windowMs;
    const windowStartAt = new Date(windowStartMs);
    const resetAt = new Date(windowStartMs + input.windowMs);
    const subject = normalizeSubject(input.subject);
    const bucketId = buildBucketId(input.scope, subject, windowStartMs);

    await maybeCleanupRateLimitCounters(db, now);

    try {
        await db.insert(rateLimitCounters).values({
            id: bucketId,
            scope: input.scope,
            subject,
            windowStartAt,
            expiresAt: resetAt,
            count: 1,
            createdAt: now,
            updatedAt: now,
        });
    } catch (error) {
        if (!isUniqueConstraintError(error)) {
            throw error;
        }

        await db.update(rateLimitCounters)
            .set({
                count: sql`${rateLimitCounters.count} + 1`,
                updatedAt: now,
                expiresAt: resetAt,
            })
            .where(eq(rateLimitCounters.id, bucketId));
    }

    const bucket = await db.query.rateLimitCounters.findFirst({
        where: eq(rateLimitCounters.id, bucketId),
        columns: {
            count: true,
            expiresAt: true,
        },
    });

    const count = bucket?.count ?? 1;
    const effectiveResetAt = bucket?.expiresAt ?? resetAt;
    const allowed = count <= input.limit;

    return {
        allowed,
        count,
        limit: input.limit,
        remaining: allowed ? Math.max(input.limit - count, 0) : 0,
        resetAt: effectiveResetAt,
        retryAfterSeconds: allowed ? 0 : Math.max(Math.ceil((effectiveResetAt.getTime() - nowMs) / 1000), 1),
    };
}
