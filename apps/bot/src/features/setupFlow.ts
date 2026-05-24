import {
    ButtonInteraction,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    EmbedBuilder,
    ModalSubmitInteraction,
    ButtonStyle,
    ButtonBuilder,
    PermissionFlagsBits,
    ChannelType,
    CategoryChannel,
    Role,
    ChatInputCommandInteraction,
    TextChannel,
    AnySelectMenuInteraction,
    RoleSelectMenuBuilder,
    type PermissionResolvable,
    MessageFlags,
} from 'discord.js';
import { registerButtonHandler, registerModalHandler, registerSelectMenuHandler } from '../handlers';
import { db, gangs, gangSettings, gangRoles, members, licenses, getTierConfig, normalizeSubscriptionTier, canAccessFeature, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { logError, logInfo, logWarn } from '../utils/logger';
import { checkPermission, syncDiscordGuildOwnerMembership } from '../utils/permissions';
import { findAssignableRoleByName, isRoleAssignableByBot } from '../utils/discordRole';
import { buildDashboardUrl } from '../utils/webUrl';

const TRIAL_DAYS = 7;
type ManagedGangPermission = 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER';
type InternalSetupPermission = ManagedGangPermission | 'VERIFIED';
type SetupRoleConfig = {
    name: string;
    color: string;
    permission: InternalSetupPermission;
    hoist: boolean;
    preserveExistingMapping?: boolean;
};
type PendingSetupDraft = {
    id: string;
    guildId: string;
    ownerDiscordId: string;
    gangName: string;
    trialExpiresAt: Date;
    createdAt: number;
};
type TransferRollback = {
    oldGangId: string;
    oldTier: 'FREE' | 'TRIAL' | 'PREMIUM';
    oldExpiresAt: Date | null;
};
type SetupTarget = {
    gangId: string;
    createdNewGang: boolean;
    transferredInfo: string;
    resolvedTier: 'FREE' | 'TRIAL' | 'PREMIUM';
    rollbackTransfer?: TransferRollback;
};
export const AUTO_SETUP_MANAGED_CHANNEL_NAMES = [
    'ยืนยันตัวตน',
    'ลงทะเบียน',
    'ประกาศ',
    'Website',
    'เช็คชื่อ',
    'สรุปเช็คชื่อ',
    'แจ้งลา',
    'แจ้งธุรกรรม',
    'แผงควบคุม',
    'log-ระบบ',
    '📋-คำขอและอนุมัติ',
] as const;
export const AUTO_SETUP_DEPRECATED_CHANNEL_NAMES = [
    'กฎแก๊ง',
    'แดชบอร์ด',
    'bot-commands',
] as const;
const SETUP_CHANNEL_ALIASES: Record<string, string[]> = {
    'Website': ['เว็บ', 'แดชบอร์ด', 'dashboard', 'ลิงก์เว็บ'],
    '📋-คำขอและอนุมัติ': ['คำขอเข้าแก๊ง', 'คำขอและอนุมัติ', 'requests'],
    'log-ระบบ': ['bot-commands', 'admin-log', 'gang-log'],
    'ประกาศ': ['announcements', 'ประกาศแก๊ง'],
    'แจ้งธุรกรรม': ['การเงิน', 'ระบบการเงิน', 'finance'],
    'แจ้งลา': ['ลา', 'leave'],
    'สรุปเช็คชื่อ': ['attendance-summary', 'summary-attendance'],
    'แผงควบคุม': ['admin-panel', 'control-panel'],
};
const PENDING_SETUP_TTL_MS = 15 * 60 * 1000;
const pendingSetupDrafts = new Map<string, PendingSetupDraft>();

type SetupInteraction = ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction | AnySelectMenuInteraction;
type SetupComponentInteraction = ButtonInteraction | AnySelectMenuInteraction;

class SetupResourceError extends Error {
    constructor(
        public readonly code: string,
        public readonly userMessage: string
    ) {
        super(userMessage);
        this.name = 'SetupResourceError';
    }
}

const BOT_MANAGED_CHANNEL_ALLOW = [
    'ViewChannel',
    'SendMessages',
    'EmbedLinks',
    'ReadMessageHistory',
] as const;

type SetupPermissionOverwrite = {
    id: string;
    allow?: PermissionResolvable;
    deny?: PermissionResolvable;
};

type SetupChannelAccessTarget = {
    permissionsFor?: (...args: any[]) => { has: (permission: PermissionResolvable) => boolean } | null;
};

type SetupAdminPanelSettings = {
    logChannelId?: string | null;
    requestsChannelId?: string | null;
};

type SetupDiagnostics = {
    roleHierarchyWarning?: string | null;
    messageWarnings?: string[];
};

type CreateDefaultResourceOptions = {
    verifiedRoleId?: string | null;
};

const SETUP_SERVER_ADMIN_DENIED_MESSAGE = '❌ ต้องเป็น Administrator ของ Discord server ก่อนเริ่มติดตั้งระบบ';
const SETUP_GANG_ADMIN_DENIED_MESSAGE = '❌ ปุ่มนี้ใช้ได้เฉพาะหัวหน้าแก๊งหรือแอดมินแก๊งเท่านั้น หากต้องการซ่อมระบบให้ขอสิทธิ์ Gang Admin ก่อน';
const MANAGED_LEAVE_PANEL_BUTTON_IDS = ['request_leave_late', 'request_leave_1day', 'request_leave_multi'];

export type BotRoleHierarchyIssue = {
    botRoleId: string;
    botRoleName: string;
    roleCount: number;
    roleNames: string[];
    warning: string;
};

const REQUIRED_BOT_MANAGED_CHANNEL_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.ReadMessageHistory,
] as const;

export function withBotManagedChannelAccess(
    botMemberId: string,
    permissionOverwrites: SetupPermissionOverwrite[] = []
) {
    return [
        ...permissionOverwrites.filter((overwrite) => overwrite.id !== botMemberId),
        { id: botMemberId, allow: [...BOT_MANAGED_CHANNEL_ALLOW] },
    ];
}

export function isDiscordMissingAccessError(error: unknown) {
    const maybeError = error as { code?: unknown; name?: unknown; message?: unknown } | null;
    return (
        maybeError?.code === 50001 ||
        maybeError?.code === '50001' ||
        String(maybeError?.name ?? '').includes('DiscordAPIError[50001]') ||
        String(maybeError?.message ?? '').includes('Missing Access')
    );
}

export function hasBotManagedChannelAccess(channel: SetupChannelAccessTarget | null | undefined, botMember: unknown) {
    const permissions = channel?.permissionsFor?.(botMember);
    if (!permissions) return false;
    return REQUIRED_BOT_MANAGED_CHANNEL_PERMISSIONS.every((permission) => permissions.has(permission));
}

function hasBotManagedChannelView(channel: SetupChannelAccessTarget | null | undefined, botMember: unknown) {
    const permissions = channel?.permissionsFor?.(botMember);
    return Boolean(permissions?.has(PermissionFlagsBits.ViewChannel));
}

function getChannelCacheValues(cache: any) {
    if (!cache) return [];
    if (typeof cache.values === 'function') return Array.from(cache.values());
    if (typeof cache.toJSON === 'function') return cache.toJSON();
    if (Array.isArray(cache)) return cache;
    return [];
}

export function getBotRoleHierarchyIssue(
    guild: { id: string; roles: { cache: any } } | null | undefined,
    botMember: { roles?: { highest?: Pick<Role, 'id' | 'name' | 'position'> | null } } | null | undefined
): BotRoleHierarchyIssue | null {
    const botRole = botMember?.roles?.highest;
    if (!guild || !botRole || typeof botRole.position !== 'number') return null;

    const rolesAbove = getChannelCacheValues(guild.roles.cache)
        .filter((role: any) => role?.id && role.id !== guild.id && role.id !== botRole.id && typeof role.position === 'number')
        .filter((role: Pick<Role, 'position'>) => role.position > botRole.position)
        .sort((a: Pick<Role, 'position'>, b: Pick<Role, 'position'>) => b.position - a.position) as Pick<Role, 'id' | 'name' | 'position'>[];

    if (rolesAbove.length === 0) return null;

    const visibleRoles = rolesAbove.slice(0, 5).map(role => role.name);
    const extraCount = rolesAbove.length - visibleRoles.length;
    const roleList = `${visibleRoles.join(', ')}${extraCount > 0 ? ` และอีก ${extraCount} ยศ` : ''}`;

    return {
        botRoleId: botRole.id,
        botRoleName: botRole.name,
        roleCount: rolesAbove.length,
        roleNames: rolesAbove.map(role => role.name),
        warning: `พบยศ ${rolesAbove.length} ยศที่อยู่เหนือ ${botRole.name}: ${roleList}\nถ้านำยศเหล่านี้มาใช้เป็นยศแก๊ง บอทจะให้ยศหรือถอนยศไม่ได้ ให้ใช้ยศแก๊งที่อยู่ใต้ยศของบอท`,
    };
}

export function pickSetupAdminPanelChannel(
    guild: { channels: { cache: any } } | null | undefined,
    settings: SetupAdminPanelSettings | null | undefined,
    botMember: unknown
) {
    const cache = guild?.channels.cache;
    if (!cache) return null;

    const candidates: any[] = [];
    const seen = new Set<string>();
    const addCandidate = (channel: any) => {
        if (!channel?.id || seen.has(channel.id)) return;
        if (typeof channel.isTextBased === 'function' && !channel.isTextBased()) return;
        seen.add(channel.id);
        candidates.push(channel);
    };

    for (const channel of getChannelCacheValues(cache)) {
        if (channel?.name === 'แผงควบคุม') {
            addCandidate(channel);
        }
    }
    if (settings?.logChannelId) addCandidate(cache.get(settings.logChannelId));
    if (settings?.requestsChannelId) addCandidate(cache.get(settings.requestsChannelId));
    for (const channel of getChannelCacheValues(cache)) {
        if (channel?.name === 'log-ระบบ' || channel?.name === 'bot-commands') {
            addCandidate(channel);
        }
    }

    return candidates.find(channel => hasBotManagedChannelAccess(channel, botMember)) ?? null;
}

