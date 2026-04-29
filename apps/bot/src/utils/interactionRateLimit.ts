import { consumeRateLimit, db } from '@gang/database';
import { logError } from './logger';

const INTERACTION_LIMIT = 5;
const INTERACTION_WINDOW_MS = 10_000;

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
            allowed: true,
            count: 0,
            limit: INTERACTION_LIMIT,
            remaining: INTERACTION_LIMIT,
            resetAt: new Date(Date.now() + INTERACTION_WINDOW_MS),
            retryAfterSeconds: 0,
        };
    }
}
