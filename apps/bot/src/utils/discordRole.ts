import type { GuildMember, Role } from 'discord.js';

export function isRoleAssignableByBot(role: Pick<Role, 'editable' | 'managed'> | null | undefined) {
    return Boolean(role && !role.managed && role.editable !== false);
}

export function isMemberManageableByBot(member: Pick<GuildMember, 'manageable'> | null | undefined) {
    return Boolean(member && member.manageable !== false);
}

export function findAssignableRoleByName(
    guild: { roles: { cache: { find: (predicate: (role: Role) => boolean) => Role | undefined } } },
    roleName: string
) {
    return guild.roles.cache.find((role: Role) => role.name === roleName && isRoleAssignableByBot(role));
}