function resolveInteractionGuild(interaction: SetupInteraction) {
    if (!interaction.guildId) return null;
    return interaction.guild ?? interaction.client.guilds.cache.get(interaction.guildId) ?? null;
}

function getSetupPreflightIssue(interaction: SetupInteraction) {
    const guild = resolveInteractionGuild(interaction);
    if (!guild) {
        return 'ยังไม่พบบอทในเซิร์ฟเวอร์นี้ กรุณาเชิญบอทเข้าเซิร์ฟเวอร์ก่อน แล้วค่อยเริ่ม /setup ใหม่อีกครั้ง';
    }

    if (!guild.members.me) {
        return 'บอทยังไม่ได้เป็นสมาชิกจริงในเซิร์ฟเวอร์นี้ กรุณาเชิญบอทเข้าเซิร์ฟเวอร์ก่อน แล้วค่อยเริ่ม /setup ใหม่อีกครั้ง';
    }

    return null;
}

function getSetupPermissionIssue(interaction: SetupInteraction) {
    const preflightIssue = getSetupPreflightIssue(interaction);
    if (preflightIssue) {
        return preflightIssue;
    }

    const guild = resolveInteractionGuild(interaction);
    const botMember = guild?.members.me;
    if (!botMember?.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return 'บอทยังไม่มีสิทธิ์ Manage Roles หรือ Manage Channels กรุณาให้สิทธิ์บอทก่อน แล้วค่อยเริ่ม /setup ใหม่อีกครั้ง';
    }

    return null;
}

function createTrialExpiresAt() {
    const trialExpiresAt = new Date();
    trialExpiresAt.setDate(trialExpiresAt.getDate() + TRIAL_DAYS);
    return trialExpiresAt;
}

function cleanupExpiredPendingSetupDrafts() {
    const now = Date.now();
    for (const [id, draft] of pendingSetupDrafts.entries()) {
        if (now - draft.createdAt > PENDING_SETUP_TTL_MS) {
            pendingSetupDrafts.delete(id);
        }
    }
}

function createPendingSetupDraft(guildId: string, ownerDiscordId: string, gangName: string) {
    cleanupExpiredPendingSetupDrafts();
    const draft: PendingSetupDraft = {
        id: nanoid(),
        guildId,
        ownerDiscordId,
        gangName,
        trialExpiresAt: createTrialExpiresAt(),
        createdAt: Date.now(),
    };
    pendingSetupDrafts.set(draft.id, draft);
    return draft;
}

function parseSetupModeTarget(customId: string, prefix: 'setup_mode_auto_' | 'setup_mode_manual_' | 'setup_verify_auto_' | 'setup_verify_select_') {
    const targetId = customId.replace(prefix, '');
    if (targetId.startsWith('pending_')) {
        return { pendingId: targetId.replace('pending_', '') };
    }
    return { gangId: targetId };
}

function isActiveTransferableSetupSubscription(gang: any, now: Date) {
    const tier = normalizeSubscriptionTier(gang?.subscriptionTier);
    if (tier === 'FREE') return false;

    const expiresAt = gang?.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;
    if (tier === 'TRIAL') {
        return Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime());
    }

    return !expiresAt || (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() > now.getTime());
}

async function applyOwnerSubscriptionTransfer(gangId: string, ownerDiscordId: string, guildId: string) {
    const ownerOldMemberships = await db.query.members.findMany({
        where: and(
            eq(members.discordId, ownerDiscordId),
            eq(members.gangRole, 'OWNER')
        ),
        with: { gang: true },
    });
    const now = new Date();

    const dissolvedGangWithSub = ownerOldMemberships.find(m =>
        m.gang &&
        !m.gang.isActive &&
        m.gang.dissolvedAt &&
        isActiveTransferableSetupSubscription(m.gang, now)
    );

    if (!dissolvedGangWithSub?.gang) {
        if (ownerOldMemberships.some(m => m.gang)) {
            await db.update(gangs)
                .set({
                    subscriptionTier: 'FREE',
                    subscriptionExpiresAt: null,
                })
                .where(eq(gangs.id, gangId));

            logInfo('bot.setup.trial_blocked_previous_owner_gang', {
                guildId,
                ownerDiscordId,
                gangId,
            });

            return {
                transferredInfo: '\nℹ️ บัญชีนี้เคยสร้างแก๊งแล้ว Trial ใช้ได้ครั้งแรกเท่านั้น แก๊งใหม่จึงเริ่มที่แพลน Free',
                resolvedTier: 'FREE' as const,
                rollbackTransfer: undefined,
            };
        }

        return {
            transferredInfo: '',
            resolvedTier: 'TRIAL' as const,
            rollbackTransfer: undefined,
        };
    }

    const oldGang = dissolvedGangWithSub.gang;
    const oldTier = normalizeSubscriptionTier(oldGang.subscriptionTier);
    const rollbackTransfer: TransferRollback = {
        oldGangId: oldGang.id,
        oldTier,
        oldExpiresAt: oldGang.subscriptionExpiresAt,
    };

    await db.update(gangs)
        .set({
            subscriptionTier: oldTier,
            subscriptionExpiresAt: oldGang.subscriptionExpiresAt,
        })
        .where(eq(gangs.id, gangId));

    await db.update(gangs)
        .set({
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: null,
        })
        .where(eq(gangs.id, oldGang.id));

    logInfo('bot.setup.subscription_transferred', {
        guildId,
        ownerDiscordId,
        fromGangId: oldGang.id,
        toGangId: gangId,
        subscriptionTier: oldTier,
    });

    return {
        transferredInfo: `\n🔄 **โอนแพ็คเกจ ${oldTier}** จากแก๊ง "${oldGang.name}" สำเร็จ!`,
        resolvedTier: oldTier,
        rollbackTransfer,
    };
}

async function rollbackNewSetupGang(target: SetupTarget) {
    if (!target.createdNewGang) {
        return;
    }

    if (target.rollbackTransfer) {
        await db.update(gangs)
            .set({
                subscriptionTier: target.rollbackTransfer.oldTier,
                subscriptionExpiresAt: target.rollbackTransfer.oldExpiresAt,
            })
            .where(eq(gangs.id, target.rollbackTransfer.oldGangId));
    }

    await db.delete(gangRoles).where(eq(gangRoles.gangId, target.gangId));
    await db.delete(members).where(eq(members.gangId, target.gangId));
    await db.delete(gangSettings).where(eq(gangSettings.gangId, target.gangId));
    await db.delete(gangs).where(eq(gangs.id, target.gangId));
}

async function resolveSetupTarget(
    interaction: SetupComponentInteraction,
    parsedTarget: { gangId?: string; pendingId?: string }
): Promise<SetupTarget> {
    if (parsedTarget.gangId) {
        const existingGang = await db.query.gangs.findFirst({ where: eq(gangs.id, parsedTarget.gangId) });
        if (!existingGang) {
            throw new SetupResourceError(
                'GANG_NOT_FOUND',
                'ข้อมูลแก๊งไม่ถูกต้องหรือถูกลบไปแล้ว กรุณาพิมพ์ `/setup` เพื่อเริ่มตั้งค่าใหม่ตั้งแต่ต้น'
            );
        }

        return {
            gangId: parsedTarget.gangId,
            createdNewGang: false,
            transferredInfo: '',
            resolvedTier: normalizeSubscriptionTier(existingGang.subscriptionTier),
        };
    }

    const pendingId = parsedTarget.pendingId;
    const draft = pendingId ? pendingSetupDrafts.get(pendingId) : null;
    if (!draft) {
        throw new SetupResourceError(
            'PENDING_SETUP_EXPIRED',
            'ข้อมูลตั้งค่าชั่วคราวหมดอายุแล้ว กรุณาพิมพ์ `/setup` เพื่อเริ่มใหม่อีกครั้ง'
        );
    }

    if (draft.guildId !== interaction.guildId || draft.ownerDiscordId !== interaction.user.id) {
        throw new SetupResourceError(
            'PENDING_SETUP_MISMATCH',
            'ปุ่มตั้งค่านี้ไม่ตรงกับเซิร์ฟเวอร์หรือผู้เริ่ม setup กรุณาพิมพ์ `/setup` ใหม่ด้วยบัญชีหัวหน้าแก๊ง'
        );
    }

    const existingGang = await db.query.gangs.findFirst({ where: eq(gangs.discordGuildId, draft.guildId) });
    if (existingGang) {
        pendingSetupDrafts.delete(draft.id);
        await db.update(gangs)
            .set({ name: draft.gangName })
            .where(eq(gangs.id, existingGang.id));

        return {
            gangId: existingGang.id,
            createdNewGang: false,
            transferredInfo: '',
            resolvedTier: normalizeSubscriptionTier(existingGang.subscriptionTier),
        };
    }

    const gangId = nanoid();
    await db.insert(gangs).values({
        id: gangId,
        discordGuildId: draft.guildId,
        name: draft.gangName,
        subscriptionTier: 'TRIAL',
        subscriptionExpiresAt: draft.trialExpiresAt,
    });
    await db.insert(gangSettings).values({ id: nanoid(), gangId });

    const transfer = await applyOwnerSubscriptionTransfer(gangId, draft.ownerDiscordId, draft.guildId);
    pendingSetupDrafts.delete(draft.id);

    return {
        gangId,
        createdNewGang: true,
        transferredInfo: transfer.transferredInfo,
        resolvedTier: transfer.resolvedTier,
        rollbackTransfer: transfer.rollbackTransfer,
    };
}

