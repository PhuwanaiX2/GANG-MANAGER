import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangs, gangRoles, auditLogs } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logError, logWarn } from '@/lib/logger';

type MemberStatus = 'APPROVED' | 'REJECTED';

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

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

        await db.update(members)
            .set(updateData)
            .where(and(eq(members.id, memberId), eq(members.gangId, gangId)));

        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken && gang.discordGuildId && member.discordId) {
            const roleMappings = await db.query.gangRoles.findMany({
                where: eq(gangRoles.gangId, gangId),
            });
            const memberRole = member.gangRole || 'MEMBER';
            const roleMapping = roleMappings.find((role) => role.permissionLevel === memberRole);

            if (status === 'APPROVED' && roleMapping) {
                try {
                    const response = await fetch(
                        `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${roleMapping.discordRoleId}`,
                        {
                            method: 'PUT',
                            headers: { Authorization: `Bot ${botToken}` },
                        }
                    );

                    if (!response.ok) {
                        const responseBody = await readResponseText(response);
                        logWarn('api.members.status.approval_role_assign_failed', {
                            gangId,
                            memberId,
                            discordId: member.discordId,
                            roleId: roleMapping.discordRoleId,
                            statusCode: response.status,
                            responseBody,
                        });
                    }
                } catch (error) {
                    logWarn('api.members.status.approval_role_assign_error', {
                        gangId,
                        memberId,
                        discordId: member.discordId,
                        roleId: roleMapping.discordRoleId,
                        error,
                    });
                }

                try {
                    const response = await fetch(
                        `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                Authorization: `Bot ${botToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ nick: member.name }),
                        }
                    );

                    if (!response.ok) {
                        const responseBody = await readResponseText(response);
                        logWarn('api.members.status.approval_nickname_update_failed', {
                            gangId,
                            memberId,
                            discordId: member.discordId,
                            statusCode: response.status,
                            responseBody,
                        });
                    }
                } catch (error) {
                    logWarn('api.members.status.approval_nickname_update_error', {
                        gangId,
                        memberId,
                        discordId: member.discordId,
                        error,
                    });
                }
            }

            if (status === 'REJECTED' && roleMapping) {
                try {
                    const response = await fetch(
                        `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${roleMapping.discordRoleId}`,
                        {
                            method: 'DELETE',
                            headers: { Authorization: `Bot ${botToken}` },
                        }
                    );

                    if (!response.ok) {
                        const responseBody = await readResponseText(response);
                        logWarn('api.members.status.rejection_role_remove_failed', {
                            gangId,
                            memberId,
                            discordId: member.discordId,
                            roleId: roleMapping.discordRoleId,
                            statusCode: response.status,
                            responseBody,
                        });
                    }
                } catch (error) {
                    logWarn('api.members.status.rejection_role_remove_error', {
                        gangId,
                        memberId,
                        discordId: member.discordId,
                        roleId: roleMapping.discordRoleId,
                        error,
                    });
                }
            }
        }

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
