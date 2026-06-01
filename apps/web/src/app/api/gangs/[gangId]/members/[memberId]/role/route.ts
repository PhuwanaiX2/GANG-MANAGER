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

type RoleMapping = {
    permissionLevel: string;
    discordRoleId: string;
};

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

async function requireRoleManagementAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return new NextResponse('Forbidden: Only OWNER can change member roles', { status: 403 });
        }

        throw error;
    }
}

async function mutateDiscordMemberRole(input: {
    botToken: string;
    guildId: string;
    discordId: string;
    roleId: string;
    method: 'PUT' | 'DELETE';
}) {
    const response = await fetch(
        `https://discord.com/api/v10/guilds/${input.guildId}/members/${input.discordId}/roles/${input.roleId}`,
        {
            method: input.method,
            headers: { Authorization: `Bot ${input.botToken}` },
        }
    );

    if (response.ok) {
        return { ok: true as const };
    }

    return {
        ok: false as const,
        statusCode: response.status,
        responseBody: await readResponseText(response),
    };
}

async function syncDiscordRoleBeforeDbUpdate(input: {
    gangId: string;
    memberId: string;
    discordId: string | null;
    guildId: string | null;
    oldRole: string;
    newRole: GangRole;
    roleMappings: RoleMapping[];
}) {
    if (!input.discordId) {
        return { ok: true as const };
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken || !input.guildId) {
        logWarn('api.members.role.discord_sync_skipped_missing_config', {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            hasBotToken: Boolean(botToken),
            hasGuildId: Boolean(input.guildId),
        });
        return {
            ok: false as const,
            status: 503,
            error: 'ระบบยังเชื่อม Discord ไม่พร้อม จึงยังเปลี่ยนสิทธิ์สมาชิกที่ผูก Discord ไม่ได้',
        };
    }

    const oldRoleMapping = input.roleMappings.find(r => r.permissionLevel === input.oldRole);
    const newRoleMapping = input.roleMappings.find(r => r.permissionLevel === input.newRole);

    if (!newRoleMapping) {
        return {
            ok: false as const,
            status: 409,
            error: 'ยังไม่ได้เชื่อมยศ Discord สำหรับสิทธิ์นี้ ให้ใช้ /setup เพื่อเลือกหรือสร้างยศก่อนเปลี่ยนสิทธิ์สมาชิก',
        };
    }

    const roleChanged = oldRoleMapping?.discordRoleId !== newRoleMapping.discordRoleId;
    if (!roleChanged) {
        return { ok: true as const };
    }

    const addResult = await mutateDiscordMemberRole({
        botToken,
        guildId: input.guildId,
        discordId: input.discordId,
        roleId: newRoleMapping.discordRoleId,
        method: 'PUT',
    }).catch((error) => {
        logWarn('api.members.role.new_role_add_exception_before_db', {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: newRoleMapping.discordRoleId,
            error,
        });
        return null;
    });

    if (!addResult) {
        return {
            ok: false as const,
            status: 424,
            error: 'เชื่อมต่อ Discord เพื่อให้ยศใหม่ไม่สำเร็จ ระบบจึงยังไม่เปลี่ยนสิทธิ์ในเว็บ',
        };
    }

    if (!addResult.ok) {
        logWarn('api.members.role.new_role_add_blocked_before_db', {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: newRoleMapping.discordRoleId,
            statusCode: addResult.statusCode,
            responseBody: addResult.responseBody,
        });
        return {
            ok: false as const,
            status: 424,
            error: 'Discord ยังให้ยศใหม่ไม่ได้ กรุณาตรวจลำดับยศบอทและสิทธิ์ Manage Roles ก่อนเปลี่ยนสิทธิ์สมาชิก',
        };
    }

    if (!oldRoleMapping) {
        return { ok: true as const };
    }

    const removeResult = await mutateDiscordMemberRole({
        botToken,
        guildId: input.guildId,
        discordId: input.discordId,
        roleId: oldRoleMapping.discordRoleId,
        method: 'DELETE',
    }).catch((error) => {
        logWarn('api.members.role.old_role_remove_exception_before_db', {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: oldRoleMapping.discordRoleId,
            error,
        });
        return null;
    });

    if (removeResult?.ok) {
        return { ok: true as const };
    }

    logWarn('api.members.role.old_role_remove_blocked_before_db', {
        gangId: input.gangId,
        memberId: input.memberId,
        discordId: input.discordId,
        roleId: oldRoleMapping.discordRoleId,
        statusCode: removeResult?.statusCode,
        responseBody: removeResult?.responseBody,
    });

    const rollbackResult = await mutateDiscordMemberRole({
        botToken,
        guildId: input.guildId,
        discordId: input.discordId,
        roleId: newRoleMapping.discordRoleId,
        method: 'DELETE',
    }).catch((error) => {
        logWarn('api.members.role.rollback_new_role_remove_exception', {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: newRoleMapping.discordRoleId,
            error,
        });
        return null;
    });

    if (rollbackResult && !rollbackResult.ok) {
        logWarn('api.members.role.rollback_new_role_remove_failed', {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: newRoleMapping.discordRoleId,
            statusCode: rollbackResult.statusCode,
            responseBody: rollbackResult.responseBody,
        });
    }

    return {
        ok: false as const,
        status: 424,
        error: 'Discord ยังถอดยศเดิมไม่ได้ ระบบจึงยังไม่เปลี่ยนสิทธิ์ในเว็บเพื่อป้องกันข้อมูลไม่ตรงกัน',
    };
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

        const discordSync = await syncDiscordRoleBeforeDbUpdate({
            gangId,
            memberId,
            discordId: member.discordId,
            guildId: gang.discordGuildId,
            oldRole,
            newRole: role,
            roleMappings,
        });
        if (!discordSync.ok) {
            return NextResponse.json({ error: discordSync.error }, { status: discordSync.status });
        }

        // Update member role in database only after Discord sync is accepted.
        await db.update(members)
            .set({ gangRole: role, updatedAt: new Date() })
            .where(eq(members.id, memberId));

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
