import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangs, auditLogs } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const createMemberSchema = z.object({
    name: z.string().min(1).max(100),
    discordUsername: z.string().max(100).optional().transform((value) => value?.trim() || undefined),
});

export async function POST(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const permissions = await getGangPermissions(params.gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
        }

        const body = await request.json();
        const validatedData = createMemberSchema.parse(body);

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
            columns: { transferStatus: true },
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        const memberId = nanoid();
        const newMember = {
            id: memberId,
            gangId: params.gangId,
            name: validatedData.name.trim(),
            discordUsername: validatedData.discordUsername || null,
            status: 'APPROVED' as const,
            isActive: true,
            gangRole: 'MEMBER' as const,
            transferStatus: gang.transferStatus === 'ACTIVE' ? 'CONFIRMED' as const : null,
        };

        await db.insert(members).values(newMember);

        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId: params.gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'CREATE_MEMBER',
            targetType: 'MEMBER',
            targetId: memberId,
            newValue: JSON.stringify(newMember),
        });

        return NextResponse.json({ success: true, memberId });
    } catch (error) {
        console.error('[MEMBER_CREATE_ERROR]', error);
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
