import { NextResponse } from 'next/server';
import { db, systemAnnouncements } from '@gang/database';
import { sql, desc } from 'drizzle-orm';
import { enforceRouteRateLimit } from '@/lib/apiRateLimit';

export const dynamic = 'force-dynamic';

// GET — fetch active announcements for dashboard display (no admin check needed)
export async function GET(request: Request) {
    try {
        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:system-announcements',
            limit: 120,
            windowMs: 60 * 1000,
        });
        if (rateLimited) {
            return rateLimited;
        }

        const active = await db.query.systemAnnouncements.findMany({
            where: sql`${systemAnnouncements.isActive} = 1 AND (${systemAnnouncements.expiresAt} IS NULL OR ${systemAnnouncements.expiresAt} > unixepoch())`,
            orderBy: desc(systemAnnouncements.createdAt),
            columns: {
                id: true,
                title: true,
                content: true,
                type: true,
                createdAt: true,
            },
        });
        return NextResponse.json(active);
    } catch {
        // Table might not exist yet
        return NextResponse.json([]);
    }
}
