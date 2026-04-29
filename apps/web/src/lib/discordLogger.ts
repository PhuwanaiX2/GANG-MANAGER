import { logError, logInfo, type LogContext } from './logger';

/**
 * Temporary sink while external notification delivery is still paused.
 * This keeps call sites centralized and logs in a structured format.
 */
export async function logToDiscord(message: string, error?: unknown, context?: LogContext) {
    if (error) {
        logError('discord.log_sink.error', error, {
            message,
            ...context,
        });
        return;
    }

    logInfo('discord.log_sink.info', {
        message,
        ...context,
    });
}
