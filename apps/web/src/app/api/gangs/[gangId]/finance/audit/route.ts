import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, auditLogs, members } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq, desc, and } from 'drizzle-orm';

export async function GET(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId } = params;
        const permissions = await getGangPermissions(gangId, session.user.discordId);

        if (!permissions.isMember) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Fetch logs with actor info
        const logs = await db.query.auditLogs.findMany({
            where: and(
                eq(auditLogs.gangId, gangId)
            ),
            orderBy: [desc(auditLogs.createdAt)],
            limit: 50, // Limit to last 50 actions
        });

        // Enrich with member names manually (or we could use relation if set up)
        // Since we only have Discord ID in logs, we try to find member in this gang
        // Optimization: Fetch all members involved at once? Or just return IDs and let frontend handle?
        // Let's try to map names if possible, but for now raw data is fine.

        return NextResponse.json(logs);

    } catch (error) {
        console.error('Audit Log API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
