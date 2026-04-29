type ClientLogLevel = 'error' | 'warn';
type ClientLogContext = Record<string, unknown>;

const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|signature|api[_-]?key|webhook)/i;
const MAX_DEPTH = 4;
const MAX_STRING_LENGTH = 1_000;

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return Object.prototype.toString.call(value) === '[object Object]';
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
            stack: value.stack?.slice(0, MAX_STRING_LENGTH),
        };
    }

    if (typeof value === 'string') {
        return value.length <= MAX_STRING_LENGTH ? value : `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.slice(0, 25).map((item) => sanitizeValue(item, seen, depth + 1));
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

function reportClientEvent(level: ClientLogLevel, event: string, error: unknown, context?: ClientLogContext) {
    if (typeof window === 'undefined') {
        return;
    }

    const payload = {
        level,
        event,
        page: window.location.pathname,
        timestamp: new Date().toISOString(),
        error: sanitizeValue(error, new WeakSet<object>()),
        context: context ? sanitizeValue(context, new WeakSet<object>()) : undefined,
    };
    const body = JSON.stringify(payload);

    if (process.env.NODE_ENV !== 'production') {
        const consoleRef = globalThis.console;
        const method = level === 'error' ? consoleRef?.error : consoleRef?.warn;
        method?.call(consoleRef, `[client:${event}]`, error, context);
    }

    const blob = new Blob([body], { type: 'application/json' });
    if (navigator.sendBeacon?.('/api/client-events', blob)) {
        return;
    }

    void fetch('/api/client-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
    }).catch(() => undefined);
}

export function logClientError(event: string, error: unknown, context?: ClientLogContext) {
    reportClientEvent('error', event, error, context);
}

export function logClientWarn(event: string, warning: unknown, context?: ClientLogContext) {
    reportClientEvent('warn', event, warning, context);
}

export type { ClientLogContext };
