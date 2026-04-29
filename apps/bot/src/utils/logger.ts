type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|signature|api[_-]?key|webhook)/i;
const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 2_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
}

function sanitizeString(value: string) {
    if (value.length <= MAX_STRING_LENGTH) {
        return value;
    }

    return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>, depth = 0): unknown {
    if (value === null || value === undefined) {
        return value;
    }

    if (depth >= MAX_DEPTH) {
        return '[Truncated]';
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
            cause: sanitizeValue((value as Error & { cause?: unknown }).cause, seen, depth + 1),
        };
    }

    if (typeof value === 'string') {
        return sanitizeString(value);
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'bigint') {
        return value.toString();
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeValue(item, seen, depth + 1));
    }

    if (typeof value === 'object') {
        if (seen.has(value)) {
            return '[Circular]';
        }

        seen.add(value);

        if (!isPlainObject(value)) {
            return String(value);
        }

        return Object.fromEntries(
            Object.entries(value).map(([key, entryValue]) => [
                key,
                SENSITIVE_KEY_PATTERN.test(key)
                    ? '[REDACTED]'
                    : sanitizeValue(entryValue, seen, depth + 1),
            ])
        );
    }

    return String(value);
}

function emit(level: LogLevel, event: string, context?: LogContext, error?: unknown) {
    const seen = new WeakSet<object>();
    const payload = {
        timestamp: new Date().toISOString(),
        level,
        service: 'bot',
        event,
        context: context ? sanitizeValue(context, seen) : undefined,
        error: error ? sanitizeValue(error, seen) : undefined,
    };

    const line = JSON.stringify(payload);

    if (level === 'error') {
        console.error(line);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.info(line);
}

export function logInfo(event: string, context?: LogContext) {
    emit('info', event, context);
}

export function logWarn(event: string, context?: LogContext) {
    emit('warn', event, context);
}

export function logError(event: string, error: unknown, context?: LogContext) {
    emit('error', event, context, error);
}

export type { LogContext };
