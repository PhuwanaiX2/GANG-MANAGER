import type { IncomingMessage, ServerResponse } from 'http';
import { timingSafeEqual } from 'crypto';
import { logError } from './logger';

const MIN_ALERT_TEST_TOKEN_LENGTH = 16;

function getAlertTestToken(env: NodeJS.ProcessEnv = process.env) {
    const explicitToken = env.ALERT_TEST_TOKEN?.trim();
    if (explicitToken && explicitToken.length >= MIN_ALERT_TEST_TOKEN_LENGTH) {
        return explicitToken;
    }

    const webhookUrl = env.ALERT_WEBHOOK_URL?.trim();
    return webhookUrl && webhookUrl.length >= MIN_ALERT_TEST_TOKEN_LENGTH ? webhookUrl : null;
}

function getHeader(req: IncomingMessage, key: string) {
    const value = req.headers[key.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
}

function getProvidedToken(req: IncomingMessage) {
    const authorization = getHeader(req, 'authorization')?.trim();
    if (authorization?.toLowerCase().startsWith('bearer ')) {
        return authorization.slice('bearer '.length).trim();
    }

    return getHeader(req, 'x-alert-test-token')?.trim() || '';
}

function tokensMatch(expected: string, provided: string) {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

function writeJson(res: ServerResponse, status: number, payload: unknown, headers: Record<string, string> = {}) {
    res.writeHead(status, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
        ...headers,
    });
    res.end(JSON.stringify(payload));
}

export function maybeHandleAlertTestRequest(req: IncomingMessage, res: ServerResponse) {
    const path = new URL(req.url || '/', 'http://localhost').pathname;
    if (path !== '/alert-test') {
        return false;
    }

    const expectedToken = getAlertTestToken();
    if (!expectedToken) {
        writeJson(res, 404, { error: 'Not Found' });
        return true;
    }

    if (req.method !== 'POST') {
        writeJson(res, 405, { error: 'Method Not Allowed' }, { Allow: 'POST' });
        return true;
    }

    const providedToken = getProvidedToken(req);
    if (!providedToken || !tokensMatch(expectedToken, providedToken)) {
        writeJson(res, 401, { error: 'Unauthorized' });
        return true;
    }

    logError('manual.alert_test', new Error('Manual bot alert test'), {
        source: 'bot-alert-test-endpoint',
        triggeredAt: new Date().toISOString(),
    });

    writeJson(res, 200, {
        success: true,
        app: 'bot',
        event: 'manual.alert_test',
    });
    return true;
}
