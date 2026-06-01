import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { and, eq } from 'drizzle-orm';
import { authOptions } from '@/lib/auth';
import { db, gangRoles, gangs, members } from '@gang/database';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { expectedManagedPermissionsForRole, mutateDiscordMemberRole, normalizeManagedGangRole } from '@/lib/discordRoleSync';
import { logError, logWarn } from '@/lib/logger';

const MANAGED_PERMISSIONS = ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER', 'VERIFIED'] as const;

async function requireRoleSyncAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return new NextResponse('Forbidden: Only OWNER can sync Discord roles', { status: 403 });
        }

        throw error;
    }
}

export async function POST(
    request: NextRequest,
    props: { params: Promise<{ gangId: string }> }
) {
    const params = await props.params;
    const { gangId } = params;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const forbiddenResponse = await requireRoleSyncAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:members:sync-discord-roles',
            limit: 6,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('members-sync-discord-roles', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const botToken = process.env.DISCORD_BOT_TOKEN;
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { discordGuildId: true },
        });

        if (!botToken || !gang?.discordGuildId) {
            return NextResponse.json({ error: 'ระบบยังเชื่อม Discord ไม่พร้อม จึงยังซิงก์ยศไม่ได้' }, { status: 503 });
        }

        const [roleMappings, memberRows] = await Promise.all([
            db.query.gangRoles.findMany({
                where: eq(gangRoles.gangId, gangId),
                columns: { permissionLevel: true, discordRoleId: true },
            }),
            db.query.members.findMany({
                where: and(
                    eq(members.gangId, gangId),
                    eq(members.status, 'APPROVED'),
                    eq(members.isActive, true)
                ),
                columns: { id: true, discordId: true, gangRole: true, name: true },
            }),
        ]);

        const managedMappings = roleMappings.filter((mapping) =>
            MANAGED_PERMISSIONS.includes(mapping.permissionLevel as typeof MANAGED_PERMISSIONS[number])
        );
        if (managedMappings.length === 0) {
            return NextResponse.json({ error: 'ยังไม่พบ mapping ยศ Discord ของระบบ ให้รัน /setup ก่อน' }, { status: 409 });
        }

        const linkedMembers = memberRows.filter((member) => Boolean(member.discordId));
        const failures: Array<{ memberId: string; memberName: string; roleId: string; action: 'add' | 'remove'; reason: string }> = [];
        let changed = 0;
        let skippedOwners = 0;

        for (const member of linkedMembers) {
            if (member.gangRole === 'OWNER') {
                skippedOwners += 1;
                continue;
            }

            const expectedPermissions = new Set(expectedManagedPermissionsForRole(member.gangRole));
            const expectedRoleIds = new Set(
                managedMappings
                    .filter((mapping) => mapping.permissionLevel !== 'VERIFIED' && expectedPermissions.has(normalizeManagedGangRole(mapping.permissionLevel)))
                    .map((mapping) => mapping.discordRoleId)
            );

            for (const mapping of managedMappings) {
                const shouldHaveRole = expectedRoleIds.has(mapping.discordRoleId);
                const result = await mutateDiscordMemberRole({
                    botToken,
                    guildId: gang.discordGuildId,
                    discordId: member.discordId!,
                    roleId: mapping.discordRoleId,
                    method: shouldHaveRole ? 'PUT' : 'DELETE',
                }).catch((error) => {
                    logWarn('api.members.sync_discord_roles.mutation_exception', {
                        gangId,
                        memberId: member.id,
                        discordId: member.discordId,
                        roleId: mapping.discordRoleId,
                        action: shouldHaveRole ? 'add' : 'remove',
                        error,
                    });
                    return null;
                });

                if (result?.ok) {
                    changed += 1;
                    continue;
                }

                failures.push({
                    memberId: member.id,
                    memberName: member.name,
                    roleId: mapping.discordRoleId,
                    action: shouldHaveRole ? 'add' : 'remove',
                    reason: result ? `Discord ${result.statusCode}` : 'request_failed',
                });
            }
        }

        return NextResponse.json({
            success: failures.length === 0,
            checkedMembers: linkedMembers.length,
            checkedRoles: managedMappings.length,
            operations: changed,
            skippedOwners,
            failed: failures.length,
            failures: failures.slice(0, 20),
        });
    } catch (error) {
        logError('api.members.sync_discord_roles.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
