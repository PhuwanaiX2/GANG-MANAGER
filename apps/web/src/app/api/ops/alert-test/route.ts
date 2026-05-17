import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { logError } from '@/lib/logger';

const MIN_ALERT_TEST_TOKEN_LENGTH = 16;

function getAlertTestToken() {
    const explicitToken = process.env.ALERT_TEST_TOKEN?.trim();
    if (explicitToken && explicitToken.length >= MIN_ALERT_TEST_TOKEN_LENGTH) {
        return explicitToken;
    }

    const webhookUrl = process.env.ALERT_WEBHOOK_URL?.trim();
    return webhookUrl && webhookUrl.length >= MIN_ALERT_TEST_TOKEN_LENGTH ? webhookUrl : null;
}

function getProvidedToken(request: NextRequest) {
    const authorization = request.headers.get('authorization')?.trim();
    if (authorization?.toLowerCase().startsWith('bearer ')) {
        return authorization.slice('bearer '.length).trim();
    }

    return request.headers.get('x-alert-test-token')?.trim() || '';
}

function tokensMatch(expected: string, provided: string) {
    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: NextRequest) {
    const expectedToken = getAlertTestToken();
    if (!expectedToken) {
        return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const providedToken = getProvidedToken(request);
    if (!providedToken || !tokensMatch(expectedToken, providedToken)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logError('manual.alert_test', new Error('Manual web alert test'), {
        source: 'web-alert-test-endpoint',
        triggeredAt: new Date().toISOString(),
    });

    return NextResponse.json({
        success: true,
        app: 'web',
        event: 'manual.alert_test',
    });
}
