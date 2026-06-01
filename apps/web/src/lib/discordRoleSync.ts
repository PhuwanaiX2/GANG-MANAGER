import { logWarn } from './logger';

export type ManagedGangRole = 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER';

export type RoleMapping = {
    permissionLevel: string;
    discordRoleId: string;
};

type MutationMethod = 'PUT' | 'DELETE';

type DiscordRoleSyncResult =
    | { ok: true; roleId?: string | null; skipped?: boolean; reason?: string }
    | { ok: false; status: number; error: string; roleId?: string | null };

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

export function normalizeManagedGangRole(role: string | null | undefined): ManagedGangRole {
    if (role === 'OWNER' || role === 'ADMIN' || role === 'TREASURER' || role === 'ATTENDANCE_OFFICER' || role === 'MEMBER') {
        return role;
    }

    return 'MEMBER';
}

export function expectedManagedPermissionsForRole(role: string | null | undefined): ManagedGangRole[] {
    const normalized = normalizeManagedGangRole(role);
    return normalized === 'OWNER' ? ['OWNER', 'MEMBER'] : [normalized];
}

function findRoleMapping(roleMappings: RoleMapping[], permissionLevel: string) {
    return roleMappings.find((role) => role.permissionLevel === permissionLevel);
}

export async function mutateDiscordMemberRole(input: {
    botToken: string;
    guildId: string;
    discordId: string;
    roleId: string;
    method: MutationMethod;
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

export async function addMappedDiscordRole(input: {
    gangId: string;
    memberId: string;
    discordId: string | null;
    guildId: string | null;
    roleMappings: RoleMapping[];
    permissionLevel: string | null | undefined;
    event: string;
    skipDiscordRoleSync?: boolean;
    skipReason?: string;
}): Promise<DiscordRoleSyncResult> {
    if (!input.discordId) {
        return { ok: true, skipped: true, reason: 'member_not_linked_to_discord' };
    }

    if (input.skipDiscordRoleSync) {
        return { ok: true, skipped: true, reason: input.skipReason || 'discord_role_sync_skipped' };
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    if (!botToken || !input.guildId) {
        logWarn(`${input.event}.discord_sync_missing_config`, {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            hasBotToken: Boolean(botToken),
            hasGuildId: Boolean(input.guildId),
        });
        return {
            ok: false,
            status: 503,
            error: 'ระบบยังเชื่อม Discord ไม่พร้อม จึงยังซิงก์ยศสมาชิกไม่ได้',
        };
    }

    const normalizedRole = normalizeManagedGangRole(input.permissionLevel);
    const roleMapping = findRoleMapping(input.roleMappings, normalizedRole);
    if (!roleMapping) {
        return {
            ok: false,
            status: 409,
            error: 'ยังไม่ได้ตั้งค่ายศสมาชิกสำหรับกลุ่มนี้ ให้ตั้งค่าจาก /setup หรือหน้า Settings ก่อน',
        };
    }

    const result = await mutateDiscordMemberRole({
        botToken,
        guildId: input.guildId,
        discordId: input.discordId,
        roleId: roleMapping.discordRoleId,
        method: 'PUT',
    }).catch((error) => {
        logWarn(`${input.event}.discord_role_add_exception`, {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: roleMapping.discordRoleId,
            error,
        });
        return null;
    });

    if (!result) {
        return {
            ok: false,
            status: 424,
            roleId: roleMapping.discordRoleId,
            error: 'เชื่อมต่อ Discord เพื่อให้ยศสมาชิกไม่สำเร็จ ระบบจึงยังไม่บันทึกสถานะในเว็บ',
        };
    }

    if (!result.ok) {
        logWarn(`${input.event}.discord_role_add_failed`, {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: roleMapping.discordRoleId,
            statusCode: result.statusCode,
            responseBody: result.responseBody,
        });
        return {
            ok: false,
            status: 424,
            roleId: roleMapping.discordRoleId,
            error: 'บอทยังให้ยศสมาชิกไม่ได้ กรุณาเช็กว่าบอทอยู่สูงกว่ายศนี้ใน Discord และมีสิทธิ์จัดการยศ',
        };
    }

    return { ok: true, roleId: roleMapping.discordRoleId };
}

export async function removeMappedDiscordRole(input: {
    gangId: string;
    memberId: string;
    discordId: string | null;
    guildId: string | null;
    roleMappings: RoleMapping[];
    permissionLevel: string | null | undefined;
    event: string;
    strict?: boolean;
    skipDiscordRoleSync?: boolean;
    skipReason?: string;
}): Promise<DiscordRoleSyncResult> {
    if (!input.discordId) {
        return { ok: true, skipped: true, reason: 'member_not_linked_to_discord' };
    }

    if (input.skipDiscordRoleSync) {
        return { ok: true, skipped: true, reason: input.skipReason || 'discord_role_sync_skipped' };
    }

    const botToken = process.env.DISCORD_BOT_TOKEN;
    const roleMapping = findRoleMapping(input.roleMappings, normalizeManagedGangRole(input.permissionLevel));

    if (!botToken || !input.guildId || !roleMapping) {
        const reason = !botToken || !input.guildId ? 'discord_config_missing' : 'role_mapping_missing';
        logWarn(`${input.event}.discord_role_remove_skipped`, {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            reason,
            strict: Boolean(input.strict),
        });

        if (input.strict) {
            return {
                ok: false,
                status: !botToken || !input.guildId ? 503 : 409,
                error: 'บอทยังถอดยศสมาชิกไม่ได้ ระบบจึงยังไม่เปลี่ยนสถานะในเว็บเพื่อกันข้อมูลไม่ตรงกัน',
            };
        }

        return { ok: true, skipped: true, reason };
    }

    const result = await mutateDiscordMemberRole({
        botToken,
        guildId: input.guildId,
        discordId: input.discordId,
        roleId: roleMapping.discordRoleId,
        method: 'DELETE',
    }).catch((error) => {
        logWarn(`${input.event}.discord_role_remove_exception`, {
            gangId: input.gangId,
            memberId: input.memberId,
            discordId: input.discordId,
            roleId: roleMapping.discordRoleId,
            error,
        });
        return null;
    });

    if (result?.ok) {
        return { ok: true, roleId: roleMapping.discordRoleId };
    }

    logWarn(`${input.event}.discord_role_remove_failed`, {
        gangId: input.gangId,
        memberId: input.memberId,
        discordId: input.discordId,
        roleId: roleMapping.discordRoleId,
        statusCode: result?.statusCode,
        responseBody: result?.responseBody,
        strict: Boolean(input.strict),
    });

    if (!input.strict) {
        return { ok: true, skipped: true, reason: 'discord_remove_failed_non_strict' };
    }

    return {
        ok: false,
        status: 424,
        roleId: roleMapping.discordRoleId,
        error: 'บอทยังถอดยศเดิมไม่ได้ ระบบจึงยังไม่เปลี่ยนสถานะในเว็บเพื่อกันข้อมูลไม่ตรงกัน',
    };
}
