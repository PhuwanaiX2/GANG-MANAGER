import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangs, auditLogs } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { logError } from '@/lib/logger';

const createMemberSchema = z.object({
    name: z.string().min(1).max(100),
    discordUsername: z.string().max(100).optional().transform((value) => value?.trim() || undefined),
});

async function requireMemberCreateAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'ADMIN' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
        }

        throw error;
    }
}

export async function POST(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const forbiddenResponse = await requireMemberCreateAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:members:create',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('members-create', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const body = await request.json();
        const validatedData = createMemberSchema.parse(body);

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { transferStatus: true },
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        const memberId = nanoid();
        const newMember = {
            id: memberId,
            gangId,
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
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'CREATE_MEMBER',
            targetType: 'MEMBER',
            targetId: memberId,
            newValue: JSON.stringify(newMember),
        });

        return NextResponse.json({ success: true, memberId });
    } catch (error) {
        logError('api.members.create.failed', error, {
            gangId,
            actorDiscordId,
        });
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
