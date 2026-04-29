import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangRoles, gangs, auditLogs } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logError, logWarn } from '@/lib/logger';

type GangRole = 'MEMBER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER';

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

async function requireRoleManagementAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'ADMIN' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return new NextResponse('Forbidden: Insufficient Permissions', { status: 403 });
        }

        throw error;
    }
}

// PATCH - Update member's gang role
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; memberId: string }> }
) {
    const params = await props.params;
    const { gangId, memberId } = params;
    let actorDiscordId: string | null = null;
    let requestedRole: GangRole | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const body = await request.json();
        const { role } = body as { role: GangRole };
        requestedRole = role;

        // Validate role
        if (!['ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'].includes(role)) {
            return NextResponse.json({ error: 'ยศไม่ถูกต้อง' }, { status: 400 });
        }

        const forbiddenResponse = await requireRoleManagementAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:members:role',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('members-role', gangId, memberId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        // Get the member to update
        const member = await db.query.members.findFirst({
            where: and(eq(members.id, memberId), eq(members.gangId, gangId)),
        });

        if (!member) {
            return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
        }

        // Prevent changing OWNER role (should be handled manually or via dedicated flow)
        if (member.gangRole === 'OWNER') {
            return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนยศหัวหน้าแก๊งได้' }, { status: 403 });
        }

        const oldRole = member.gangRole || 'MEMBER';

        // Get gang info for Discord sync
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        // Get role mappings
        const roleMappings = await db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, gangId),
        });

        // Update member role in database
        await db.update(members)
            .set({ gangRole: role, updatedAt: new Date() })
            .where(eq(members.id, memberId));

        // Sync Discord roles
        if (member.discordId) {
            const botToken = process.env.DISCORD_BOT_TOKEN;
            if (botToken && gang.discordGuildId) {
                const oldRoleMapping = roleMappings.find(r => r.permissionLevel === oldRole);
                const newRoleMapping = roleMappings.find(r => r.permissionLevel === role);

                // Remove old role (if different and exists)
                if (oldRoleMapping && oldRoleMapping.discordRoleId !== newRoleMapping?.discordRoleId) {
                    try {
                        const response = await fetch(
                            `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${oldRoleMapping.discordRoleId}`,
                            {
                                method: 'DELETE',
                                headers: { Authorization: `Bot ${botToken}` },
                            }
                        );

                        if (!response.ok) {
                            const responseBody = await readResponseText(response);
                            logWarn('api.members.role.old_role_remove_failed', {
                                gangId,
                                memberId,
                                discordId: member.discordId,
                                roleId: oldRoleMapping.discordRoleId,
                                statusCode: response.status,
                                responseBody,
                            });
                        }
                    } catch (e) {
                        logWarn('api.members.role.old_role_remove_error', {
                            gangId,
                            memberId,
                            discordId: member.discordId,
                            roleId: oldRoleMapping.discordRoleId,
                            error: e,
                        });
                    }
                }

                // Add new role
                if (newRoleMapping) {
                    try {
                        const response = await fetch(
                            `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${newRoleMapping.discordRoleId}`,
                            {
                                method: 'PUT',
                                headers: { Authorization: `Bot ${botToken}` },
                            }
                        );

                        if (!response.ok) {
                            const responseBody = await readResponseText(response);
                            logWarn('api.members.role.new_role_add_failed', {
                                gangId,
                                memberId,
                                discordId: member.discordId,
                                roleId: newRoleMapping.discordRoleId,
                                statusCode: response.status,
                                responseBody,
                            });
                        }
                    } catch (e) {
                        logWarn('api.members.role.new_role_add_error', {
                            gangId,
                            memberId,
                            discordId: member.discordId,
                            roleId: newRoleMapping.discordRoleId,
                            error: e,
                        });
                    }
                }
            }
        }

        // Audit log
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'MEMBER_UPDATE',
            targetType: 'MEMBER',
            targetId: memberId,
            oldValue: JSON.stringify({ gangRole: oldRole }),
            newValue: JSON.stringify({ gangRole: role }),
        });

        return NextResponse.json({ success: true, role });
    } catch (error) {
        logError('api.members.role.update.failed', error, {
            gangId,
            memberId,
            actorDiscordId,
            requestedRole,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
