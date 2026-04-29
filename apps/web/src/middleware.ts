import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

// Best-effort fallback rate limiter.
// Critical APIs now have route-level durable throttling; this middleware remains
// a lightweight broad guard and is still not the production source of truth.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

function getAdminDiscordIds() {
    return (process.env.ADMIN_DISCORD_IDS || '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean);
}

export async function middleware(request: NextRequest) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
        const token = await getToken({
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
        });
        const discordId = typeof token?.discordId === 'string' ? token.discordId : null;

        if (!discordId) {
            return NextResponse.redirect(new URL('/', request.url));
        }

        if (!getAdminDiscordIds().includes(discordId)) {
            return new NextResponse('Forbidden', {
                status: 403,
                headers: {
                    'content-type': 'text/plain; charset=utf-8',
                },
            });
        }
    }

    // Cleanup if map gets too large (DoS prevention for memory)
    if (rateLimitMap.size > 10000) {
        const now = Date.now();
        rateLimitMap.forEach((value, key) => {
            if (now - value.lastReset > 60 * 1000) {
                rateLimitMap.delete(key);
            }
        });
    }

    // Skip rate limiting for auth routes (OAuth needs cookies to flow freely).
    if (
        request.nextUrl.pathname.startsWith('/api') &&
        !request.nextUrl.pathname.startsWith('/api/auth')
    ) {
        const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
        const ip = forwardedFor || request.headers.get('x-real-ip') || 'unknown';

        let limit = 100; // Default: 100 requests per minute
        const windowMs = 60 * 1000; // 1 minute

        // Stricter limit for Admin APIs (prevent brute-force)
        if (request.nextUrl.pathname.startsWith('/api/admin')) {
            limit = 10;
        }

        // Stricter limit for Finance APIs
        if (request.nextUrl.pathname.includes('/finance')) {
            limit = 20;
        }

        if (!rateLimitMap.has(ip)) {
            rateLimitMap.set(ip, {
                count: 0,
                lastReset: Date.now(),
            });
        }

        const ipData = rateLimitMap.get(ip)!;

        // Reset if window passed
        if (Date.now() - ipData.lastReset > windowMs) {
            ipData.count = 0;
            ipData.lastReset = Date.now();
        }

        if (ipData.count >= limit) {
            return new NextResponse('Too Many Requests', { status: 429 });
        }

        ipData.count += 1;
    }
    return NextResponse.next();
}

export const config = {
    matcher: ['/api/:path*', '/admin/:path*'],
};