export async function ensureSetupRoleMapping(
    guild: { id: string; roles: { cache: any; create: (options: any) => Promise<Role> } },
    gangId: string,
    config: SetupRoleConfig
) {
    const existingByPermission = await db.query.gangRoles.findFirst({
        where: (table, { and, eq }) => and(
            eq(table.gangId, gangId),
            eq(table.permissionLevel, config.permission)
        )
    });

    let role = config.preserveExistingMapping === false
        ? undefined
        : existingByPermission?.discordRoleId
        ? guild.roles.cache.get(existingByPermission.discordRoleId)
        : undefined;

    if (role && !isRoleAssignableByBot(role)) {
        logWarn('bot.setup.mapped_role_unmanageable_ignored', {
            guildId: guild.id,
            gangId,
            permission: config.permission,
            roleId: role.id,
            managed: role.managed,
            editable: role.editable,
        });
        role = undefined;
    }

    if (!role) {
        role = findAssignableRoleByName(guild, config.name);

        if (!role) {
            role = await guild.roles.create({
                name: config.name,
                colors: { primaryColor: config.color },
                hoist: config.hoist,
                reason: 'Gang Management Setup',
            });
        }
    }

    if (existingByPermission) {
        if (existingByPermission.discordRoleId !== role.id) {
            await db.update(gangRoles)
                .set({ discordRoleId: role.id })
                .where(eq(gangRoles.id, existingByPermission.id));
        }
    } else {
        await db.insert(gangRoles).values({
            id: nanoid(),
            gangId: gangId,
            discordRoleId: role.id,
            permissionLevel: config.permission,
        });
    }

    return role as Role;
}

export async function ensureVerifiedRoleMapping(
    guild: { id: string; roles: { cache: any; create: (options: any) => Promise<Role> } },
    gangId: string,
    selectedRoleId?: string | null
) {
    const existingByPermission = await db.query.gangRoles.findFirst({
        where: (table, { and, eq }) => and(
            eq(table.gangId, gangId),
            eq(table.permissionLevel, 'VERIFIED')
        )
    });

    let role = selectedRoleId
        ? guild.roles.cache.get(selectedRoleId)
        : existingByPermission?.discordRoleId
            ? guild.roles.cache.get(existingByPermission.discordRoleId)
            : undefined;

    if (role && !isRoleAssignableByBot(role)) {
        if (selectedRoleId) {
            throw new SetupResourceError(
                'VERIFY_ROLE_UNMANAGEABLE',
                `บอทยังจัดการยศ "${role.name}" ไม่ได้ กรุณาย้ายยศบอทให้อยู่สูงกว่ายศนี้ก่อน แล้วเลือกใหม่อีกครั้ง`
            );
        }

        logWarn('bot.setup.verified_mapped_role_unmanageable_ignored', {
            guildId: guild.id,
            gangId,
            roleId: role.id,
            editable: role.editable,
            managed: role.managed,
        });
        role = undefined;
    }

    if (!role) {
        role = findAssignableRoleByName(guild, 'Verified');

        if (!role) {
            const unmanageableVerifiedRole = guild.roles.cache.find((candidate: Role) => candidate.name === 'Verified');
            if (unmanageableVerifiedRole) {
                logWarn('bot.setup.verified_role_unmanageable_replacing', {
                    guildId: guild.id,
                    gangId,
                    roleId: unmanageableVerifiedRole.id,
                    editable: unmanageableVerifiedRole.editable,
                    managed: unmanageableVerifiedRole.managed,
                });
            }
            role = await guild.roles.create({
                name: 'Verified',
                colors: { primaryColor: '#95A5A6' },
                hoist: false,
                reason: 'Gang Management Setup - verified visitors',
            });
        }
    }

    const existingByRole = await db.query.gangRoles.findFirst({
        where: (table, { and, eq }) => and(
            eq(table.gangId, gangId),
            eq(table.discordRoleId, role.id)
        )
    });

    if (existingByRole && existingByRole.permissionLevel !== 'VERIFIED') {
        throw new SetupResourceError(
            'VERIFY_ROLE_CONFLICT',
            `ยศ "${role.name}" ถูกใช้เป็น ${existingByRole.permissionLevel} อยู่แล้ว กรุณาเลือกยศยืนยันตัวตนที่ไม่ใช่ยศแก๊ง`
        );
    }

    if (existingByPermission) {
        if (existingByPermission.discordRoleId !== role.id) {
            await db.update(gangRoles)
                .set({ discordRoleId: role.id })
                .where(eq(gangRoles.id, existingByPermission.id));
        }
    } else {
        await db.insert(gangRoles).values({
            id: nanoid(),
            gangId,
            discordRoleId: role.id,
            permissionLevel: 'VERIFIED',
        });
    }

    return role as Role;
}

async function assignDiscordRoleToGuildOwner(
    guild: { id: string; ownerId: string; members: { fetch: (id: string) => Promise<any> } },
    gangId: string,
    ownerRole: Role | undefined
) {
    if (!ownerRole) return;

    const ownerMember = await guild.members.fetch(guild.ownerId).catch((error: unknown) => {
        logWarn('bot.setup.owner_role_member_fetch_failed', {
            guildId: guild.id,
            gangId,
            ownerDiscordId: guild.ownerId,
            error,
        });
        return null;
    });

    if (!ownerMember || ownerMember.roles.cache.has(ownerRole.id)) return;

    if (!isRoleAssignableByBot(ownerRole) || ownerMember.manageable === false) {
        logWarn('bot.setup.owner_role_assign_unmanageable', {
            guildId: guild.id,
            gangId,
            ownerDiscordId: guild.ownerId,
            roleId: ownerRole.id,
            roleName: ownerRole.name,
            editable: ownerRole.editable,
            managed: ownerRole.managed,
            memberManageable: ownerMember.manageable,
        });
        return;
    }

    await ownerMember.roles.add(ownerRole).catch((error: unknown) => {
        logWarn('bot.setup.owner_role_assign_failed', {
            guildId: guild.id,
            gangId,
            ownerDiscordId: guild.ownerId,
            roleId: ownerRole.id,
            error,
        });
    });
}

// --- Handlers Registration ---
registerButtonHandler('setup_start', handleSetupStart);
registerModalHandler('setup_modal', handleSetupModalSubmit);
registerButtonHandler('setup_mode_auto', handleSetupModeAuto);
registerButtonHandler('setup_mode_manual', handleSetupModeManual);
registerButtonHandler('setup_verify_auto', handleSetupVerifyAuto);
registerButtonHandler('setup_verify_select', handleSetupVerifySelect);

// Register Select Menu Handlers for Manual Flow
registerSelectMenuHandler('setup_verify_role', handleSetupVerifyRoleSelect);
registerSelectMenuHandler('setup_select', handleSetupRoleSelect);

// --- 1. Start Button Click -> Show Modal OR Skip if exists ---
function hasDiscordServerSetupPermission(interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction) {
    return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) ?? false;
}

async function getSetupActionAccessFailure(
    interaction: ButtonInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
    parsedTarget?: { gangId?: string; pendingId?: string }
) {
    if (!hasDiscordServerSetupPermission(interaction)) {
        return SETUP_SERVER_ADMIN_DENIED_MESSAGE;
    }

    if (parsedTarget?.gangId) {
        const hasGangPermission = await checkPermission(interaction, parsedTarget.gangId, ['OWNER', 'ADMIN']);
        if (!hasGangPermission) {
            logWarn('bot.setup.action_denied_by_gang_role', {
                guildId: interaction.guildId,
                gangId: parsedTarget.gangId,
                userDiscordId: interaction.user.id,
                customId: 'customId' in interaction ? interaction.customId : undefined,
            });
            return SETUP_GANG_ADMIN_DENIED_MESSAGE;
        }
    }

    return null;
}

async function rejectSetupAction(interaction: ButtonInteraction | AnySelectMenuInteraction, message: string) {
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
}

async function requireSetupActionAccess(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    parsedTarget?: { gangId?: string; pendingId?: string }
) {
    const failureMessage = await getSetupActionAccessFailure(interaction, parsedTarget);
    if (!failureMessage) {
        return true;
    }

    await rejectSetupAction(interaction, failureMessage);
    return false;
}

function isManagedLeavePanelMessage(message: any, botUserId: string) {
    if (!message || message.author?.id !== botUserId) return false;

    const title = message.embeds?.[0]?.title ?? '';
    if (title.includes('แจ้งลา / เข้าช้า')) return true;

    const componentPayload = JSON.stringify(message.components ?? []);
    return MANAGED_LEAVE_PANEL_BUTTON_IDS.some(customId => componentPayload.includes(customId));
}

function isEphemeralComponentInteraction(interaction: ButtonInteraction | AnySelectMenuInteraction) {
    const flags = interaction.message?.flags as { has?: (flag: MessageFlags) => boolean; bitfield?: number } | undefined;
    if (typeof flags?.has === 'function') {
        return flags.has(MessageFlags.Ephemeral);
    }

    return Boolean(flags?.bitfield && (flags.bitfield & MessageFlags.Ephemeral) === MessageFlags.Ephemeral);
}

async function handleSetupStart(interaction: ButtonInteraction) {
    const serverAccessFailure = await getSetupActionAccessFailure(interaction);
    if (serverAccessFailure) {
        await rejectSetupAction(interaction, serverAccessFailure);
        return;
    }

    // Check if gang already exists for this guild
    const existingGang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, interaction.guildId!)
    });

    if (existingGang) {
        const gangAccessFailure = await getSetupActionAccessFailure(interaction, { gangId: existingGang.id });
        if (gangAccessFailure) {
            await rejectSetupAction(interaction, gangAccessFailure);
            return;
        }

        // Skip modal, go straight to mode selection
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle('🧭 พบระบบเดิมของแก๊งนี้แล้ว')
            .setDescription(`เซิร์ฟเวอร์นี้เชื่อมกับแก๊ง **"${existingGang.name}"** อยู่แล้ว\nเลือกยศสำหรับคนที่กดยืนยันตัวตนก่อน แล้วระบบจะซ่อมห้อง/ยศให้อัตโนมัติ`)
            .addFields(
                { name: '✅ ใช้ Verified อัตโนมัติ', value: 'ให้บอทใช้/สร้างยศ Verified สำหรับคนที่ผ่านการยืนยันตัวตน' },
                { name: '🎭 ใช้ยศเดิมของเซิร์ฟ', value: 'เลือกยศประชาชน/สมาชิกทั่วไปเดิมของเซิร์ฟ เช่น 012 โดยบอทจะตรวจลำดับยศก่อนติดตั้ง' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_verify_auto_${existingGang.id}`).setLabel('✅ ใช้ Verified อัตโนมัติ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_verify_select_${existingGang.id}`).setLabel('🎭 เลือกยศยืนยันตัวตน').setStyle(ButtonStyle.Secondary)
        );

        await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral });
        return;
    }

    const modal = new ModalBuilder()
        .setCustomId('setup_modal')
        .setTitle('⚙️ ตั้งค่าแก๊ง');

    const nameInput = new TextInputBuilder()
        .setCustomId('gang_name')
        .setLabel('ชื่อแก๊ง')
        .setPlaceholder('ระบุชื่อแก๊งของคุณ')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

    modal.addComponents(
        new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput)
    );

    await interaction.showModal(modal);
}

