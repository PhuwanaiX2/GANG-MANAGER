import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_AVATAR_HOSTS = new Set([
    'cdn.discordapp.com',
    'media.discordapp.net',
    'images-ext-1.discordapp.net',
    'images-ext-2.discordapp.net',
    'res.cloudinary.com',
]);

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function getInitial(name: string | null) {
    const trimmed = (name || '').trim();
    return (trimmed[0] || '?').toUpperCase();
}

function fallbackSvg(name: string | null) {
    const initial = getInitial(name)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" role="img" aria-label="avatar">
<defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#5865F2"/><stop offset="1" stop-color="#23A559"/></linearGradient></defs>
<rect width="96" height="96" rx="24" fill="url(#g)"/>
<circle cx="72" cy="24" r="16" fill="rgba(255,255,255,.16)"/>
<text x="48" y="58" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="800" fill="#fff">${initial}</text>
</svg>`;
}

function svgResponse(name: string | null, status = 200) {
    return new NextResponse(fallbackSvg(name), {
        status,
        headers: {
            'Content-Type': 'image/svg+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

function parseTrustedAvatarUrl(value: string | null) {
    if (!value) return null;

    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return null;
        if (!ALLOWED_AVATAR_HOSTS.has(url.hostname)) return null;
        return url;
    } catch {
        return null;
    }
}

export async function GET(request: NextRequest) {
    const src = request.nextUrl.searchParams.get('src');
    const name = request.nextUrl.searchParams.get('name');
    const avatarUrl = parseTrustedAvatarUrl(src);

    if (!avatarUrl) {
        return svgResponse(name);
    }

    try {
        const upstream = await fetch(avatarUrl, {
            cache: 'force-cache',
            redirect: 'manual',
            signal: AbortSignal.timeout(3500),
            headers: {
                Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.8',
                'User-Agent': 'GangManagerAvatarProxy/1.0',
            },
        });

        if (!upstream.ok) {
            return svgResponse(name);
        }

        const contentType = upstream.headers.get('content-type') || '';
        if (!/^image\/(avif|webp|png|jpe?g|gif)$/i.test(contentType)) {
            return svgResponse(name);
        }

        const contentLength = Number(upstream.headers.get('content-length') || 0);
        if (contentLength > MAX_AVATAR_BYTES) {
            return svgResponse(name);
        }

        const body = await upstream.arrayBuffer();
        if (body.byteLength > MAX_AVATAR_BYTES) {
            return svgResponse(name);
        }

        return new NextResponse(body, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'X-Content-Type-Options': 'nosniff',
            },
        });
    } catch {
        return svgResponse(name);
    }
}
