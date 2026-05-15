import { consumeRateLimit, db } from '@gang/database';
import { logError } from './logger';

const INTERACTION_LIMIT = 5;
const INTERACTION_WINDOW_MS = 10_000;
const FAIL_CLOSED_RETRY_SECONDS = 5;

export async function checkInteractionRateLimit(userId: string) {
    try {
        return await consumeRateLimit(db, {
            scope: 'bot:interaction',
            subject: userId,
            limit: INTERACTION_LIMIT,
            windowMs: INTERACTION_WINDOW_MS,
        });
    } catch (error) {
        logError('bot.rate_limit.failed', error, {
            scope: 'bot:interaction',
            userId,
        });
        return {
            allowed: false,
            count: INTERACTION_LIMIT + 1,
            limit: INTERACTION_LIMIT,
            remaining: 0,
            resetAt: new Date(Date.now() + FAIL_CLOSED_RETRY_SECONDS * 1000),
            retryAfterSeconds: FAIL_CLOSED_RETRY_SECONDS,
        };
    }
}
