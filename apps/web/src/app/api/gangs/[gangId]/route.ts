
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { getGangPermissions } from '@/lib/permissions';
import { z } from 'zod';

const UpdateGangSchema = z.object({
    name: z.string().min(1, 'Gang name is required').max(50, 'Gang name is too long').optional(),
    logoUrl: z.string().url('URL ไม่ถูกต้อง').max(500).nullable().optional(),
});

export async function PUT(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId } = params;

        // Permission Check: Only OWNER can update gang settings
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isOwner) {
            return NextResponse.json({ error: 'Forbidden: Only Owner can update gang settings' }, { status: 403 });
        }

        const body = await request.json();
        const validation = UpdateGangSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid data', details: validation.error }, { status: 400 });
        }

        const { name, logoUrl } = validation.data;

        const updates: Record<string, any> = { updatedAt: new Date() };
        if (name !== undefined) updates.name = name;
        if (logoUrl !== undefined) updates.logoUrl = logoUrl;

        // Update Gang
        await db.update(gangs)
            .set(updates)
            .where(eq(gangs.id, gangId));

        return NextResponse.json({ success: true, name, logoUrl });

    } catch (error) {
        console.error('Update Gang Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
