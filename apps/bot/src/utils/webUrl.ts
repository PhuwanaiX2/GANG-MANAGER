import { logWarn } from './logger';

const DEFAULT_PUBLIC_WEB_URL = 'https://gang-manager.vercel.app';

function normalizeWebUrl(url: string) {
    return url.replace(/\/+$/, '');
}

function isLocalWebUrl(url: string) {
    try {
        const parsed = new URL(url);
        return ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(parsed.hostname);
    } catch {
        return true;
    }
}

export function resolvePublicWebUrl(env: NodeJS.ProcessEnv = process.env) {
    const configuredUrl = env.PUBLIC_WEB_URL || env.NEXTAUTH_URL || DEFAULT_PUBLIC_WEB_URL;
    const normalizedUrl = normalizeWebUrl(configuredUrl);
    const allowLocalWebUrl = env.ALLOW_LOCAL_WEB_URL === 'true';

    if (isLocalWebUrl(normalizedUrl) && !allowLocalWebUrl) {
        return DEFAULT_PUBLIC_WEB_URL;
    }

    return normalizedUrl;
}

export function getPublicWebUrl(context?: Record<string, unknown>) {
    const configuredUrl = process.env.PUBLIC_WEB_URL || process.env.NEXTAUTH_URL;
    const resolvedUrl = resolvePublicWebUrl();

    if (configuredUrl && resolvedUrl !== normalizeWebUrl(configuredUrl)) {
        logWarn('bot.web_url.local_production_fallback', {
            configuredUrl,
            resolvedUrl,
            ...context,
        });
    }

    return resolvedUrl;
}

export function buildDashboardUrl(gangId: string, context?: Record<string, unknown>) {
    return `${getPublicWebUrl(context)}/dashboard/${gangId}`;
}
