import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiter
// Note: In a serverless environment (like Vercel), this Map will be reset frequently.
// For production, use Redis or a focused service like Upstash.
const rateLimitMap = new Map<string, { count: number; lastReset: number }>();

export function middleware(request: NextRequest) {
    // Cleanup if map gets too large (DoS prevention for memory)
    if (rateLimitMap.size > 10000) {
        const now = Date.now();
        rateLimitMap.forEach((value, key) => {
            if (now - value.lastReset > 60 * 1000) {
                rateLimitMap.delete(key);
            }
        });
    }

    // Skip rate limiting for auth routes (OAuth needs cookies to flow freely)
    // and Stripe webhooks (they have their own signature verification)
    if (
        request.nextUrl.pathname.startsWith('/api') &&
        !request.nextUrl.pathname.startsWith('/api/auth') &&
        !request.nextUrl.pathname.startsWith('/api/stripe/webhook')
    ) {
        // Use IP or 'unknown'
        const ip = request.headers.get('x-forwarded-for') || request.ip || 'unknown';

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
    matcher: '/api/:path*',
};
