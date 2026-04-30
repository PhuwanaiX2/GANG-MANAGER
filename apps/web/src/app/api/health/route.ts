import { NextResponse } from 'next/server';
import { db } from '@gang/database';
import { logError } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET() {
    const startedAt = Date.now();

    try {
        await db.query.gangs.findFirst({
            columns: {
                id: true,
            },
        });

        return NextResponse.json({
            status: 'ok',
            app: 'web',
            database: 'up',
            uptimeSeconds: Math.floor(process.uptime()),
            responseTimeMs: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        logError('api.health.database_probe_failed', error, {
            responseTimeMs: Date.now() - startedAt,
        });

        return NextResponse.json({
            status: 'degraded',
            app: 'web',
            database: 'down',
            uptimeSeconds: Math.floor(process.uptime()),
            responseTimeMs: Date.now() - startedAt,
            timestamp: new Date().toISOString(),
            errorCode: 'DATABASE_UNAVAILABLE',
        }, {
            status: 503,
        });
    }
}
