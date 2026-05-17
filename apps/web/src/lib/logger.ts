type LogLevel = 'info' | 'warn' | 'error';
type LogContext = Record<string, unknown>;
type StructuredLogPayload = {
    timestamp: string;
    level: LogLevel;
    service: 'web';
    event: string;
    context?: unknown;
    error?: unknown;
};

const SENSITIVE_KEY_PATTERN = /(authorization|token|secret|password|cookie|signature|api[_-]?key|webhook)/i;
const MAX_DEPTH = 5;
const MAX_STRING_LENGTH = 2_000;
const DISCORD_FIELD_LIMIT = 1_024;
const DISCORD_TITLE_LIMIT = 256;

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
    const payload: StructuredLogPayload = {
        timestamp: new Date().toISOString(),
        level,
        service: 'web',
        event,
        context: context ? sanitizeValue(context, seen) : undefined,
        error: error ? sanitizeValue(error, seen) : undefined,
    };

    const line = JSON.stringify(payload);

    if (level === 'error') {
        console.error(line);
        dispatchAlert(payload);
        return;
    }

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.info(line);
}

function shouldUseDiscordWebhook(url: string) {
    const format = process.env.ALERT_WEBHOOK_FORMAT?.trim().toLowerCase();
    if (format === 'discord') {
        return true;
    }
    if (format === 'generic') {
        return false;
    }

    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        return ['discord.com', 'discordapp.com'].includes(hostname) && parsed.pathname.startsWith('/api/webhooks/');
    } catch {
        return false;
    }
}

function truncate(value: string, limit: number) {
    if (value.length <= limit) {
        return value;
    }

    return `${value.slice(0, Math.max(0, limit - 15))}...[truncated]`;
}

function formatDiscordCodeBlock(value: unknown) {
    const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    return `\`\`\`json\n${truncate(text, DISCORD_FIELD_LIMIT - 12)}\n\`\`\``;
}

function buildDiscordAlertPayload(payload: StructuredLogPayload, environment: string) {
    const color = payload.level === 'error' ? 0xed4245 : payload.level === 'warn' ? 0xfee75c : 0x57f287;
    const fields = [
        { name: 'Service', value: payload.service, inline: true },
        { name: 'Environment', value: truncate(environment, 128), inline: true },
        { name: 'Event', value: `\`${truncate(payload.event, 220)}\``, inline: false },
    ];

    if (payload.context !== undefined) {
        fields.push({ name: 'Context', value: formatDiscordCodeBlock(payload.context), inline: false });
    }

    if (payload.error !== undefined) {
        fields.push({ name: 'Error', value: formatDiscordCodeBlock(payload.error), inline: false });
    }

    return {
        username: 'Gang Manager Alerts',
        embeds: [
            {
                title: truncate(`${payload.service.toUpperCase()} ${payload.level.toUpperCase()}: ${payload.event}`, DISCORD_TITLE_LIMIT),
                color,
                timestamp: payload.timestamp,
                fields,
            },
        ],
    };
}

function dispatchAlert(payload: StructuredLogPayload) {
    const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
    if (!webhookUrl) {
        return;
    }

    const environment = process.env.NODE_ENV || 'development';
    const discordWebhook = shouldUseDiscordWebhook(webhookUrl);
    const token = process.env.ALERT_WEBHOOK_TOKEN?.trim();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token && !discordWebhook) {
        headers.Authorization = `Bearer ${token}`;
    }

    void fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(discordWebhook
            ? buildDiscordAlertPayload(payload, environment)
            : {
                ...payload,
                environment,
            }),
    }).catch((error) => {
        console.warn(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'warn',
            service: 'web',
            event: 'alert.dispatch_failed',
            error: sanitizeValue(error, new WeakSet<object>()),
        }));
    });
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
