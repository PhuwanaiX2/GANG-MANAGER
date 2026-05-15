import { NextRequest, NextResponse } from 'next/server';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originFromValue(value: string | null | undefined) {
    if (!value) {
        return null;
    }

    try {
        return new URL(value).origin;
    } catch {
        return null;
    }
}

function addOrigin(origins: Set<string>, value: string | null | undefined) {
    const origin = originFromValue(value);
    if (origin) {
        origins.add(origin);
    }
}

function getAllowedOrigins(request: NextRequest) {
    const origins = new Set<string>();
    addOrigin(origins, request.nextUrl.origin);
    addOrigin(origins, process.env.NEXTAUTH_URL);
    addOrigin(origins, process.env.NEXT_PUBLIC_APP_URL);
    addOrigin(origins, process.env.APP_URL);
    addOrigin(origins, process.env.SITE_URL);

    const vercelUrl = process.env.VERCEL_URL;
    if (vercelUrl) {
        addOrigin(origins, vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`);
    }

    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (forwardedHost) {
        const forwardedProto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
        addOrigin(origins, `${forwardedProto}://${forwardedHost}`);
    }

    return origins;
}

function forbiddenOrigin() {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
}

export function enforceSameOriginMutationRequest(request: NextRequest) {
    if (!request.nextUrl.pathname.startsWith('/api')) {
        return null;
    }

    if (request.nextUrl.pathname.startsWith('/api/auth')) {
        return null;
    }

    if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
        return null;
    }

    const allowedOrigins = getAllowedOrigins(request);
    const origin = request.headers.get('origin');
    if (origin) {
        const requestOrigin = originFromValue(origin);
        return requestOrigin && allowedOrigins.has(requestOrigin) ? null : forbiddenOrigin();
    }

    const referer = request.headers.get('referer');
    if (referer) {
        const refererOrigin = originFromValue(referer);
        return refererOrigin && allowedOrigins.has(refererOrigin) ? null : forbiddenOrigin();
    }

    return null;
}
