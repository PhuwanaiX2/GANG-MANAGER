import { Interaction } from 'discord.js';
import { db, gangRoles, members } from '@gang/database';
import { and, eq } from 'drizzle-orm';

export type PermissionLevel = 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER';

type GangRoleMapping = {
    discordRoleId: string;
    permissionLevel: string;
};

type ActiveGangMember = {
    id: string;
    gangId: string;
    discordId: string | null;
    name: string;
    gangRole: string;
    status: string;
    isActive: boolean;
};

const ROLE_ACCESS: Record<PermissionLevel, PermissionLevel[]> = {
    OWNER: ['OWNER'],
    ADMIN: ['OWNER', 'ADMIN'],
    TREASURER: ['OWNER', 'TREASURER'],
    ATTENDANCE_OFFICER: ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER'],
    MEMBER: ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'],
};

const ROLE_SYNC_PRIORITY: PermissionLevel[] = ['ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'];

export function normalizePermissionLevel(value: string | null | undefined): PermissionLevel | null {
    if (!value) return null;
    if (value === 'OWNER' || value === 'ADMIN' || value === 'TREASURER' || value === 'ATTENDANCE_OFFICER' || value === 'MEMBER') {
        return value;
    }
    return null;
}

export function hasPermissionLevel(
    userRole: string | null | undefined,
    requiredLevels: PermissionLevel[]
): boolean {
    const normalizedRole = normalizePermissionLevel(userRole);
    if (!normalizedRole) return false;

    return requiredLevels.some((requiredLevel) => ROLE_ACCESS[requiredLevel].includes(normalizedRole));
}

export function resolveSyncedGangRole(
    memberRoleIds: string[],
    mappings: GangRoleMapping[]
): PermissionLevel {
    const mappedPermissions = new Set<PermissionLevel>();

    for (const mapping of mappings) {
        if (!memberRoleIds.includes(mapping.discordRoleId)) {
            continue;
        }

        const normalizedPermission = normalizePermissionLevel(mapping.permissionLevel);
        if (!normalizedPermission) {
            continue;
        }

        // Safety rule: Discord role mapping alone never promotes someone to DB OWNER.
        mappedPermissions.add(normalizedPermission === 'OWNER' ? 'ADMIN' : normalizedPermission);
    }

    for (const level of ROLE_SYNC_PRIORITY) {
        if (mappedPermissions.has(level)) {
            return level;
        }
    }

    return 'MEMBER';
}

export async function getGangMemberByDiscordId(
    gangId: string,
    discordId: string
): Promise<ActiveGangMember | null> {
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gangId),
            eq(members.discordId, discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        columns: {
            id: true,
            gangId: true,
            discordId: true,
            name: true,
            gangRole: true,
            status: true,
            isActive: true,
        },
    });

    return member ?? null;
}

export async function getGangRoleMappings(gangId: string): Promise<GangRoleMapping[]> {
    return db.query.gangRoles.findMany({
        where: eq(gangRoles.gangId, gangId),
        columns: {
            discordRoleId: true,
            permissionLevel: true,
        },
    });
}

/**
 * Database member role is the source of truth for bot permissions.
 * Discord role mappings are only used to sync that DB role, not to authorize actions directly.
 */
export async function checkPermission(
    interaction: Interaction,
    gangId: string,
    requiredLevels: PermissionLevel[]
): Promise<boolean> {
    const dbMember = await getGangMemberByDiscordId(gangId, interaction.user.id);
    if (!dbMember) {
        return false;
    }

    return hasPermissionLevel(dbMember.gangRole, requiredLevels);
}

export async function getUserPermissionLevel(
    interaction: Interaction,
    gangId: string
): Promise<PermissionLevel | null> {
    const dbMember = await getGangMemberByDiscordId(gangId, interaction.user.id);
    return normalizePermissionLevel(dbMember?.gangRole);
}