// --- 2. Modal Submit -> Ask for Mode ---
async function handleSetupModalSubmit(interaction: ModalSubmitInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const gangName = interaction.fields.getTextInputValue('gang_name');

    const guildId = interaction.guildId!;
    const serverAccessFailure = await getSetupActionAccessFailure(interaction);
    if (serverAccessFailure) {
        await interaction.editReply({
            content: serverAccessFailure,
            embeds: [],
            components: [],
        });
        return;
    }

    const setupIssue = getSetupPermissionIssue(interaction);
    if (setupIssue) {
        logWarn('bot.setup.preflight_failed', {
            guildId,
            userDiscordId: interaction.user.id,
            reason: setupIssue,
        });
        await interaction.editReply({
            content: `❌ ${setupIssue}`,
            embeds: [],
            components: [],
        });
        return;
    }

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
    });

    if (gang) {
        const gangAccessFailure = await getSetupActionAccessFailure(interaction, { gangId: gang.id });
        if (gangAccessFailure) {
            await interaction.editReply({
                content: gangAccessFailure,
                embeds: [],
                components: [],
            });
            return;
        }
    }

    try {
        let targetCustomId: string;
        let resolvedTier: 'FREE' | 'TRIAL' | 'PREMIUM';
        let currentTrialExpiry: Date | null | undefined;
        let transferredInfo = '';

        if (gang) {
            await db.update(gangs)
                .set({ name: gangName })
                .where(eq(gangs.id, gang.id));
            targetCustomId = gang.id;
            resolvedTier = normalizeSubscriptionTier(gang.subscriptionTier);
            currentTrialExpiry = gang.subscriptionExpiresAt ? new Date(gang.subscriptionExpiresAt) : null;
        } else {
            const gangId = nanoid();
            const trialExpiresAt = createTrialExpiresAt();

            await db.insert(gangs).values({
                id: gangId,
                discordGuildId: guildId,
                name: gangName,
                subscriptionTier: 'TRIAL',
                subscriptionExpiresAt: trialExpiresAt,
            });
            await db.insert(gangSettings).values({ id: nanoid(), gangId });

            const transfer = await applyOwnerSubscriptionTransfer(gangId, interaction.user.id, guildId);
            targetCustomId = gangId;
            resolvedTier = transfer.resolvedTier;
            currentTrialExpiry = resolvedTier === 'TRIAL'
                ? (transfer.rollbackTransfer?.oldExpiresAt ? new Date(transfer.rollbackTransfer.oldExpiresAt) : trialExpiresAt)
                : null;
            transferredInfo = transfer.transferredInfo;
        }

        // Ask for Mode
        const trialInfo = resolvedTier === 'TRIAL'
            ? `\n🎁 **ทดลองใช้ฟรี ${TRIAL_DAYS} วัน** ถึง ${currentTrialExpiry?.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}`
            : '';
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setTitle(gang ? '✅ พบข้อมูลแก๊งเดิมแล้ว' : '🧭 รับข้อมูลแก๊งแล้ว')
            .setDescription(
                gang
                    ? `แก๊ง **"${gangName}"** พร้อมเข้าสู่ขั้นตอนซ่อมแซมแล้ว${trialInfo}\nเลือกยศที่คนทั่วไปจะได้รับหลังยืนยันตัวตนก่อน`
                    : `บันทึกแก๊ง **"${gangName}"** แล้ว${trialInfo}${transferredInfo}\nเลือกยศที่คนทั่วไปจะได้รับหลังยืนยันตัวตน จากนั้นระบบจะสร้าง/ซ่อมห้องและยศให้อัตโนมัติ\nถ้าขั้นตอนต่อไปสะดุด ให้พิมพ์ \`/setup\` อีกครั้งเพื่อซ่อมต่อได้ทันที`
            )
            .addFields(
                { name: '✅ ใช้ Verified อัตโนมัติ', value: 'เหมาะกับเซิร์ฟใหม่ หรือเซิร์ฟที่ยังไม่มียศประชาชนทั่วไป' },
                { name: '🎭 ใช้ยศเดิมของเซิร์ฟ', value: 'เหมาะกับเซิร์ฟเก่าที่มี role ประชาชน/สมาชิกทั่วไปอยู่แล้ว เช่น 012' }
            );

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setCustomId(`setup_verify_auto_${targetCustomId}`).setLabel('✅ ใช้ Verified อัตโนมัติ').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`setup_verify_select_${targetCustomId}`).setLabel('🎭 เลือกยศยืนยันตัวตน').setStyle(ButtonStyle.Secondary)
        );

        await interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        logError('bot.setup.modal_failed', error, {
            guildId,
            userDiscordId: interaction.user.id,
        });
        await interaction.editReply('❌ เกิดข้อผิดพลาดในการเตรียมข้อมูล setup');
    }
}

async function showSetupLoading(interaction: SetupComponentInteraction, content = '⏳ กำลังติดตั้งระบบ Auto... กรุณารอสักครู่') {
    try {
        if (interaction.replied || interaction.deferred) {
            await interaction.editReply({
                content,
                embeds: [],
                components: []
            });
        } else {
            await interaction.update({
                content,
                embeds: [],
                components: []
            });
        }
    } catch (error) {
        logWarn('bot.setup.auto_initial_update_failed', {
            guildId: interaction.guildId,
            customId: interaction.customId,
            userDiscordId: interaction.user.id,
            error,
        });
    }
}

async function runRepairableSetupStep(
    diagnostics: SetupDiagnostics,
    label: string,
    action: () => Promise<void>,
    context: Record<string, unknown>
) {
    try {
        await action();
    } catch (error) {
        diagnostics.messageWarnings = diagnostics.messageWarnings ?? [];
        diagnostics.messageWarnings.push(label);
        logWarn('bot.setup.repairable_step_failed', {
            ...context,
            step: label,
            error,
        });
    }
}

