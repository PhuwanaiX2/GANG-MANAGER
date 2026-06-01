import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangs, gangRoles, auditLogs } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logError } from '@/lib/logger';
import { addMappedDiscordRole, removeMappedDiscordRole } from '@/lib/discordRoleSync';

type MemberStatus = 'APPROVED' | 'REJECTED';

async function requireStatusManagementAccess(gangId: string) {
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

export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; memberId: string }> }
) {
    const params = await props.params;
    const { gangId, memberId } = params;
    let actorDiscordId: string | null = null;
    let requestedStatus: MemberStatus | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const body = await request.json();
        const { status } = body as { status?: MemberStatus };
        requestedStatus = status || null;

        if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'สถานะสมาชิกไม่ถูกต้อง' }, { status: 400 });
        }

        const forbiddenResponse = await requireStatusManagementAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:members:status',
            limit: 40,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('members-status', gangId, memberId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const member = await db.query.members.findFirst({
            where: and(eq(members.id, memberId), eq(members.gangId, gangId)),
        });

        if (!member) {
            return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
        }

        if (member.gangRole === 'OWNER' && status === 'REJECTED') {
            return NextResponse.json({ error: 'ไม่สามารถปฏิเสธหัวหน้าแก๊งได้' }, { status: 403 });
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { discordGuildId: true, transferStatus: true },
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        const updateData: {
            status: MemberStatus;
            isActive: boolean;
            updatedAt: Date;
            transferStatus?: 'CONFIRMED';
        } = {
            status,
            isActive: status === 'APPROVED',
            updatedAt: new Date(),
        };

        if (status === 'APPROVED' && gang.transferStatus === 'ACTIVE') {
            updateData.transferStatus = 'CONFIRMED';
        }

        if (member.discordId) {
            const roleMappings = await db.query.gangRoles.findMany({
                where: eq(gangRoles.gangId, gangId),
            });

            const discordSync = status === 'APPROVED'
                ? await addMappedDiscordRole({
                    gangId,
                    memberId,
                    discordId: member.discordId,
                    guildId: gang.discordGuildId,
                    roleMappings,
                    permissionLevel: member.gangRole || 'MEMBER',
                    event: 'api.members.status.approve',
                    skipDiscordRoleSync: member.gangRole === 'OWNER',
                    skipReason: 'discord_guild_owner',
                })
                : await removeMappedDiscordRole({
                    gangId,
                    memberId,
                    discordId: member.discordId,
                    guildId: gang.discordGuildId,
                    roleMappings,
                    permissionLevel: member.gangRole || 'MEMBER',
                    event: 'api.members.status.reject',
                    strict: member.status === 'APPROVED' || Boolean(member.isActive),
                    skipDiscordRoleSync: member.gangRole === 'OWNER',
                    skipReason: 'discord_guild_owner',
                });

            if (!discordSync.ok) {
                return NextResponse.json({ error: discordSync.error }, { status: discordSync.status });
            }
        }

        await db.update(members)
            .set(updateData)
            .where(and(eq(members.id, memberId), eq(members.gangId, gangId)));

        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: status === 'APPROVED' ? 'MEMBER_APPROVE' : 'MEMBER_REJECT',
            targetType: 'MEMBER',
            targetId: memberId,
            oldValue: JSON.stringify({
                status: member.status,
                isActive: member.isActive,
                transferStatus: member.transferStatus,
            }),
            newValue: JSON.stringify(updateData),
        });

        return NextResponse.json({ success: true, status });
    } catch (error) {
        logError('api.members.status.update.failed', error, {
            gangId,
            memberId,
            actorDiscordId,
            requestedStatus,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
