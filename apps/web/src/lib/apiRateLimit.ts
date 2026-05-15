import { NextRequest, NextResponse } from 'next/server';
import { consumeRateLimit, db } from '@gang/database';
import { logError } from './logger';

type RouteRateLimitInput = {
    scope: string;
    limit: number;
    windowMs: number;
    subject?: string;
    failClosed?: boolean;
};

const FAIL_CLOSED_SCOPE_PREFIXES = [
    'api:admin:',
    'api:finance:',
    'api:attendance:',
    'api:subscription-payment',
];

const FAIL_CLOSED_SCOPES = new Set([
    'api:activate-license',
    'api:announcements:create',
    'api:dissolve',
    'api:gangs:update',
    'api:leaves:review',
    'api:members:role',
    'api:members:status',
]);

function shouldFailClosed(scope: string) {
    return FAIL_CLOSED_SCOPES.has(scope) ||
        FAIL_CLOSED_SCOPE_PREFIXES.some((prefix) => scope.startsWith(prefix));
}

export function getClientIp(request: Request | NextRequest) {
    const forwardedFor = request.headers.get('x-forwarded-for');
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown';
    }

    const realIp = request.headers.get('x-real-ip');
    if (realIp) {
        return realIp.trim();
    }

    return 'unknown';
}

export function buildRateLimitSubject(...parts: Array<string | number | null | undefined>) {
    return parts
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(':')
        .slice(0, 180) || 'anonymous';
}

export async function enforceRouteRateLimit(
    request: Request | NextRequest,
    input: RouteRateLimitInput
) {
    try {
        const subject = input.subject || getClientIp(request);
        const result = await consumeRateLimit(db, {
            scope: input.scope,
            subject,
            limit: input.limit,
            windowMs: input.windowMs,
        });

        if (result.allowed) {
            return null;
        }

        return NextResponse.json(
            { error: 'Too Many Requests' },
            {
                status: 429,
                headers: {
                    'Retry-After': String(result.retryAfterSeconds),
                    'X-RateLimit-Limit': String(result.limit),
                    'X-RateLimit-Remaining': String(result.remaining),
                    'X-RateLimit-Reset': result.resetAt.toISOString(),
                },
            }
        );
    } catch (error) {
        const subject = input.subject || getClientIp(request);
        logError('api.rate_limit.failed', error, {
            scope: input.scope,
            subject,
        });

        if (input.failClosed ?? shouldFailClosed(input.scope)) {
            return NextResponse.json(
                { error: 'Rate limit service unavailable. Please retry shortly.' },
                {
                    status: 503,
                    headers: {
                        'Retry-After': '5',
                    },
                }
            );
        }

        return null;
    }
}