async function runAutoSetup(
    interaction: SetupComponentInteraction,
    parsedTarget: { gangId?: string; pendingId?: string },
    options: CreateDefaultResourceOptions = {}
) {
    if (!parsedTarget.gangId && !parsedTarget.pendingId) {
        await interaction.editReply('❌ Error: Missing Gang ID');
        return;
    }

    let setupTarget: SetupTarget | null = null;
    try {
        setupTarget = await resolveSetupTarget(interaction, parsedTarget);
        const { gangId } = setupTarget;

        // Reuse logic
        const setupDiagnostics = await createDefaultResources(interaction, gangId, options);
        await runRepairableSetupStep(
            setupDiagnostics,
            'ข้อความสมัครสมาชิก',
            () => sendSetupInstructions(interaction, gangId),
            { guildId: interaction.guildId, gangId, userDiscordId: interaction.user.id }
        );
        await runRepairableSetupStep(
            setupDiagnostics,
            'แผงควบคุมหัวหน้าแก๊ง',
            () => sendAdminPanel(interaction, gangId),
            { guildId: interaction.guildId, gangId, userDiscordId: interaction.user.id }
        );

        const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, gangId) });
        const dashboardUrl = buildDashboardUrl(gangId, { guildId: interaction.guildId, gangId });
        const settingsUrl = `${dashboardUrl}/settings`;

        const setupFields = [
            { name: '📋 สถานะ', value: normalizeSubscriptionTier(gang?.subscriptionTier) === 'PREMIUM' ? 'Premium' : normalizeSubscriptionTier(gang?.subscriptionTier) === 'TRIAL' ? 'Trial 7 วัน' : 'Free', inline: true },
            { name: '🎭 ระบบยศ', value: 'Owner ใช้เจ้าของเซิร์ฟเวอร์ Discord พร้อมยศ Gang Owner, ยศอื่นสร้าง/ซ่อมให้พร้อม', inline: true },
            { name: '📂 ห้องระบบ', value: 'สร้างเฉพาะห้องที่จำเป็น', inline: true },
            { name: '🎯 แนะนำให้ทำต่อทันที', value: '1. เช็กห้อง Website / ลงทะเบียน / ยืนยันตัวตน\n2. ให้สมาชิกเริ่มเข้าระบบ\n3. เปิด Dashboard เพื่อตรวจสมาชิก, attendance, finance และตั้งค่าเพิ่มเติม' },
            { name: '🛟 ถ้าเมนูหายหรือห้องเพี้ยน', value: 'ใช้ปุ่มซ่อมห้องและยศจากแผงควบคุมได้ ระบบจะใช้ห้องเดิมก่อน และจะไม่สร้างห้องแชทหรือห้องเสียงให้รกเซิร์ฟเวอร์' },
        ];

        if (setupDiagnostics.roleHierarchyWarning) {
            setupFields.push({
                name: '⚠️ ต้องจัดลำดับยศบอท',
                value: setupDiagnostics.roleHierarchyWarning,
            });
        }
        if (setupDiagnostics.messageWarnings?.length) {
            setupFields.push({
                name: '🛠️ ข้อความบางจุดต้องซ่อมซ้ำ',
                value: `ติดตั้งห้องและยศหลักสำเร็จแล้ว แต่ส่ง ${setupDiagnostics.messageWarnings.join(', ')} ไม่ครบ\nกดปุ่มซ่อมห้องและยศอีกครั้งได้ ระบบจะเติมข้อความที่ขาดโดยไม่ต้องสร้างแก๊งใหม่`,
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('✅ เปิดระบบแก๊งสำเร็จแล้ว')
            .setDescription(`แก๊ง **${gang?.name}** พร้อมใช้งานทั้งใน Discord และหน้าเว็บแล้ว${setupTarget.transferredInfo}`)
            .addFields(...setupFields);

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder().setLabel('🌐 เปิด Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
            new ButtonBuilder().setLabel('⚙️ ตั้งค่าบนเว็บ').setStyle(ButtonStyle.Link).setURL(settingsUrl)
        );

        await interaction.editReply({ content: '', embeds: [embed], components: [row] });

    } catch (error) {
        if (setupTarget?.createdNewGang) {
            try {
                await rollbackNewSetupGang(setupTarget);
            } catch (rollbackError) {
                logError('bot.setup.auto_rollback_failed', rollbackError, {
                    guildId: interaction.guildId,
                    gangId: setupTarget.gangId,
                    userDiscordId: interaction.user.id,
                });
            }
        }

        logError('bot.setup.auto_failed', error, {
            guildId: interaction.guildId,
            gangId: setupTarget?.gangId,
            userDiscordId: interaction.user.id,
        });
        const message = error instanceof SetupResourceError
            ? error.userMessage
            : 'เกิดข้อผิดพลาดในการสร้างทรัพยากร กรุณาลองซ่อมแซมอีกครั้ง หรือตรวจสิทธิ์บอทใน Discord';
        await interaction.editReply(`❌ ${message}`);
    }
}

// --- 3. Auto Mode -> Create Resources ---
async function handleSetupModeAuto(interaction: ButtonInteraction) {
    const parsedTarget = parseSetupModeTarget(interaction.customId, 'setup_mode_auto_');
    if (!await requireSetupActionAccess(interaction, parsedTarget)) {
        return;
    }

    await showSetupLoading(interaction);
    await runAutoSetup(interaction, parsedTarget);
}

async function handleSetupVerifyAuto(interaction: ButtonInteraction) {
    const parsedTarget = parseSetupModeTarget(interaction.customId, 'setup_verify_auto_');
    if (!await requireSetupActionAccess(interaction, parsedTarget)) {
        return;
    }

    await showSetupLoading(interaction, '⏳ กำลังติดตั้งด้วยยศ Verified อัตโนมัติ... กรุณารอสักครู่');
    await runAutoSetup(interaction, parsedTarget);
}

// --- 4. Verify Role Selection ---
async function handleSetupModeManual(interaction: ButtonInteraction) {
    // Backward-compatible path for old setup messages: the old "manual role mapping"
    // button now means "choose the verify role manually".
    await handleSetupVerifySelect(interaction, 'setup_mode_manual_');
}

async function handleSetupVerifySelect(interaction: ButtonInteraction, prefix = 'setup_verify_select_') {
    const parsedTarget = parseSetupModeTarget(interaction.customId, prefix as 'setup_mode_auto_' | 'setup_mode_manual_' | 'setup_verify_auto_' | 'setup_verify_select_');
    if (!await requireSetupActionAccess(interaction, parsedTarget)) {
        return;
    }

    const targetId = interaction.customId.replace(prefix, '');
    if (isEphemeralComponentInteraction(interaction)) {
        await interaction.deferUpdate();
        await askForVerifiedRole(interaction, targetId);
        return;
    }

    await interaction.reply({
        ...buildVerifiedRolePrompt(targetId),
        flags: MessageFlags.Ephemeral,
    });
}

async function handleSetupVerifyRoleSelect(interaction: AnySelectMenuInteraction) {
    const targetId = interaction.customId.replace('setup_verify_role_', '');
    const parsedTarget = targetId.startsWith('pending_') ? { pendingId: targetId.replace('pending_', '') } : { gangId: targetId };
    if (!await requireSetupActionAccess(interaction, parsedTarget)) {
        return;
    }

    const selectedRoleId = interaction.values[0];

    await interaction.deferUpdate();

    const validationError = validateVerifiedRoleSelection(interaction, selectedRoleId);
    if (validationError) {
        await askForVerifiedRole(interaction, targetId, validationError);
        return;
    }

    await showSetupLoading(interaction, '⏳ กำลังติดตั้งด้วยยศยืนยันตัวตนที่เลือก... กรุณารอสักครู่');
    await runAutoSetup(
        interaction,
        targetId.startsWith('pending_') ? { pendingId: targetId.replace('pending_', '') } : { gangId: targetId },
        { verifiedRoleId: selectedRoleId }
    );
}

// --- 5. Legacy Manual Role Selection Guard ---
async function handleSetupRoleSelect(interaction: AnySelectMenuInteraction) {
    await interaction.deferUpdate();
    await interaction.editReply({
        content: '⚠️ โหมดเชื่อมยศแก๊งเองถูกยกเลิกแล้ว กรุณาใช้ `/setup` ใหม่ แล้วเลือกยศยืนยันตัวตนแทน ระบบจะสร้าง/ซ่อมยศแก๊งให้อัตโนมัติ',
        embeds: [],
        components: [],
    });
}

function validateVerifiedRoleSelection(
    interaction: AnySelectMenuInteraction,
    selectedRoleId: string
) {
    const guild = interaction.guild;
    if (!guild) {
        return 'ไม่พบข้อมูลเซิร์ฟเวอร์ กรุณาลองใช้ /setup ใหม่อีกครั้ง';
    }

    if (selectedRoleId === guild.id) {
        return 'ห้ามใช้ @everyone เป็นยศของระบบแก๊ง เพราะจะทำให้ทุกคนได้รับสิทธิ์ทันที';
    }

    const role = guild.roles.cache.get(selectedRoleId);
    if (!role) {
        return 'ไม่พบยศที่เลือก กรุณาเลือกยศใหม่อีกครั้ง';
    }

    if (role.managed) {
        return 'ยศนี้เป็นยศที่ Discord หรือ integration จัดการให้อัตโนมัติ กรุณาเลือกยศปกติของเซิร์ฟเวอร์';
    }

    if (role.editable === false) {
        return 'บอทยังจัดการยศนี้ไม่ได้ เพราะยศนี้อยู่สูงกว่าบอทหรือบอทไม่มีสิทธิ์ Manage Roles กรุณาย้ายยศบอทให้อยู่สูงกว่ายศนี้ก่อน';
    }

    return null;
}

async function askForVerifiedRole(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    targetId: string,
    warning?: string
) {
    await interaction.editReply(buildVerifiedRolePrompt(targetId, warning));
}

function buildVerifiedRolePrompt(targetId: string, warning?: string) {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🎭 เลือกยศหลังยืนยันตัวตน')
        .setDescription('เลือก role เดิมของเซิร์ฟที่คนทั่วไปควรได้รับหลังจากกดปุ่มยืนยันตัวตน เช่น ยศประชาชน/สมาชิกทั่วไป\nระบบจะใช้ยศนี้เปิดห้องพื้นฐาน แต่จะยังไม่ให้สิทธิ์ห้องแก๊งจนกว่าจะสมัครและได้รับอนุมัติ');

    if (warning) {
        embed.addFields({ name: '⚠️ ยังบันทึกไม่ได้', value: warning });
    }

    const select = new RoleSelectMenuBuilder()
        .setCustomId(`setup_verify_role_${targetId}`)
        .setPlaceholder('เลือกยศที่จะได้รับหลังยืนยันตัวตน')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);

    return { embeds: [embed], components: [row] };
}


// --- Helper Functions (Moved from setup.ts) ---

