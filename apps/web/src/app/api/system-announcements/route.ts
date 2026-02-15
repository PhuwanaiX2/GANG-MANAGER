import { NextResponse } from 'next/server';
import { db, systemAnnouncements } from '@gang/database';
import { sql, desc } from 'drizzle-orm';

// GET — fetch active announcements for dashboard display (no admin check needed)
export async function GET() {
    try {
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