async function createDefaultResources(
    interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction | AnySelectMenuInteraction,
    gangId: string,
    options: CreateDefaultResourceOptions = {}
): Promise<SetupDiagnostics> {
    const guild = resolveInteractionGuild(interaction);
    if (!guild) {
        throw new SetupResourceError(
            'BOT_NOT_IN_GUILD',
            'ยังไม่พบบอทในเซิร์ฟเวอร์นี้ กรุณาเชิญบอทเข้าเซิร์ฟเวอร์ก่อน แล้วค่อยกดติดตั้ง/ซ่อมแซมอีกครั้ง'
        );
    }
    const botMember = guild.members.me;

    if (!botMember) {
        throw new SetupResourceError(
            'BOT_MEMBER_NOT_AVAILABLE',
            'บอทยังไม่ได้เป็นสมาชิกจริงในเซิร์ฟเวอร์นี้ กรุณาเชิญบอทเข้าเซิร์ฟเวอร์ก่อน แล้วค่อยกดติดตั้ง/ซ่อมแซมอีกครั้ง'
        );
    }

    if (!botMember.permissions.has(PermissionFlagsBits.ManageRoles) || !botMember.permissions.has(PermissionFlagsBits.ManageChannels)) {
        throw new SetupResourceError(
            'BOT_MISSING_SETUP_PERMISSIONS',
            'บอทยังไม่มีสิทธิ์ Manage Roles หรือ Manage Channels กรุณาให้สิทธิ์บอทก่อน แล้วค่อยกดติดตั้ง/ซ่อมแซมอีกครั้ง'
        );
    }

    const diagnostics: SetupDiagnostics = {};

    await guild.channels.fetch().catch(error => {
        logWarn('bot.setup.channel_cache_refresh_failed', {
            guildId: guild.id,
            gangId,
            error,
        });
    });
    await guild.roles.fetch().catch(error => {
        logWarn('bot.setup.role_cache_refresh_failed', {
            guildId: guild.id,
            gangId,
            error,
        });
    });

    const roleHierarchyIssue = getBotRoleHierarchyIssue(guild, botMember);
    if (roleHierarchyIssue) {
        diagnostics.roleHierarchyWarning = roleHierarchyIssue.warning;
        logWarn('bot.setup.role_hierarchy_warning', {
            guildId: guild.id,
            gangId,
            botRoleId: roleHierarchyIssue.botRoleId,
            botRoleName: roleHierarchyIssue.botRoleName,
            roleCount: roleHierarchyIssue.roleCount,
            sampleRolesAbove: roleHierarchyIssue.roleNames.slice(0, 10),
        });
    }

    const existingSettings = await db.query.gangSettings.findFirst({
        where: eq(gangSettings.gangId, gangId),
    });

    // --- 1. Create Roles ---
    const roleConfig: SetupRoleConfig[] = [
        { name: 'Gang Owner', color: '#FFD700', permission: 'OWNER', hoist: true, preserveExistingMapping: false },
        { name: 'Gang Admin', color: '#FF0000', permission: 'ADMIN', hoist: true },   // Red
        { name: 'Gang Treasurer', color: '#00FF00', permission: 'TREASURER', hoist: true }, // Green
        { name: 'Gang Attendance', color: '#FEE75C', permission: 'ATTENDANCE_OFFICER', hoist: true },
        { name: 'Gang Member', color: '#3498DB', permission: 'MEMBER', hoist: true }, // Blue
    ];

    const verifiedRole = await ensureVerifiedRoleMapping(guild, gangId, options.verifiedRoleId);

    // Ensure Verified is at the bottom (above @everyone)
    try {
        if (!options.verifiedRoleId) {
            await verifiedRole.setPosition(1);
        }
    } catch (error) {
        logWarn('bot.setup.verified_role_position_failed', {
            guildId: guild.id,
            gangId,
            roleId: verifiedRole.id,
            error,
        });
    }

    const createdRoles: Record<string, Role> = {};

    for (const config of roleConfig) {
        createdRoles[config.permission] = await ensureSetupRoleMapping(guild, gangId, config);
    }

    await syncDiscordGuildOwnerMembership(gangId, guild);
    await assignDiscordRoleToGuildOwner(guild, gangId, createdRoles['OWNER']);

    // --- 2. Create Categories & Channels ---
    const ensureCategory = async (name: string, options: any = {}): Promise<CategoryChannel> => {
        const createCategory = async () => guild.channels.create({
            name,
            type: ChannelType.GuildCategory,
            ...options,
        }) as Promise<CategoryChannel>;

        const candidates = guild.channels.cache
            .filter(c => c.name === name && c.type === ChannelType.GuildCategory)
            .map(c => c as CategoryChannel);
        const inaccessibleCandidates = candidates.filter(category => !hasBotManagedChannelView(category, botMember));
        const category = candidates.find(candidate => hasBotManagedChannelView(candidate, botMember));

        if (!category) {
            if (inaccessibleCandidates.length > 0) {
                logWarn('bot.setup.category_inaccessible_replacing', {
                    guildId: guild.id,
                    gangId,
                    categoryName: name,
                    candidateCount: inaccessibleCandidates.length,
                });
            }
            return createCategory();
        } else if (options.permissionOverwrites) {
            try {
                await category.edit({ permissionOverwrites: options.permissionOverwrites });
            } catch (error) {
                logWarn('bot.setup.category_permission_update_failed', {
                    guildId: guild.id,
                    gangId,
                    categoryName: name,
                    error,
                });

                if (isDiscordMissingAccessError(error)) {
                    logWarn('bot.setup.category_inaccessible_replacing', {
                        guildId: guild.id,
                        gangId,
                        categoryName: name,
                        categoryId: category.id,
                    });
                    return createCategory();
                }
            }
        }

        return category;
    };

    const infoCategory = await ensureCategory('📌 ข้อมูลทั่วไป');
    const attendanceCategory = await ensureCategory('⏰ ระบบเช็คชื่อ');
    const financeCategory = await ensureCategory('💰 ระบบการเงิน');
    const adminOnlyPerms = withBotManagedChannelAccess(botMember.id, [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: guild.ownerId, allow: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel'] }
    ]);
    let adminCategory: CategoryChannel;
    try {
        adminCategory = await ensureCategory('🔒 หัวแก๊ง', {
            permissionOverwrites: adminOnlyPerms
        });
    } catch (error) {
        logError('bot.setup.admin_category_create_failed', error, {
            guildId: guild.id,
            gangId,
        });
        try {
            adminCategory = await guild.channels.create({
                name: '🔒 หัวแก๊ง',
                type: ChannelType.GuildCategory,
                permissionOverwrites: adminOnlyPerms
            });
        } catch (fallbackError) {
            logError('bot.setup.admin_category_create_fallback_failed', fallbackError, {
                guildId: guild.id,
                gangId,
            });
            throw new SetupResourceError(
                'ADMIN_CATEGORY_CREATE_FAILED',
                'สร้างหมวดหัวแก๊งไม่สำเร็จ กรุณาตรวจสิทธิ์ Manage Channels และลำดับยศของบอท'
            );
        }
    }

    const ensureChannel = async (name: string, parentId: string, options: any = {}, existingChannelId?: string | null) => {
        try {
            const channelType = options.type || ChannelType.GuildText;
            let existing = existingChannelId ? guild.channels.cache.get(existingChannelId) : null;
            const aliases = SETUP_CHANNEL_ALIASES[name] || [];
            const matchesManagedName = (channelName?: string | null) => Boolean(channelName && [name, ...aliases].includes(channelName));

            if (existing && existing.type !== channelType) {
                existing = null;
            }

            if (existing && !hasBotManagedChannelView(existing, botMember)) {
                logWarn('bot.setup.channel_inaccessible_replacing', {
                    guildId: guild.id,
                    gangId,
                    channelName: name,
                    channelId: existing.id,
                    source: 'settings',
                });
                existing = null;
            }

            const matchingChannels = guild.channels.cache
                .filter(c => matchesManagedName(c.name) && c.type === channelType)
                .map(c => c);
            const pickAccessibleChannel = (candidates: typeof matchingChannels) => {
                return candidates.find(candidate => hasBotManagedChannelView(candidate, botMember)) ?? null;
            };

            if (!existing) {
                // 1. Check if channel already exists under the target parent
                existing = pickAccessibleChannel(matchingChannels.filter(c => c.parentId === parentId));
            }

            if (!existing) {
                // 2. Search guild-wide for a channel with the same name (preserved from existing server layout)
                existing = pickAccessibleChannel(matchingChannels);
            }

            if (!existing && matchingChannels.length > 0) {
                logWarn('bot.setup.channel_inaccessible_replacing', {
                    guildId: guild.id,
                    gangId,
                    channelName: name,
                    candidateCount: matchingChannels.length,
                    source: 'name_search',
                });
            }

            if (existing) {
                let shouldReplaceExisting = false;
                // Move the existing channel to the new parent category if needed.
                if (existing.parentId !== parentId && 'setParent' in existing) {
                    try {
                        existing = await (existing as TextChannel).setParent(parentId, { lockPermissions: false });
                        logInfo('bot.setup.channel_moved', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            parentId,
                        });
                    } catch (error) {
                        logWarn('bot.setup.channel_move_failed', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            parentId,
                            error,
                        });

                        if (isDiscordMissingAccessError(error)) {
                            shouldReplaceExisting = true;
                        }
                    }
                }

                const editPayload: Record<string, unknown> = {};
                if (existing.name !== name) {
                    editPayload.name = name;
                }
                if (options.permissionOverwrites) {
                    editPayload.permissionOverwrites = options.permissionOverwrites;
                }

                if (!shouldReplaceExisting && Object.keys(editPayload).length > 0) {
                    try {
                        existing = await (existing as TextChannel).edit(editPayload);
                    } catch (error) {
                        logWarn('bot.setup.channel_permission_update_failed', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            error,
                        });

                        if (isDiscordMissingAccessError(error)) {
                            shouldReplaceExisting = true;
                        }
                    }
                }

                if (!shouldReplaceExisting) {
                    return existing;
                }

                logWarn('bot.setup.channel_inaccessible_replacing', {
                    guildId: guild.id,
                    gangId,
                    channelName: name,
                    channelId: existing.id,
                    source: 'repair_failed',
                });
            }

            return await guild.channels.create({ name, parent: parentId, type: ChannelType.GuildText, ...options });
        } catch (error) {
            logError('bot.setup.channel_ensure_failed', error, {
                guildId: guild.id,
                gangId,
                channelName: name,
                parentId,
            });
            throw new SetupResourceError(
                'CHANNEL_CREATE_FAILED',
                `สร้างหรือซ่อมห้อง "${name}" ไม่สำเร็จ กรุณาตรวจสิทธิ์ Manage Channels และลองอีกครั้ง`
            );
        }
    };

    // === Permission Templates ===
    // 1. Read-only for everyone (announcements, rules)
    const readOnlyEveryone = withBotManagedChannelAccess(botMember.id, [
        { id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] }
    ]);

    // 2. Registration: visible to non-members, hidden from members (who are already approved)
    // Concept: "Everyone" can see it. But if you have a Gang Role, you cannot see it.
    // This ensures only unregistered people see the register button.
    const registerPerms = withBotManagedChannelAccess(botMember.id, [
        { id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['MEMBER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, deny: ['ViewChannel'] },
        { id: createdRoles['TREASURER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, deny: ['ViewChannel'] },
        { id: guild.ownerId, deny: ['ViewChannel'] }
    ]);

    // 3. Members only (read-only)
    const membersOnlyReadOnly = withBotManagedChannelAccess(botMember.id, [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: guild.ownerId, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel'], deny: ['SendMessages'] }
    ]);

    // 4. Members only (can write)
    const membersOnlyWritable = withBotManagedChannelAccess(botMember.id, [
        { id: guild.roles.everyone.id, deny: ['ViewChannel'] },
        { id: guild.ownerId, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['MEMBER'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel', 'SendMessages'] },
        { id: createdRoles['TREASURER'].id, allow: ['ViewChannel', 'SendMessages'] }
    ]);

    // === 📌 ข้อมูลทั่วไป ===
    // Verify channel: visible to everyone, only non-verified can see it
    const verifyPerms = withBotManagedChannelAccess(botMember.id, [
        { id: guild.roles.everyone.id, allow: ['ViewChannel'], deny: ['SendMessages'] },
        { id: verifiedRole!.id, deny: ['ViewChannel'] },
        { id: createdRoles['MEMBER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, deny: ['ViewChannel'] },
        { id: createdRoles['TREASURER'].id, deny: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, deny: ['ViewChannel'] },
        { id: guild.ownerId, deny: ['ViewChannel'] },
    ]);
    const verifyChannel = await ensureChannel('ยืนยันตัวตน', infoCategory.id, { permissionOverwrites: verifyPerms });
    const registerChannel = await ensureChannel('ลงทะเบียน', infoCategory.id, { permissionOverwrites: registerPerms }, existingSettings?.registerChannelId);
    const announcementChannel = await ensureChannel('ประกาศ', infoCategory.id, { permissionOverwrites: readOnlyEveryone }, existingSettings?.announcementChannelId); // Visible to all
    const websiteChannel = await ensureChannel('Website', infoCategory.id, { permissionOverwrites: readOnlyEveryone });

    // === ⏰ ระบบเช็คชื่อ (Members Only) ===
    const attendanceChannel = await ensureChannel('เช็คชื่อ', attendanceCategory.id, { permissionOverwrites: membersOnlyReadOnly }, existingSettings?.attendanceChannelId);
    const attendanceSummaryChannel = await ensureChannel('สรุปเช็คชื่อ', attendanceCategory.id, { permissionOverwrites: membersOnlyReadOnly });
    const leaveChannel = await ensureChannel('แจ้งลา', attendanceCategory.id, { permissionOverwrites: membersOnlyWritable }, existingSettings?.leaveChannelId);

    // === 💰 ระบบการเงิน (Members Only) ===
    const financeChannel = await ensureChannel('แจ้งธุรกรรม', financeCategory.id, { permissionOverwrites: membersOnlyWritable }, existingSettings?.financeChannelId);

    // === 🔒 หัวแก๊ง (Admin Only - already set at category level) ===
    const adminPanelChannel = await ensureChannel('แผงควบคุม', adminCategory.id, { permissionOverwrites: adminOnlyPerms });
    const logChannel = await ensureChannel('log-ระบบ', adminCategory.id, { permissionOverwrites: adminOnlyPerms }, existingSettings?.logChannelId);
    const requestsChannel = await ensureChannel('📋-คำขอและอนุมัติ', adminCategory.id, { permissionOverwrites: adminOnlyPerms }, existingSettings?.requestsChannelId); // New Request Channel for both Join & Leave

    const missingChannels = [
        ['ยืนยันตัวตน', verifyChannel],
        ['ลงทะเบียน', registerChannel],
        ['ประกาศ', announcementChannel],
        ['Website', websiteChannel],
        ['เช็คชื่อ', attendanceChannel],
        ['สรุปเช็คชื่อ', attendanceSummaryChannel],
        ['แจ้งลา', leaveChannel],
        ['แจ้งธุรกรรม', financeChannel],
        ['แผงควบคุม', adminPanelChannel],
        ['log-ระบบ', logChannel],
        ['📋-คำขอและอนุมัติ', requestsChannel],
    ].filter(([, channel]) => !channel);

    if (missingChannels.length > 0) {
        throw new SetupResourceError(
            'REQUIRED_CHANNELS_MISSING',
            `ติดตั้งไม่ครบ เพราะสร้างห้อง ${missingChannels.map(([name]) => `"${name}"`).join(', ')} ไม่สำเร็จ`
        );
    }

    const channelsMissingBotAccess = [
        ['ประกาศ', announcementChannel],
        ['Website', websiteChannel],
        ['แจ้งลา', leaveChannel],
        ['แจ้งธุรกรรม', financeChannel],
        ['ยืนยันตัวตน', verifyChannel],
        ['ลงทะเบียน', registerChannel],
        ['แผงควบคุม', adminPanelChannel],
    ].filter(([, channel]) => channel && !hasBotManagedChannelAccess(channel as TextChannel, botMember));

    if (channelsMissingBotAccess.length > 0) {
        throw new SetupResourceError(
            'REQUIRED_CHANNELS_INACCESSIBLE',
            `ติดตั้งไม่ครบ เพราะบอทยังส่งข้อความในห้อง ${channelsMissingBotAccess.map(([name]) => `"${name}"`).join(', ')} ไม่ได้ กรุณาตรวจ Channel Permissions หรือลบห้องเดิมแล้วกดซ่อมแซมอีกครั้ง`
        );
    }

    // Capture IDs, handling potential nulls
    const updates: any = {};
    if (registerChannel) updates.registerChannelId = registerChannel.id;
    if (attendanceChannel) updates.attendanceChannelId = attendanceChannel.id;
    if (financeChannel) updates.financeChannelId = financeChannel.id;
    if (logChannel) updates.logChannelId = logChannel.id;
    if (requestsChannel) updates.requestsChannelId = requestsChannel.id;
    if (announcementChannel) updates.announcementChannelId = announcementChannel.id;

    if (Object.keys(updates).length > 0) {
        await db.update(gangSettings)
            .set(updates)
            .where(eq(gangSettings.gangId, gangId));
    }

    // === Send Public Dashboard Link (separate read-only Website channel) ===
    await runRepairableSetupStep(
        diagnostics,
        'ลิงก์ Website',
        async () => {
            await removePublicDashboardPanel(interaction, announcementChannel as TextChannel);
            await sendPublicDashboardPanel(interaction, gangId, websiteChannel as TextChannel);
        },
        { guildId: guild.id, gangId }
    );

    // === Send Leave Buttons (2 Buttons: Leave & Late) ===
    const leaveEmbed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('📝 แจ้งลา / เข้าช้า')
        .setDescription('ใช้ข้อความนี้เมื่อคุณลางาน เข้าช้า หรือไม่สะดวกเข้าร่วมตามเวลา\nกดปุ่มให้ตรงกับสถานการณ์ แล้วระบบจะส่งคำขอไปให้หัวหน้าแก๊งหรือแอดมินตรวจทันที')
        .addFields(
            { name: 'เลือกแบบไหนดี', value: '• **เข้าช้า** — วันนี้ยังมา แต่จะมาช้ากว่าปกติ\n• **ลา 1 วัน** — ลาหยุด 1 วันเต็ม\n• **ลาหลายวัน** — ใช้เมื่อหยุดมากกว่า 1 วัน' },
            { name: 'หลังส่งคำขอแล้ว', value: 'หัวหน้า/แอดมินจะเห็นรายการในห้องคำขอและบนหน้าเว็บ เพื่อตรวจอนุมัติหรือปฏิเสธ' }
        )
        .setFooter({ text: 'Gang Manager' });

    const leaveRow = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('request_leave_late')
                .setLabel('🟡 เข้าช้า')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('request_leave_1day')
                .setLabel('🟢 ลา 1 วัน')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('request_leave_multi')
                .setLabel('🔴 ลาหลายวัน')
                .setStyle(ButtonStyle.Danger)
        );

    // Send button (delete old message first if exists)
    await runRepairableSetupStep(
        diagnostics,
        'ข้อความแจ้งลา',
        async () => {
            if (!leaveChannel) return;

            const currentSettings = await db.query.gangSettings.findFirst({
                where: eq(gangSettings.gangId, gangId),
                columns: { leaveMessageId: true }
            });
            const deletedMessageIds = new Set<string>();
            const deleteLeavePanelMessage = async (message: any) => {
                if (!message?.id || deletedMessageIds.has(message.id)) return;
                deletedMessageIds.add(message.id);
                await message.delete().catch(() => { });
            };

            if (currentSettings?.leaveMessageId) {
                try {
                    const oldMessage = await (leaveChannel as TextChannel).messages.fetch(currentSettings.leaveMessageId);
                    await deleteLeavePanelMessage(oldMessage);
                } catch { /* Message already deleted or not found */ }
            }

            const recentMessages = await (leaveChannel as TextChannel).messages.fetch({ limit: 100 }).catch(() => null);
            const oldLeavePanels = recentMessages?.filter(message => isManagedLeavePanelMessage(message, interaction.client.user.id));
            if (oldLeavePanels) {
                for (const message of oldLeavePanels.values()) {
                    await deleteLeavePanelMessage(message);
                }
            }

            const newMessage = await (leaveChannel as TextChannel).send({ embeds: [leaveEmbed], components: [leaveRow] });

            await db.update(gangSettings)
                .set({ leaveMessageId: newMessage.id, leaveChannelId: leaveChannel.id })
                .where(eq(gangSettings.gangId, gangId));
        },
        { guildId: guild.id, gangId }
    );

    // === Send Finance Buttons (New) ===
    const gangData = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { balance: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const hasFinance = gangData
        ? canAccessFeature(resolveEffectiveSubscriptionTier(gangData.subscriptionTier, gangData.subscriptionExpiresAt), 'finance')
        : false;

    const financeEmbed = new EmbedBuilder()
        .setTitle('💰 ศูนย์การเงินของสมาชิก')
        .setDescription(
            'ใช้ข้อความนี้เป็นจุดหลักสำหรับส่งคำขอการเงินและดูสถานะของตัวเอง โดยแยกหนี้ยืมออกจากยอดค้างเก็บเงินแก๊ง\n\n' +
            'ยอดเงินล่าสุดให้ดูผ่านปุ่ม **สถานะการเงิน** หรือหน้า Dashboard เพื่อหลีกเลี่ยงตัวเลขค้างในข้อความ Discord'
        )
        .addFields(
            { name: 'เลือกปุ่มให้ถูกยอด', value: '• **ขอเบิก/ยืมเงิน** — ใช้ตอนต้องการยืมจากกองกลาง\n• **ชำระหนี้ยืม** — ใช้เฉพาะยอดหนี้ยืมเท่านั้น\n• **จ่ายยอดเก็บ/ฝากเครดิต** — ใช้จ่ายค่าเก็บเงินแก๊ง หรือฝากเครดิต/สำรองจ่าย\n• **ดูยอดของฉัน** — เช็กหนี้ยืม ค้างเก็บ และเครดิตก่อนกดทำรายการ' },
            { name: 'หมายเหตุสำคัญ', value: 'คำขอที่ส่งจากห้องนี้อาจต้องรอหัวหน้า/เหรัญญิกตรวจสอบก่อนยอดจะถูกบันทึกจริง' }
        )
        .setColor('#FFD700')
        .setFooter({ text: `${gangData?.name || 'Gang'} • Member Finance` });

    const financeRow = new ActionRowBuilder<ButtonBuilder>()
      .addComponents(
          new ButtonBuilder()
              .setCustomId('finance_request_loan')
              .setLabel('💸 ยืมเงิน')
              .setStyle(ButtonStyle.Primary)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_request_repay')
              .setLabel('🏦 ชำระหนี้ยืม')
              .setStyle(ButtonStyle.Success)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_request_deposit')
              .setLabel('📥 จ่ายยอดเก็บ/ฝากเครดิต')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasFinance),
          new ButtonBuilder()
              .setCustomId('finance_balance')
              .setLabel('💳 สถานะการเงิน')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(!hasFinance),
      );

    await runRepairableSetupStep(
        diagnostics,
        'ข้อความการเงิน',
        async () => {
            if (!financeChannel) return;

            const messages = await (financeChannel as TextChannel).messages.fetch({ limit: 25 }).catch(() => null);
            const existingMsg = messages?.find(m =>
                m.author.id === interaction.client.user.id &&
                (
                    m.embeds[0]?.title?.includes('ระบบการเงิน') ||
                    m.embeds[0]?.title?.includes('ศูนย์การเงินของสมาชิก')
                )
            );

            if (existingMsg) {
                await existingMsg.delete().catch(() => { });
            }

            await (financeChannel as TextChannel).send({ embeds: [financeEmbed], components: [financeRow] });
        },
        { guildId: guild.id, gangId }
    );

    // === Send Verify Button ===
    await runRepairableSetupStep(
        diagnostics,
        'ข้อความยืนยันตัวตน',
        async () => {
            if (!verifyChannel) return;

            const verifyEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('✅ ยืนยันตัวตนก่อนใช้งาน')
                .setDescription(
                    'สมาชิกใหม่และผู้เข้ามาใหม่เริ่มจากข้อความนี้ก่อน\n\n' +
                    'หลังยืนยันแล้วคุณจะเห็นห้องพื้นฐานที่แอดมินเปิดไว้ในเซิร์ฟเวอร์\n' +
                    'ถ้าต้องการเข้าร่วมแก๊งต่อ ให้ไปกดในห้อง **ลงทะเบียน** เพิ่มเติม'
                )
                .addFields(
                    { name: 'ลำดับที่แนะนำ', value: '1. กดยืนยันตัวตน\n2. อ่านกฎ/ประกาศ\n3. ไปที่ห้องลงทะเบียนเพื่อสมัครเข้าแก๊ง' }
                )
                .setFooter({ text: 'Gang Manager' });

            const verifyRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('verify_member')
                        .setLabel('✅ เริ่มยืนยันตัวตน')
                        .setStyle(ButtonStyle.Success)
                );

            const msgs = await (verifyChannel as TextChannel).messages.fetch({ limit: 25 }).catch(() => null);
            const oldVerify = msgs?.find(m => m.author.id === interaction.client.user.id && m.embeds[0]?.title?.includes('ยืนยันตัวตน'));
            if (oldVerify) await oldVerify.delete().catch(() => { });

            await (verifyChannel as TextChannel).send({ embeds: [verifyEmbed], components: [verifyRow] });
        },
        { guildId: guild.id, gangId }
    );

    return diagnostics;
}

async function sendSetupInstructions(interaction: SetupComponentInteraction | ChatInputCommandInteraction, gangId: string) {
    const settings = await db.query.gangSettings.findFirst({ where: eq(gangSettings.gangId, gangId) });
    if (!settings?.registerChannelId) return;

    const registerChannel = interaction.guild?.channels.cache.get(settings.registerChannelId) as TextChannel;
    if (!registerChannel) return;

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📝 สมัครเข้าร่วมแก๊ง')
        .setDescription('สมาชิกใหม่เริ่มที่ข้อความนี้ได้เลย\nกดปุ่มด้านล่างเพื่อส่งคำขอเข้าระบบ')
        .addFields(
            { name: 'ทำอย่างไร', value: '1. กดปุ่ม "สมัครสมาชิก"\n2. กรอกชื่อในแก๊งของคุณ\n3. รอหัวหน้า/แอดมินอนุมัติและรับยศ' },
            { name: 'หลังจากอนุมัติแล้ว', value: 'คุณจะเริ่มใช้งานเช็คชื่อ, แจ้งลา, การเงิน และ Dashboard ได้ทันที' }
        );

    const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(new ButtonBuilder().setCustomId('register').setLabel('📝 สมัครสมาชิก').setStyle(ButtonStyle.Primary));

    // Delete old message if exists
    if (settings.registerMessageId) {
        try {
            const oldMessage = await registerChannel.messages.fetch(settings.registerMessageId);
            if (oldMessage) await oldMessage.delete();
        } catch { /* Message already deleted or not found */ }
    }

    // Send new message and save ID
    const newMessage = await registerChannel.send({ embeds: [embed], components: [button] });
    await db.update(gangSettings)
        .set({ registerMessageId: newMessage.id })
        .where(eq(gangSettings.gangId, gangId));
}

async function sendAdminPanel(interaction: SetupComponentInteraction | ChatInputCommandInteraction, gangId: string) {
    const settings = await db.query.gangSettings.findFirst({
        where: eq(gangSettings.gangId, gangId),
        columns: { adminPanelMessageId: true, logChannelId: true, requestsChannelId: true }
    });
    const adminChannel = pickSetupAdminPanelChannel(
        interaction.guild,
        settings,
        interaction.guild?.members.me
    ) as TextChannel | null;
    if (!adminChannel) {
        logWarn('bot.setup.admin_panel_channel_unavailable', {
            guildId: interaction.guildId,
            gangId,
        });
        return;
    }

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        columns: { subscriptionTier: true, subscriptionExpiresAt: true }
    });
    const hasFinance = gang
        ? canAccessFeature(resolveEffectiveSubscriptionTier(gang.subscriptionTier, gang.subscriptionExpiresAt), 'finance')
        : false;

    const dashboardUrl = buildDashboardUrl(gangId, { guildId: interaction.guildId, gangId });
    const settingsUrl = `${dashboardUrl}/settings`;
    const financeUrl = `${dashboardUrl}/finance`;

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('🎛️ ศูนย์ควบคุมหัวหน้าแก๊ง')
        .setDescription('ใช้ข้อความนี้เป็นจุดรวมงานหลักของหัวหน้าแก๊งและแอดมิน\nทั้งงานด่วนใน Discord และงานละเอียดบนหน้าเว็บ')
        .addFields(
            { name: 'ทำอะไรได้ทันทีจากตรงนี้', value: '• เปิด Dashboard เพื่อจัดการสมาชิกและตั้งค่า\n• บันทึกรายรับ/รายจ่ายแบบด่วน\n• ซ่อมห้อง/ยศเมื่อมีคนลบหรือย้าย' },
            { name: 'ถ้าระบบดูไม่ครบ', value: 'กดปุ่มซ่อมห้องและยศได้เลย แล้วค่อยตรวจซ้ำบน Dashboard' }
        )
        .setFooter({ text: 'ถ้าข้อความนี้หาย ให้ใช้ /setup เพื่อสร้างแผงควบคุมใหม่' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('🌐 Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
        new ButtonBuilder().setLabel('⚙️ ตั้งค่าเว็บ').setStyle(ButtonStyle.Link).setURL(settingsUrl),
        new ButtonBuilder().setLabel('💰 การเงินบนเว็บ').setStyle(ButtonStyle.Link).setURL(financeUrl).setDisabled(!hasFinance)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`setup_verify_auto_${gangId}`).setLabel('🔄 ซ่อมห้องและยศ').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`setup_verify_select_${gangId}`).setLabel('🎭 ยศ Verify').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_income').setLabel('💰 รายรับด่วน').setStyle(ButtonStyle.Success).setDisabled(!hasFinance),
        new ButtonBuilder().setCustomId('admin_expense').setLabel('💸 รายจ่ายด่วน').setStyle(ButtonStyle.Danger).setDisabled(!hasFinance)
    );

    // Delete old message if exists
    if (settings?.adminPanelMessageId) {
        try {
            const oldMessage = await adminChannel.messages.fetch(settings.adminPanelMessageId);
            if (oldMessage) await oldMessage.delete();
        } catch { /* Message already deleted or not found */ }
    }

    // Send new message and save ID
    const newMessage = await adminChannel.send({ embeds: [embed], components: [row1, row2] });
    await db.update(gangSettings)
        .set({ adminPanelMessageId: newMessage.id })
        .where(eq(gangSettings.gangId, gangId));
}

async function sendPublicDashboardPanel(interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction | AnySelectMenuInteraction, gangId: string, channel: TextChannel | null) {
    if (!channel) return;

    const recentMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const existingPanel = recentMessages?.find((message) => message.author.id === interaction.client.user.id && message.embeds[0]?.title?.includes('เว็บแดชบอร์ดสมาชิก'));
    if (existingPanel) {
        await existingPanel.delete().catch(() => { });
    }

    const embed = new EmbedBuilder()
        .setColor(0x00B0F4)
        .setTitle('🌐 เว็บแดชบอร์ดสมาชิก')
        .setDescription('สมาชิกทุกคนใช้ข้อความนี้เป็นทางเข้าหน้าเว็บหลักของแก๊ง\nล็อกอินด้วย Discord แล้วดูข้อมูลส่วนตัว การเงิน เช็คชื่อ และหน้าจัดการต่าง ๆ ได้ทันที')
        .addFields(
            { name: 'ใช้ทำอะไรได้บ้าง', value: '• ดูสถานะการเงินของตัวเอง\n• ดูประวัติเช็คชื่อและการลา\n• ให้หัวหน้าเข้าไปจัดการสมาชิก การเงิน และตั้งค่า' },
            { name: 'วิธีเข้าใช้', value: 'กดปุ่มด้านล่าง แล้วล็อกอินด้วย Discord บัญชีเดียวกับที่อยู่ในเซิร์ฟเวอร์นี้' }
        )
        .setFooter({ text: 'Gang Manager' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setLabel('เปิด Dashboard')
            .setStyle(ButtonStyle.Link)
            .setURL(buildDashboardUrl(gangId, { guildId: interaction.guildId, gangId }))
    );

    await channel.send({ embeds: [embed], components: [row] });
}

async function removePublicDashboardPanel(interaction: ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction | AnySelectMenuInteraction, channel: TextChannel | null) {
    if (!channel) return;

    const recentMessages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    const existingPanel = recentMessages?.find((message) => message.author.id === interaction.client.user.id && message.embeds[0]?.title?.includes('เว็บแดชบอร์ดสมาชิก'));
    if (existingPanel) {
        await existingPanel.delete().catch(() => { });
    }
}

export { handleSetupStart, handleSetupModalSubmit, handleSetupModeAuto, handleSetupVerifyAuto, handleSetupModeManual, handleSetupVerifyRoleSelect, handleSetupRoleSelect, isManagedLeavePanelMessage, sendAdminPanel };
