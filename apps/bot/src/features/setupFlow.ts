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
    ChannelSelectMenuBuilder,
    type PermissionResolvable,
    MessageFlags,
} from 'discord.js';
import { registerButtonHandler, registerModalHandler, registerSelectMenuHandler } from '../handlers';
import { db, gangs, gangSettings, gangRoles, members, licenses, getTierConfig, normalizeSubscriptionTier } from '@gang/database';
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
    'ห้องคนลา',
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
    'ห้องคนลา': ['คนลา', 'leave-approved', 'approved-leave'],
    'สรุปเช็คชื่อ': ['attendance-summary', 'summary-attendance'],
    'แผงควบคุม': ['admin-panel', 'control-panel'],
};
const AUTO_VISITOR_ROLE_NAMES = ['Visitor', 'Verified'];
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
    adminPanelChannelId?: string | null;
    logChannelId?: string | null;
    requestsChannelId?: string | null;
};

type SetupDiagnostics = {
    roleHierarchyWarning?: string | null;
    messageWarnings?: string[];
};

type CreateDefaultResourceOptions = {
    verifiedRoleId?: string | null;
    memberRoleId?: string | null;
    roleSelections?: Partial<Record<InternalSetupPermission, string | null>>;
    channelSelections?: Partial<Record<SetupChannelKey, SetupChannelDecision>>;
};

type SetupChannelKey =
    | 'verifyChannelId'
    | 'registerChannelId'
    | 'announcementChannelId'
    | 'websiteChannelId'
    | 'attendanceChannelId'
    | 'attendanceSummaryChannelId'
    | 'leaveChannelId'
    | 'approvedLeaveChannelId'
    | 'financeChannelId'
    | 'penaltyChannelId'
    | 'requestsChannelId'
    | 'adminPanelChannelId'
    | 'logChannelId';

type SetupChannelDecision = string | 'CREATE' | null;

type SetupWizardDraft = {
    id: string;
    gangId: string;
    guildId: string;
    userDiscordId: string;
    mode: 'EXISTING_SERVER';
    createdAt: number;
    roleSelections: Partial<Record<InternalSetupPermission, string | null>>;
    channelSelections: Partial<Record<SetupChannelKey, SetupChannelDecision>>;
};

type SetupRoleStep = {
    permission: InternalSetupPermission;
    title: string;
    description: string;
    selectPlaceholder: string;
    autoLabel: string;
    required?: boolean;
};

type SetupChannelStep = {
    key: SetupChannelKey;
    title: string;
    description: string;
    defaultName: string;
    required?: boolean;
    allowNone?: boolean;
};

const SETUP_SERVER_ADMIN_DENIED_MESSAGE = '❌ ต้องเป็น Administrator ของ Discord server ก่อนเริ่มติดตั้งระบบ';
const SETUP_GANG_OWNER_DENIED_MESSAGE = '❌ ปุ่มตั้งค่าและซ่อมระบบใช้ได้เฉพาะหัวหน้าแก๊ง (Owner) เท่านั้น';
const MANAGED_LEAVE_PANEL_BUTTON_IDS = ['request_leave_late', 'request_leave_1day', 'request_leave_multi'];
const SETUP_WIZARD_TTL_MS = 30 * 60 * 1000;
const setupWizardDrafts = new Map<string, SetupWizardDraft>();

const SETUP_ROLE_STEPS: SetupRoleStep[] = [
    {
        permission: 'VERIFIED',
        title: 'ยศคนทั่วไปในเซิร์ฟ',
        description: 'คนที่อยู่ใน Discord แต่ยังไม่ได้เป็นสมาชิกแก๊ง เช่น คนที่เข้ามาคุย เล่นเกมอื่น หรือรอสมัครเข้าแก๊ง ยศนี้ไม่ใช่ยศสมาชิกแก๊ง',
        selectPlaceholder: 'เลือกยศคนทั่วไปที่มีอยู่แล้ว',
        autoLabel: 'สร้างยศคนทั่วไปใหม่',
        required: true,
    },
    {
        permission: 'MEMBER',
        title: 'ยศสมาชิกแก๊ง',
        description: 'ยศหลักของคนที่ผ่านอนุมัติเป็นสมาชิกแก๊งจริง เช่น BIDROI หรือชื่อแก๊งเดิมของคุณ',
        selectPlaceholder: 'เลือกยศสมาชิกแก๊งที่มีอยู่แล้ว',
        autoLabel: 'สร้าง/ใช้ Gang Member',
        required: true,
    },
    {
        permission: 'ADMIN',
        title: 'ยศแอดมินแก๊ง',
        description: 'ยศสำหรับคนที่ช่วยดูแลสมาชิกและอนุมัติงานบนระบบ',
        selectPlaceholder: 'เลือกยศแอดมินแก๊งที่มีอยู่แล้ว',
        autoLabel: 'สร้าง/ใช้ Gang Admin',
    },
    {
        permission: 'TREASURER',
        title: 'ยศเหรัญญิก',
        description: 'ยศสำหรับคนที่ดูแลงานการเงิน คำขอ และรายการตรวจสอบ',
        selectPlaceholder: 'เลือกยศเหรัญญิกที่มีอยู่แล้ว',
        autoLabel: 'สร้าง/ใช้ Gang Treasurer',
    },
    {
        permission: 'ATTENDANCE_OFFICER',
        title: 'ยศเจ้าหน้าที่เช็คชื่อ',
        description: 'ยศสำหรับคนที่เปิดรอบเช็คชื่อ ปิดรอบ และแก้สถานะสมาชิก',
        selectPlaceholder: 'เลือกยศเจ้าหน้าที่เช็คชื่อที่มีอยู่แล้ว',
        autoLabel: 'สร้าง/ใช้ Gang Attendance',
    },
];

const SETUP_CHANNEL_STEPS: SetupChannelStep[] = [
    { key: 'verifyChannelId', title: 'ห้องรับยศคนทั่วไป', description: 'ห้องที่คนในเซิร์ฟกดรับยศพื้นฐานก่อนสมัครเข้าแก๊งจริง', defaultName: 'ยืนยันตัวตน', required: true },
    { key: 'registerChannelId', title: 'ห้องสมัครเข้าแก๊ง', description: 'ห้องที่คนส่งคำขอเข้าแก๊งจริง หลังจากได้ยศคนทั่วไปแล้ว', defaultName: 'ลงทะเบียน', required: true },
    { key: 'announcementChannelId', title: 'ห้องประกาศ', description: 'ห้องประกาศข่าวสำคัญและประกาศจากเว็บ', defaultName: 'ประกาศ', required: true },
    { key: 'websiteChannelId', title: 'ห้องลิงก์เว็บ', description: 'ห้องที่วางลิงก์ Dashboard ให้สมาชิกเข้าใช้งาน', defaultName: 'Website', required: true },
    { key: 'attendanceChannelId', title: 'ห้องเช็คชื่อ', description: 'ห้องสำหรับรอบเช็คชื่อและปุ่มเช็คชื่อผ่าน Discord', defaultName: 'เช็คชื่อ', required: true },
    { key: 'attendanceSummaryChannelId', title: 'ห้องสรุปเช็คชื่อ', description: 'ห้องปลายทางของสรุปหลังปิดรอบเช็คชื่อ', defaultName: 'สรุปเช็คชื่อ', required: true },
    { key: 'leaveChannelId', title: 'ห้องแจ้งลา', description: 'ห้องที่สมาชิกกดแจ้งลา/เข้าช้า', defaultName: 'แจ้งลา', required: true },
    { key: 'approvedLeaveChannelId', title: 'ห้องคนลา', description: 'ห้องที่ระบบประกาศรายการลา/เข้าช้าที่อนุมัติแล้ว พร้อมเหตุผลและเวลาอนุมัติ', defaultName: 'ห้องคนลา', required: true },
    { key: 'financeChannelId', title: 'ห้องการเงิน', description: 'ห้องปุ่มการเงินสำหรับสมาชิก', defaultName: 'แจ้งธุรกรรม', required: true },
    { key: 'penaltyChannelId', title: 'ห้องค่าปรับ', description: 'ห้องที่ระบบประกาศค่าปรับรายคนแบบ Embed เช่น ค่าแอร์ดรอปหรือค่าปรับเช็คชื่อ', defaultName: 'ค่าปรับ', required: true },
    { key: 'requestsChannelId', title: 'ห้องคำขอ / อนุมัติ', description: 'ห้องรวมคำขอเข้าแก๊ง แจ้งลา และคำขอการเงินให้ทีมดูแลตรวจ', defaultName: '📋-คำขอและอนุมัติ', required: true },
    { key: 'adminPanelChannelId', title: 'ห้องควบคุมหัวหน้าแก๊ง', description: 'ห้องรวมปุ่มจัดการสำหรับหัวหน้าแก๊งและทีมดูแล', defaultName: 'แผงควบคุม', required: true },
    { key: 'logChannelId', title: 'ห้องบันทึกระบบ', description: 'ห้องที่บอทส่งบันทึกเหตุการณ์สำคัญ ถ้าไม่อยากให้บอทส่งบันทึกลง Discord ให้เลือกปิดได้', defaultName: 'log-ระบบ', allowNone: true },
];

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

    if (settings?.adminPanelChannelId) addCandidate(cache.get(settings.adminPanelChannelId));
    for (const channel of getChannelCacheValues(cache)) {
        if (channel?.name === 'แผงควบคุม') {
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
        return 'บอทยังไม่มีสิทธิ์จัดการยศหรือจัดการห้อง กรุณาเปิดสิทธิ์ให้บอทก่อน แล้วค่อยเริ่ม /setup ใหม่อีกครั้ง';
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

function cleanupExpiredSetupWizardDrafts() {
    const now = Date.now();
    for (const [id, draft] of setupWizardDrafts.entries()) {
        if (now - draft.createdAt > SETUP_WIZARD_TTL_MS) {
            setupWizardDrafts.delete(id);
        }
    }
}

function createSetupWizardDraft(gangId: string, guildId: string, userDiscordId: string) {
    cleanupExpiredSetupWizardDrafts();
    const draft: SetupWizardDraft = {
        id: nanoid(),
        gangId,
        guildId,
        userDiscordId,
        mode: 'EXISTING_SERVER',
        createdAt: Date.now(),
        roleSelections: {},
        channelSelections: {},
    };
    setupWizardDrafts.set(draft.id, draft);
    return draft;
}

function getSetupWizardDraft(draftId: string, interaction: SetupComponentInteraction) {
    cleanupExpiredSetupWizardDrafts();
    const draft = setupWizardDrafts.get(draftId);
    if (!draft) return null;
    if (draft.guildId !== interaction.guildId || draft.userDiscordId !== interaction.user.id) return null;
    return draft;
}

async function updateSetupInteraction(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    payload: { content?: string; embeds?: EmbedBuilder[]; components?: any[] }
) {
    if (interaction.replied || interaction.deferred) {
        await interaction.editReply(payload);
        return;
    }

    if (isEphemeralComponentInteraction(interaction) && typeof (interaction as any).update === 'function') {
        await (interaction as any).update(payload);
        return;
    }

    if (typeof (interaction as any).deferUpdate === 'function' && typeof (interaction as any).editReply === 'function') {
        await (interaction as any).deferUpdate();
        await (interaction as any).editReply(payload);
        return;
    }

    await interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
}

function buildSetupModePrompt(gangName: string, gangId: string, options: { existingGang?: boolean; trialInfo?: string; transferredInfo?: string } = {}) {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle(options.existingGang ? '🧭 ตั้งค่าระบบ Discord ของแก๊งนี้' : '🧭 เลือกรูปแบบการติดตั้ง')
        .setDescription(
            `แก๊ง **"${gangName}"** พร้อมเข้าสู่ขั้นตอนติดตั้งแล้ว${options.trialInfo ?? ''}${options.transferredInfo ?? ''}\n` +
            'เลือกให้ตรงกับสภาพเซิร์ฟเวอร์จริง เพื่อไม่ให้บอทสร้างห้องหรือยศทับของเดิม'
        )
        .addFields(
            {
                name: '🆕 ติดตั้งในเซิร์ฟเวอร์ใหม่',
                value: 'เหมาะกับเซิร์ฟที่ยังไม่มีโครงห้องแก๊ง บอทจะสร้างยศ ห้อง และข้อความพร้อมปุ่มใช้งานครบชุด',
            },
            {
                name: '🏠 เชื่อมกับเซิร์ฟเวอร์เดิม',
                value: 'เหมาะกับแก๊งที่มีห้องหรือยศอยู่แล้ว ระบบจะตรวจความพร้อม ให้เลือกของเดิม และให้ดูสรุปก่อนทำจริง',
            },
            {
                name: 'กฎความปลอดภัย',
                value: 'โหมดเซิร์ฟเวอร์เดิมจะยังไม่สร้างห้อง ไม่สร้างยศ และไม่ส่งข้อความระบบ จนกว่าจะถึงหน้าสรุปและคุณกดยืนยัน',
            }
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`setup_install_new_${gangId}`)
            .setLabel('ติดตั้งในเซิร์ฟเวอร์ใหม่')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`setup_install_existing_${gangId}`)
            .setLabel('เชื่อมกับเซิร์ฟเวอร์เดิม')
            .setStyle(ButtonStyle.Primary)
    );

    return { embeds: [embed], components: [row] };
}

function getRoleNameFromGuild(interaction: SetupComponentInteraction, roleId?: string | null) {
    if (!roleId) return null;
    return interaction.guild?.roles.cache.get(roleId)?.name ?? roleId;
}

function getChannelNameFromGuild(interaction: SetupComponentInteraction, channelId?: string | null) {
    if (!channelId) return null;
    return interaction.guild?.channels.cache.get(channelId)?.name ?? channelId;
}

function getDefaultRoleLabel(permission: InternalSetupPermission) {
    if (permission === 'VERIFIED') return 'สร้าง/ใช้ยศคนทั่วไป';
    if (permission === 'OWNER') return 'Owner จากเจ้าของเซิร์ฟเวอร์';
    const config = getDefaultSetupRoleConfig(permission);
    return config ? `สร้าง/ใช้ ${config.name}` : 'สร้าง/ใช้ค่าเริ่มต้น';
}

function getDefaultSetupRoleConfig(permission: InternalSetupPermission): SetupRoleConfig | null {
    if (permission === 'OWNER') return { name: 'Gang Owner', color: '#FFD700', permission: 'OWNER', hoist: true, preserveExistingMapping: false };
    if (permission === 'ADMIN') return { name: 'Gang Admin', color: '#FF0000', permission: 'ADMIN', hoist: true };
    if (permission === 'TREASURER') return { name: 'Gang Treasurer', color: '#00FF00', permission: 'TREASURER', hoist: true };
    if (permission === 'ATTENDANCE_OFFICER') return { name: 'Gang Attendance', color: '#FEE75C', permission: 'ATTENDANCE_OFFICER', hoist: true };
    if (permission === 'MEMBER') return { name: 'Gang Member', color: '#3498DB', permission: 'MEMBER', hoist: true };
    return null;
}

function buildPreflightReport(interaction: SetupComponentInteraction, gangId: string) {
    const guild = resolveInteractionGuild(interaction);
    const botMember = guild?.members.me;
    const checks: { label: string; ok: boolean; detail: string; blocking?: boolean }[] = [];

    checks.push({
        label: 'บอทอยู่ในเซิร์ฟเวอร์',
        ok: Boolean(guild && botMember),
        detail: guild && botMember ? 'พร้อมตรวจสิทธิ์ต่อ' : 'ยังไม่พบบอทในเซิร์ฟเวอร์นี้',
        blocking: true,
    });

    checks.push({
        label: 'บอทจัดการยศได้',
        ok: Boolean(botMember?.permissions.has(PermissionFlagsBits.ManageRoles)),
        detail: 'ใช้สำหรับให้/ถอนยศสมาชิก และสร้างยศที่ระบบต้องใช้',
        blocking: true,
    });

    checks.push({
        label: 'บอทจัดการห้องได้',
        ok: Boolean(botMember?.permissions.has(PermissionFlagsBits.ManageChannels)),
        detail: 'ใช้เฉพาะตอนสร้างห้องใหม่หรือสร้างชุดมาตรฐาน',
        blocking: true,
    });

    const hierarchyIssue = getBotRoleHierarchyIssue(guild, botMember);
    checks.push({
        label: 'ลำดับยศบอท',
        ok: !hierarchyIssue,
        detail: hierarchyIssue?.warning ?? 'ยศของบอทสูงพอสำหรับยศที่ระบบต้องให้หรือถอน',
        blocking: false,
    });

    checks.push({
        label: 'ข้อมูลแก๊ง',
        ok: Boolean(gangId),
        detail: 'เซิร์ฟเวอร์นี้ผูกกับข้อมูลแก๊งแล้ว ขั้นตอนต่อไปจะบันทึก mapping ลงแก๊งนี้',
        blocking: true,
    });

    return {
        checks,
        blockingCount: checks.filter(check => check.blocking && !check.ok).length,
        warningCount: checks.filter(check => !check.blocking && !check.ok).length,
    };
}

async function showExistingSetupPreflight(interaction: ButtonInteraction, gangId: string) {
    const accessFailure = await getSetupActionAccessFailure(interaction, { gangId });
    if (accessFailure) {
        await rejectSetupAction(interaction, accessFailure);
        return;
    }

    const guild = resolveInteractionGuild(interaction);
    await guild?.channels.fetch().catch(error => logWarn('bot.setup.preflight_channels_fetch_failed', { guildId: interaction.guildId, gangId, error }));
    await guild?.roles.fetch().catch(error => logWarn('bot.setup.preflight_roles_fetch_failed', { guildId: interaction.guildId, gangId, error }));

    const draft = createSetupWizardDraft(gangId, interaction.guildId!, interaction.user.id);
    const report = buildPreflightReport(interaction, gangId);
    const embed = new EmbedBuilder()
        .setColor(report.blockingCount > 0 ? 0xED4245 : report.warningCount > 0 ? 0xFEE75C : 0x57F287)
        .setTitle('🔎 ตรวจความพร้อมก่อนเชื่อมเซิร์ฟเวอร์เดิม')
        .setDescription(
            'ขั้นตอนนี้ยังไม่สร้างห้อง ไม่สร้างยศ และยังไม่ส่งข้อความระบบลง Discord\n' +
            'ระบบจะตรวจสิทธิ์ก่อน แล้วค่อยให้เลือกยศและห้องที่มีอยู่จริงในเซิร์ฟเวอร์'
        )
        .addFields(
            ...report.checks.map(check => ({
                name: `${check.ok ? '✅' : check.blocking ? '❌' : '⚠️'} ${check.label}`,
                value: check.detail,
            })),
            {
                name: 'สิ่งที่จะเกิดหลังจากนี้',
                value: 'เลือกยศ → เลือกห้อง → ดูหน้าสรุป → กดยืนยัน ระบบถึงจะเริ่มสร้างเฉพาะของที่ขาดและส่งข้อความพร้อมปุ่มใช้งาน',
            }
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`setup_preflight_continue_${draft.id}`)
            .setLabel(report.blockingCount > 0 ? 'แก้สิทธิ์ก่อน แล้วกด /setup ใหม่' : 'ไปเลือกยศ')
            .setStyle(report.blockingCount > 0 ? ButtonStyle.Secondary : ButtonStyle.Primary)
            .setDisabled(report.blockingCount > 0),
        new ButtonBuilder()
            .setCustomId(`setup_cancel_${draft.id}`)
            .setLabel('ยกเลิก')
            .setStyle(ButtonStyle.Secondary)
    );

    await updateSetupInteraction(interaction, { embeds: [embed], components: [row], content: '' });
}

function validateSetupRoleWizardSelection(
    interaction: AnySelectMenuInteraction,
    draft: SetupWizardDraft,
    permission: InternalSetupPermission,
    selectedRoleId: string
) {
    const baseError = permission === 'VERIFIED'
        ? validateVerifiedRoleSelection(interaction, selectedRoleId)
        : validateVerifiedRoleSelection(interaction, selectedRoleId)
            ?.replace('ยศของระบบแก๊ง', 'ยศระบบแก๊ง')
            .replace('ยศปกติของเซิร์ฟเวอร์', 'ยศปกติของเซิร์ฟเวอร์');
    if (baseError) return baseError;

    const duplicate = Object.entries(draft.roleSelections)
        .find(([existingPermission, roleId]) => existingPermission !== permission && roleId === selectedRoleId);
    if (duplicate) {
        const duplicateStep = SETUP_ROLE_STEPS.find(step => step.permission === duplicate[0]);
        return `ยศนี้ถูกเลือกเป็น "${duplicateStep?.title ?? duplicate[0]}" แล้ว กรุณาเลือกยศคนละตัวเพื่อไม่ให้สิทธิ์ปนกัน`;
    }

    if (permission === 'MEMBER' && draft.roleSelections.VERIFIED === selectedRoleId) {
        return 'ยศสมาชิกแก๊งต้องคนละยศกับยศคนทั่วไปในเซิร์ฟ';
    }

    return null;
}

async function showSetupRoleStep(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    draft: SetupWizardDraft,
    warning?: string
) {
    const step = SETUP_ROLE_STEPS.find(roleStep => !(roleStep.permission in draft.roleSelections));
    if (!step) {
        await showSetupChannelStep(interaction, draft);
        return;
    }

    const currentIndex = SETUP_ROLE_STEPS.findIndex(roleStep => roleStep.permission === step.permission) + 1;
    const selectedLines = SETUP_ROLE_STEPS
        .filter(roleStep => roleStep.permission in draft.roleSelections)
        .map(roleStep => {
            const selected = draft.roleSelections[roleStep.permission];
            return `• ${roleStep.title}: ${selected ? getRoleNameFromGuild(interaction, selected) : getDefaultRoleLabel(roleStep.permission)}`;
        });

    const embed = new EmbedBuilder()
        .setColor(warning ? 0xED4245 : 0x5865F2)
        .setTitle(`🎭 เลือก${step.title}`)
        .setDescription(`${step.description}\n\nขั้นตอนยศ ${currentIndex}/${SETUP_ROLE_STEPS.length}`)
        .addFields(
            {
                name: 'เลือกแบบไหนดี',
                value: 'ถ้าเซิร์ฟมียศเดิมอยู่แล้วให้เลือกยศเดิม ถ้ายังไม่มีให้กดสร้างใหม่ ระบบจะสร้างเฉพาะยศที่คุณเลือกให้สร้าง',
            },
            {
                name: 'เลือกไปแล้ว',
                value: selectedLines.length ? selectedLines.join('\n') : 'ยังไม่ได้เลือกยศ',
            }
        );

    if (warning) {
        embed.addFields({ name: '⚠️ ยังไปต่อไม่ได้', value: warning });
    }

    const select = new RoleSelectMenuBuilder()
        .setCustomId(`setup_role_select:${draft.id}:${step.permission}`)
        .setPlaceholder(step.selectPlaceholder)
        .setMinValues(1)
        .setMaxValues(1);

    const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`setup_role_auto:${draft.id}:${step.permission}`)
            .setLabel(step.autoLabel)
            .setStyle(ButtonStyle.Secondary)
    );

    await updateSetupInteraction(interaction, { embeds: [embed], components: [selectRow, buttonRow], content: '' });
}

async function showSetupChannelStep(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    draft: SetupWizardDraft,
    warning?: string
) {
    const step = SETUP_CHANNEL_STEPS.find(channelStep => !(channelStep.key in draft.channelSelections));
    if (!step) {
        await showSetupPreview(interaction, draft);
        return;
    }

    const currentIndex = SETUP_CHANNEL_STEPS.findIndex(channelStep => channelStep.key === step.key) + 1;
    const selectedLines = SETUP_CHANNEL_STEPS
        .filter(channelStep => channelStep.key in draft.channelSelections)
        .map(channelStep => {
            const selected = draft.channelSelections[channelStep.key];
            if (selected === 'CREATE') return `• ${channelStep.title}: สร้างใหม่ (#${channelStep.defaultName})`;
            if (selected === null) return `• ${channelStep.title}: ปิดการส่งข้อความของหมวดนี้ใน Discord`;
            return `• ${channelStep.title}: #${getChannelNameFromGuild(interaction, selected)}`;
        });

    const embed = new EmbedBuilder()
        .setColor(warning ? 0xED4245 : 0x3498DB)
        .setTitle(`#️⃣ เลือก${step.title}`)
        .setDescription(`${step.description}\n\nขั้นตอนห้อง ${currentIndex}/${SETUP_CHANNEL_STEPS.length}`)
        .addFields(
            {
                name: 'ถ้าเลือกห้องเดิม ระบบจะทำแค่นี้',
                value: 'บอทจะส่งหรือซ่อมเฉพาะข้อความพร้อมปุ่มที่ Gang Manager ใช้ในห้องนั้น จะไม่ลบแชทเก่า ไม่ย้ายห้อง และไม่แก้สิทธิ์ห้องเดิมเอง',
            },
            {
                name: 'เลือกไปแล้ว',
                value: selectedLines.length ? selectedLines.join('\n') : 'ยังไม่ได้เลือกห้อง',
            }
        );

    if (warning) {
        embed.addFields({ name: '⚠️ ยังไปต่อไม่ได้', value: warning });
    }

    const select = new ChannelSelectMenuBuilder()
        .setCustomId(`setup_channel_select:${draft.id}:${step.key}`)
        .setPlaceholder(`เลือก${step.title}ที่มีอยู่แล้ว`)
        .setChannelTypes(ChannelType.GuildText)
        .setMinValues(1)
        .setMaxValues(1);

    const selectRow = new ActionRowBuilder<ChannelSelectMenuBuilder>().addComponents(select);
    const buttons = [
        new ButtonBuilder()
            .setCustomId(`setup_channel_create:${draft.id}:${step.key}`)
            .setLabel(`สร้าง #${step.defaultName}`)
            .setStyle(ButtonStyle.Secondary),
    ];
    if (step.allowNone) {
        buttons.push(
            new ButtonBuilder()
                .setCustomId(`setup_channel_none:${draft.id}:${step.key}`)
                .setLabel('ไม่ส่งบันทึกลง Discord')
                .setStyle(ButtonStyle.Secondary)
        );
    }
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

    await updateSetupInteraction(interaction, { embeds: [embed], components: [selectRow, buttonRow], content: '' });
}

async function showSetupPreview(interaction: ButtonInteraction | AnySelectMenuInteraction, draft: SetupWizardDraft) {
    const roleLines = SETUP_ROLE_STEPS.map(step => {
        const selected = draft.roleSelections[step.permission];
        return selected
            ? `• ${step.title}: ใช้ยศเดิม "${getRoleNameFromGuild(interaction, selected)}"`
            : `• ${step.title}: ${getDefaultRoleLabel(step.permission)}`;
    });

    const createChannels: string[] = [];
    const useChannels: string[] = [];
    const disabledChannels: string[] = [];
    for (const step of SETUP_CHANNEL_STEPS) {
        const decision = draft.channelSelections[step.key];
        if (decision === 'CREATE') createChannels.push(`#${step.defaultName}`);
        else if (decision === null) disabledChannels.push(step.title);
        else if (decision) useChannels.push(`${step.title}: #${getChannelNameFromGuild(interaction, decision)}`);
    }

    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ ตรวจสอบก่อนติดตั้ง/อัปเดตระบบ')
        .setDescription('ตอนนี้ยังไม่มีการสร้างห้อง ส่งข้อความลง Discord หรือแก้ยศใด ๆ จนกว่าจะกดปุ่มยืนยันด้านล่าง')
        .addFields(
            { name: 'ยศที่จะใช้', value: roleLines.join('\n').slice(0, 1024) },
            { name: 'ห้องเดิมที่จะใช้', value: useChannels.length ? useChannels.join('\n').slice(0, 1024) : 'ไม่ได้เลือกห้องเดิม' },
            { name: 'ห้องใหม่ที่จะสร้าง', value: createChannels.length ? createChannels.join('\n').slice(0, 1024) : 'ไม่ต้องสร้างห้องใหม่' },
            { name: 'หมวดที่ปิดการส่งข้อความใน Discord', value: disabledChannels.length ? disabledChannels.join('\n') : 'ไม่มีหมวดไหนถูกปิด ระบบจะใช้ห้องเดิมหรือสร้างห้องใหม่ตามที่เลือกไว้' },
            {
                name: 'ของเดิมในเซิร์ฟจะปลอดภัย',
                value: 'จะไม่ลบข้อความหรือประวัติแชทเก่า\nจะไม่ย้ายห้องเดิมที่เลือกไว้\nจะไม่เปลี่ยนสิทธิ์การมองเห็นหรือการพิมพ์ของห้องเดิมเอง\nถ้าบอทให้/ถอนยศไหนไม่ได้ ระบบจะหยุดและบอกให้แก้ก่อน',
            }
        );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`setup_apply:${draft.id}`)
            .setLabel('ยืนยันติดตั้ง/อัปเดตระบบ')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`setup_cancel_${draft.id}`)
            .setLabel('ยกเลิก')
            .setStyle(ButtonStyle.Secondary)
    );

    await updateSetupInteraction(interaction, { embeds: [embed], components: [row], content: '' });
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
    config: SetupRoleConfig,
    selectedRoleId?: string | null
) {
    const existingByPermission = await db.query.gangRoles.findFirst({
        where: (table, { and, eq }) => and(
            eq(table.gangId, gangId),
            eq(table.permissionLevel, config.permission)
        )
    });

    let role = selectedRoleId
        ? guild.roles.cache.get(selectedRoleId)
        : config.preserveExistingMapping === false
        ? undefined
        : existingByPermission?.discordRoleId
        ? guild.roles.cache.get(existingByPermission.discordRoleId)
        : undefined;

    if (role && !isRoleAssignableByBot(role)) {
        if (selectedRoleId) {
            throw new SetupResourceError(
                'SETUP_ROLE_UNMANAGEABLE',
                `บอทยังจัดการยศ "${role.name}" ไม่ได้ กรุณาย้ายยศบอทให้อยู่สูงกว่ายศนี้ก่อน แล้วเลือกใหม่อีกครั้ง`
            );
        }

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

    if (selectedRoleId && !role) {
        throw new SetupResourceError(
            'SETUP_ROLE_NOT_FOUND',
            'ไม่พบยศ Discord ที่เลือก กรุณาเลือกยศสมาชิกแก๊งใหม่อีกครั้ง'
        );
    }

    if (selectedRoleId && role) {
        const existingByRole = await db.query.gangRoles.findFirst({
            where: (table, { and, eq }) => and(
                eq(table.gangId, gangId),
                eq(table.discordRoleId, role.id)
            )
        });

        if (existingByRole && existingByRole.permissionLevel !== config.permission) {
            throw new SetupResourceError(
                'SETUP_ROLE_CONFLICT',
                `ยศ "${role.name}" ถูกใช้กับงานอื่นของระบบอยู่แล้ว กรุณาเลือกยศสมาชิกแก๊งที่ไม่ซ้ำกับยศอื่น`
            );
        }
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
        role = AUTO_VISITOR_ROLE_NAMES
            .map((roleName) => findAssignableRoleByName(guild, roleName))
            .find(Boolean);

        if (!role) {
            const unmanageableVerifiedRole = guild.roles.cache.find((candidate: Role) => AUTO_VISITOR_ROLE_NAMES.includes(candidate.name));
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
                name: 'Visitor',
                colors: { primaryColor: '#95A5A6' },
                hoist: false,
                reason: 'Gang Manager setup - visitor role',
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
            `ยศ "${role.name}" ถูกใช้กับงานอื่นของระบบอยู่แล้ว กรุณาเลือกยศคนทั่วไปที่ไม่ใช่ยศสมาชิกแก๊ง`
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
registerButtonHandler('setup_member_auto:', handleSetupMemberAuto);
registerButtonHandler('setup_install_new_', handleSetupInstallNew);
registerButtonHandler('setup_install_existing_', handleSetupInstallExisting);
registerButtonHandler('setup_preflight_continue_', handleSetupPreflightContinue);
registerButtonHandler('setup_role_auto:', handleSetupRoleAuto);
registerButtonHandler('setup_channel_create:', handleSetupChannelCreate);
registerButtonHandler('setup_channel_none:', handleSetupChannelNone);
registerButtonHandler('setup_apply:', handleSetupApply);
registerButtonHandler('setup_cancel_', handleSetupCancel);

// Register Select Menu Handlers for Manual Flow
registerSelectMenuHandler('setup_verify_role', handleSetupVerifyRoleSelect);
registerSelectMenuHandler('setup_member_role:', handleSetupMemberRoleSelect);
registerSelectMenuHandler('setup_role_select:', handleSetupRoleWizardSelect);
registerSelectMenuHandler('setup_channel_select:', handleSetupChannelSelect);
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
        const hasGangPermission = await checkPermission(interaction, parsedTarget.gangId, ['OWNER']);
        if (!hasGangPermission) {
            logWarn('bot.setup.action_denied_by_gang_role', {
                guildId: interaction.guildId,
                gangId: parsedTarget.gangId,
                userDiscordId: interaction.user.id,
                customId: 'customId' in interaction ? interaction.customId : undefined,
            });
            return SETUP_GANG_OWNER_DENIED_MESSAGE;
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

        await interaction.reply({
            ...buildSetupModePrompt(existingGang.name, existingGang.id, { existingGang: true }),
            flags: MessageFlags.Ephemeral,
        });
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

        const trialInfo = resolvedTier === 'TRIAL'
            ? `\n🎁 **ทดลองใช้ฟรี ${TRIAL_DAYS} วัน** ถึง ${currentTrialExpiry?.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' })}`
            : '';
        await interaction.editReply(buildSetupModePrompt(gangName, targetCustomId, {
            existingGang: Boolean(gang),
            trialInfo,
            transferredInfo,
        }));

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
        const finalSettings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
            columns: {
                verifyChannelId: true,
                registerChannelId: true,
                announcementChannelId: true,
                websiteChannelId: true,
                attendanceChannelId: true,
                attendanceSummaryChannelId: true,
                leaveChannelId: true,
                approvedLeaveChannelId: true,
                financeChannelId: true,
                penaltyChannelId: true,
                requestsChannelId: true,
                adminPanelChannelId: true,
                logChannelId: true,
            },
        });
        const dashboardUrl = buildDashboardUrl(gangId, { guildId: interaction.guildId, gangId });
        const settingsUrl = `${dashboardUrl}/settings`;
        const setupChecklist = [
            ['รับยศคนทั่วไป', finalSettings?.verifyChannelId],
            ['สมัครเข้าแก๊ง', finalSettings?.registerChannelId],
            ['ประกาศ', finalSettings?.announcementChannelId],
            ['ลิงก์เว็บ', finalSettings?.websiteChannelId],
            ['เช็คชื่อ', finalSettings?.attendanceChannelId],
            ['สรุปเช็คชื่อ', finalSettings?.attendanceSummaryChannelId],
            ['แจ้งลา', finalSettings?.leaveChannelId],
            ['ห้องคนลา', finalSettings?.approvedLeaveChannelId],
            ['การเงิน', finalSettings?.financeChannelId],
            ['ค่าปรับ', finalSettings?.penaltyChannelId],
            ['คำขอ/อนุมัติ', finalSettings?.requestsChannelId],
            ['ห้องควบคุมหัวหน้าแก๊ง', finalSettings?.adminPanelChannelId],
            ['บันทึกระบบใน Discord', finalSettings?.logChannelId ?? 'DISABLED'],
        ].map(([label, channelId]) => {
            if (channelId === 'DISABLED') return `• ${label}: ไม่ส่งลง Discord`;
            return `• ${label}: ${channelId ? 'พร้อม' : 'ต้องตรวจเพิ่ม'}`;
        }).join('\n');

        const setupFields = [
            { name: '📋 สถานะ', value: normalizeSubscriptionTier(gang?.subscriptionTier) === 'PREMIUM' ? 'Premium' : normalizeSubscriptionTier(gang?.subscriptionTier) === 'TRIAL' ? 'Trial 7 วัน' : 'Free', inline: true },
            { name: '🎭 ระบบยศ', value: 'Owner ยึดจากเจ้าของเซิร์ฟเวอร์ Discord, ยศคนทั่วไปแยกจากยศสมาชิกแก๊งจริง และใช้ยศสมาชิกเดิมของเซิร์ฟได้', inline: true },
            { name: '📂 ห้องระบบ', value: 'สร้างเฉพาะห้องที่จำเป็น และใช้ห้องเดิมที่เลือกไว้ก่อน', inline: true },
            { name: '✅ Checklist หลังติดตั้ง', value: setupChecklist.slice(0, 1024) },
            { name: '🎯 แนะนำให้ทำต่อทันที', value: '1. เช็กห้อง Website / ลงทะเบียน / รับยศคนทั่วไป\n2. ถ้ามีห้องเดิม ให้เปิดเว็บไปเลือกห้องที่ใช้อยู่จริง\n3. ให้สมาชิกเริ่มเข้าระบบ และตรวจสมาชิก/เช็คชื่อ/การเงินบน Dashboard' },
            { name: '🛟 ถ้าปุ่มหรือข้อความระบบหาย', value: 'ใช้ปุ่มซ่อมห้องและยศจากห้องควบคุมได้ ระบบจะใช้ห้องเดิมที่เลือกไว้ก่อน ไม่ลบข้อความหรือประวัติแชทเก่า และไม่สร้างห้องแชทหรือห้องเสียงให้รกเซิร์ฟเวอร์' },
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
            .setDescription(`แก๊ง **${gang?.name}** พร้อมใช้งานทั้งใน Discord และหน้าเว็บแล้ว${setupTarget.transferredInfo}\nถ้าเซิร์ฟนี้มีห้องเดิมอยู่แล้ว แนะนำให้เข้าเว็บไปเลือกห้องปลายทางให้ตรงกับระบบจริงก่อนเริ่มใช้งาน`)
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

async function handleSetupInstallNew(interaction: ButtonInteraction) {
    const gangId = interaction.customId.replace('setup_install_new_', '');
    if (!await requireSetupActionAccess(interaction, { gangId })) {
        return;
    }

    await showSetupLoading(interaction, '⏳ กำลังติดตั้งชุดมาตรฐานสำหรับเซิร์ฟเวอร์ใหม่... กรุณารอสักครู่');
    await runAutoSetup(interaction, { gangId });
}

async function handleSetupInstallExisting(interaction: ButtonInteraction) {
    const gangId = interaction.customId.replace('setup_install_existing_', '');
    await showExistingSetupPreflight(interaction, gangId);
}

async function handleSetupPreflightContinue(interaction: ButtonInteraction) {
    const draftId = interaction.customId.replace('setup_preflight_continue_', '');
    const draft = getSetupWizardDraft(draftId, interaction);
    if (!draft) {
        await interaction.reply({ content: '❌ ขั้นตอน setup หมดอายุแล้ว กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }
    await showSetupRoleStep(interaction, draft);
}

async function handleSetupRoleWizardSelect(interaction: AnySelectMenuInteraction) {
    const [, draftId, permission] = interaction.customId.split(':');
    const draft = getSetupWizardDraft(draftId, interaction);
    if (!draft || !permission) {
        await interaction.reply({ content: '❌ ขั้นตอนเลือกยศหมดอายุแล้ว กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }

    const setupPermission = permission as InternalSetupPermission;
    const selectedRoleId = interaction.values[0];
    const validationError = validateSetupRoleWizardSelection(interaction, draft, setupPermission, selectedRoleId);
    if (validationError) {
        await showSetupRoleStep(interaction, draft, validationError);
        return;
    }

    draft.roleSelections[setupPermission] = selectedRoleId;
    await showSetupRoleStep(interaction, draft);
}

async function handleSetupRoleAuto(interaction: ButtonInteraction) {
    const [, draftId, permission] = interaction.customId.split(':');
    const draft = getSetupWizardDraft(draftId, interaction);
    if (!draft || !permission) {
        await interaction.reply({ content: '❌ ขั้นตอนเลือกยศหมดอายุแล้ว กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }

    draft.roleSelections[permission as InternalSetupPermission] = null;
    await showSetupRoleStep(interaction, draft);
}

function validateSelectedSetupChannel(interaction: AnySelectMenuInteraction, selectedChannelId: string) {
    const guild = interaction.guild;
    const botMember = guild?.members.me;
    const channel = guild?.channels.cache.get(selectedChannelId);
    if (!guild || !botMember || !channel) {
        return 'ไม่พบห้องที่เลือก กรุณาเลือกใหม่อีกครั้ง';
    }
    if (channel.type !== ChannelType.GuildText) {
        return 'ใช้ได้เฉพาะห้องข้อความเท่านั้น';
    }
    if (!hasBotManagedChannelAccess(channel, botMember)) {
        return 'บอทยังส่งข้อความในห้องนี้ไม่ได้ กรุณาเปิดสิทธิ์ให้บอทมองเห็นห้อง ส่งข้อความ ส่ง Embed และอ่านข้อความย้อนหลังได้ก่อนเลือกห้องนี้';
    }
    return null;
}

async function handleSetupChannelSelect(interaction: AnySelectMenuInteraction) {
    const [, draftId, channelKey] = interaction.customId.split(':');
    const draft = getSetupWizardDraft(draftId, interaction);
    if (!draft || !channelKey) {
        await interaction.reply({ content: '❌ ขั้นตอนเลือกห้องหมดอายุแล้ว กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }

    const selectedChannelId = interaction.values[0];
    const validationError = validateSelectedSetupChannel(interaction, selectedChannelId);
    if (validationError) {
        await showSetupChannelStep(interaction, draft, validationError);
        return;
    }

    draft.channelSelections[channelKey as SetupChannelKey] = selectedChannelId;
    await showSetupChannelStep(interaction, draft);
}

async function handleSetupChannelCreate(interaction: ButtonInteraction) {
    const [, draftId, channelKey] = interaction.customId.split(':');
    const draft = getSetupWizardDraft(draftId, interaction);
    if (!draft || !channelKey) {
        await interaction.reply({ content: '❌ ขั้นตอนเลือกห้องหมดอายุแล้ว กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }

    draft.channelSelections[channelKey as SetupChannelKey] = 'CREATE';
    await showSetupChannelStep(interaction, draft);
}

async function handleSetupChannelNone(interaction: ButtonInteraction) {
    const [, draftId, channelKey] = interaction.customId.split(':');
    const draft = getSetupWizardDraft(draftId, interaction);
    const step = SETUP_CHANNEL_STEPS.find(item => item.key === channelKey);
    if (!draft || !channelKey || !step?.allowNone) {
        await interaction.reply({ content: '❌ ตัวเลือกนี้ใช้กับห้องนี้ไม่ได้ กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }

    draft.channelSelections[channelKey as SetupChannelKey] = null;
    await showSetupChannelStep(interaction, draft);
}

async function handleSetupApply(interaction: ButtonInteraction) {
    const draftId = interaction.customId.replace('setup_apply:', '');
    const draft = getSetupWizardDraft(draftId, interaction);
    if (!draft) {
        await interaction.reply({ content: '❌ ขั้นตอน setup หมดอายุแล้ว กรุณาพิมพ์ `/setup` ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }
    if (!await requireSetupActionAccess(interaction, { gangId: draft.gangId })) {
        return;
    }

    await showSetupLoading(interaction, '⏳ กำลังติดตั้ง/อัปเดตตามหน้าสรุป... ระบบจะสร้างเฉพาะสิ่งที่เลือกไว้');
    await runAutoSetup(interaction, { gangId: draft.gangId }, {
        roleSelections: draft.roleSelections,
        channelSelections: draft.channelSelections,
    });
    setupWizardDrafts.delete(draft.id);
}

async function handleSetupCancel(interaction: ButtonInteraction) {
    const draftId = interaction.customId.replace('setup_cancel_', '');
    setupWizardDrafts.delete(draftId);
    await updateSetupInteraction(interaction, {
        content: 'ยกเลิกขั้นตอน setup แล้ว ยังไม่มีการสร้างห้อง ส่งข้อความลง Discord หรือแก้ยศจากขั้นตอนนี้',
        embeds: [],
        components: [],
    });
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

    if (parsedTarget.gangId) {
        await showExistingSetupPreflight(interaction, parsedTarget.gangId);
        return;
    }

    await showSetupLoading(interaction, '⏳ กำลังติดตั้งด้วยยศคนทั่วไปอัตโนมัติ... กรุณารอสักครู่');
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

    if (parsedTarget.gangId && prefix === 'setup_verify_select_') {
        await showExistingSetupPreflight(interaction, parsedTarget.gangId);
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

    await askForMemberRole(interaction, targetId, selectedRoleId);
}

function parseMemberRoleTarget(customId: string, prefix: 'setup_member_role:' | 'setup_member_auto:') {
    const payload = customId.replace(prefix, '');
    const [targetId, visitorRoleId] = payload.split(':');
    if (!targetId || !visitorRoleId) {
        return null;
    }

    return {
        targetId,
        visitorRoleId,
        parsedTarget: targetId.startsWith('pending_')
            ? { pendingId: targetId.replace('pending_', '') }
            : { gangId: targetId },
    };
}

async function handleSetupMemberRoleSelect(interaction: AnySelectMenuInteraction) {
    const target = parseMemberRoleTarget(interaction.customId, 'setup_member_role:');
    if (!target) {
        await interaction.reply({ content: '❌ ข้อมูลยศสมาชิกไม่ครบ กรุณาใช้ /setup ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }

    if (!await requireSetupActionAccess(interaction, target.parsedTarget)) {
        return;
    }

    const selectedMemberRoleId = interaction.values[0];
    const validationError = validateMemberRoleSelection(interaction, selectedMemberRoleId, target.visitorRoleId);
    if (validationError) {
        await askForMemberRole(interaction, target.targetId, target.visitorRoleId, validationError);
        return;
    }

    await interaction.deferUpdate();
    await showSetupLoading(interaction, '⏳ กำลังติดตั้งด้วยยศคนทั่วไปและยศสมาชิกแก๊งที่เลือก... กรุณารอสักครู่');
    await runAutoSetup(interaction, target.parsedTarget, {
        verifiedRoleId: target.visitorRoleId,
        memberRoleId: selectedMemberRoleId,
    });
}

async function handleSetupMemberAuto(interaction: ButtonInteraction) {
    const target = parseMemberRoleTarget(interaction.customId, 'setup_member_auto:');
    if (!target) {
        await interaction.reply({ content: '❌ ข้อมูลยศสมาชิกไม่ครบ กรุณาใช้ /setup ใหม่อีกครั้ง', flags: MessageFlags.Ephemeral });
        return;
    }

    if (!await requireSetupActionAccess(interaction, target.parsedTarget)) {
        return;
    }

    await showSetupLoading(interaction, '⏳ กำลังติดตั้งและสร้าง/ใช้ยศสมาชิกแก๊งอัตโนมัติ... กรุณารอสักครู่');
    await runAutoSetup(interaction, target.parsedTarget, {
        verifiedRoleId: target.visitorRoleId,
    });
}

// --- 5. Legacy Manual Role Selection Guard ---
async function handleSetupRoleSelect(interaction: AnySelectMenuInteraction) {
    await interaction.deferUpdate();
    await interaction.editReply({
        content: '⚠️ โหมดเชื่อมยศแก๊งแบบเก่าถูกยกเลิกแล้ว กรุณาใช้ `/setup` ใหม่ ระบบจะให้เลือกยศคนทั่วไปและยศสมาชิกแก๊งตามลำดับ',
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
        return 'ห้ามใช้ @everyone เป็นยศของระบบแก๊ง เพราะจะทำให้ทุกคนในเซิร์ฟได้รับสิทธิ์ทันที';
    }

    const role = guild.roles.cache.get(selectedRoleId);
    if (!role) {
        return 'ไม่พบยศที่เลือก กรุณาเลือกยศใหม่อีกครั้ง';
    }

    if (role.managed) {
        return 'ยศนี้เป็นยศที่ Discord หรือ integration จัดการให้อัตโนมัติ กรุณาเลือกยศปกติของเซิร์ฟเวอร์';
    }

    if (role.editable === false) {
        return 'บอทยังให้หรือถอนยศนี้ไม่ได้ เพราะยศนี้อยู่สูงกว่าบอท หรือบอทยังไม่มีสิทธิ์จัดการยศ กรุณาย้ายยศบอทให้อยู่สูงกว่ายศนี้ก่อน';
    }

    return null;
}

function validateMemberRoleSelection(
    interaction: AnySelectMenuInteraction,
    selectedRoleId: string,
    visitorRoleId: string
) {
    const baseError = validateVerifiedRoleSelection(interaction, selectedRoleId);
    if (baseError) {
        return baseError
            .replace('ยศของระบบแก๊ง', 'ยศสมาชิกแก๊ง')
            .replace('ยศปกติของเซิร์ฟเวอร์', 'ยศสมาชิกแก๊งที่เป็นยศปกติของเซิร์ฟเวอร์');
    }

    if (selectedRoleId === visitorRoleId) {
        return 'ยศสมาชิกแก๊งต้องคนละยศกับยศคนทั่วไป เพื่อไม่ให้คนที่ยังไม่ได้สมัครเห็นห้องและสิทธิ์ของสมาชิกแก๊ง';
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

async function askForMemberRole(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    targetId: string,
    visitorRoleId: string,
    warning?: string
) {
    const payload = buildMemberRolePrompt(interaction, targetId, visitorRoleId, warning);
    if ('deferUpdate' in interaction && !interaction.deferred && !interaction.replied) {
        await interaction.deferUpdate();
    }
    await interaction.editReply(payload);
}

function buildVerifiedRolePrompt(targetId: string, warning?: string) {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('🎭 เลือกยศคนทั่วไปในเซิร์ฟ')
        .setDescription(
            'เลือกยศเดิมของเซิร์ฟสำหรับคนที่อยู่ใน Discord แต่ยังไม่ได้เป็นสมาชิกแก๊ง เช่น ประชาชน, ผู้เล่นทั่วไป หรือยศที่ได้หลังพิมพ์จุด\n' +
            'ยศนี้ใช้เปิดห้องพื้นฐานหรือเล่นเกมอื่นกับเซิร์ฟเท่านั้น ไม่ใช่ยศสมาชิกแก๊ง และจะยังไม่เห็นห้องสมาชิกจนกว่าจะสมัครและได้รับอนุมัติ'
        );

    if (warning) {
        embed.addFields({ name: '⚠️ ยังบันทึกไม่ได้', value: warning });
    }

    const select = new RoleSelectMenuBuilder()
        .setCustomId(`setup_verify_role_${targetId}`)
        .setPlaceholder('เลือกยศคนทั่วไปในเซิร์ฟ')
        .setMinValues(1)
        .setMaxValues(1);

    const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);

    return { embeds: [embed], components: [row] };
}

function buildMemberRolePrompt(
    interaction: ButtonInteraction | AnySelectMenuInteraction,
    targetId: string,
    visitorRoleId: string,
    warning?: string
) {
    const visitorRole = interaction.guild?.roles.cache.get(visitorRoleId);
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('🛡️ เลือกยศสมาชิกแก๊ง')
        .setDescription(
            'เลือกยศที่คนซึ่งผ่านอนุมัติเป็นสมาชิกแก๊งจริงควรได้รับ เช่น BIDROI, BITROI, Gang Member หรือชื่อแก๊งของคุณ\n' +
            'ถ้าเซิร์ฟมียศสมาชิกอยู่แล้ว ให้เลือกยศเดิมได้เลย ระบบจะไม่บังคับสร้าง Gang Member ใหม่'
        )
        .addFields(
            {
                name: 'ยศคนทั่วไปที่เลือกไว้',
                value: visitorRole ? `${visitorRole.name} — ใช้สำหรับคนที่ยังไม่ได้เป็นสมาชิกแก๊ง` : 'เลือกไว้แล้ว แต่บอทอ่านชื่อยศไม่ได้ชั่วคราว',
            },
            {
                name: 'กฎสำคัญ',
                value: 'ยศสมาชิกแก๊งต้องไม่ซ้ำกับยศคนทั่วไป และบอทต้องอยู่สูงกว่ายศนี้ใน Discord เพื่อให้/ถอนยศได้',
            }
        );

    if (warning) {
        embed.addFields({ name: '⚠️ ยังบันทึกไม่ได้', value: warning });
    }

    const select = new RoleSelectMenuBuilder()
        .setCustomId(`setup_member_role:${targetId}:${visitorRoleId}`)
        .setPlaceholder('เลือกยศสมาชิกแก๊งที่มีอยู่แล้ว')
        .setMinValues(1)
        .setMaxValues(1);

    const selectRow = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(select);
    const buttonRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`setup_member_auto:${targetId}:${visitorRoleId}`)
            .setLabel('สร้าง/ใช้ Gang Member อัตโนมัติ')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [selectRow, buttonRow] };
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
            'บอทยังไม่มีสิทธิ์จัดการยศหรือจัดการห้อง กรุณาเปิดสิทธิ์ให้บอทก่อน แล้วค่อยกดติดตั้ง/ซ่อมแซมอีกครั้ง'
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
    const roleConfig: SetupRoleConfig[] = ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER']
        .map(permission => getDefaultSetupRoleConfig(permission as InternalSetupPermission))
        .filter((config): config is SetupRoleConfig => Boolean(config));
    const selectedRoleFor = (permission: InternalSetupPermission) => {
        if (options.roleSelections && permission in options.roleSelections) {
            return options.roleSelections[permission];
        }
        if (permission === 'VERIFIED') return options.verifiedRoleId;
        if (permission === 'MEMBER') return options.memberRoleId;
        return null;
    };

    const verifiedRole = await ensureVerifiedRoleMapping(guild, gangId, selectedRoleFor('VERIFIED'));

    // Keep the visitor role near the bottom (above @everyone) so it never outranks gang roles.
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
        createdRoles[config.permission] = await ensureSetupRoleMapping(
            guild,
            gangId,
            config,
            selectedRoleFor(config.permission)
        );
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

    let infoCategory: CategoryChannel | null = null;
    let attendanceCategory: CategoryChannel | null = null;
    let financeCategory: CategoryChannel | null = null;
    let adminCategory: CategoryChannel | null = null;
    const getInfoCategory = async () => {
        if (!infoCategory) infoCategory = await ensureCategory('📌 ข้อมูลทั่วไป');
        return infoCategory;
    };
    const getAttendanceCategory = async () => {
        if (!attendanceCategory) attendanceCategory = await ensureCategory('⏰ ระบบเช็คชื่อ');
        return attendanceCategory;
    };
    const getFinanceCategory = async () => {
        if (!financeCategory) financeCategory = await ensureCategory('💰 ระบบการเงิน');
        return financeCategory;
    };
    const adminOnlyPerms = withBotManagedChannelAccess(botMember.id, [
        { id: guild.id, deny: ['ViewChannel'] },
        { id: guild.ownerId, allow: ['ViewChannel'] },
        { id: createdRoles['OWNER'].id, allow: ['ViewChannel'] },
        { id: createdRoles['ADMIN'].id, allow: ['ViewChannel'] }
    ]);
    const getAdminCategory = async () => {
        if (adminCategory) return adminCategory;
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
                    'สร้างหมวดหัวแก๊งไม่สำเร็จ กรุณาตรวจว่าบอทมีสิทธิ์จัดการห้อง และยศของบอทอยู่สูงพอ'
                );
            }
        }
        return adminCategory;
    };

    const ensureChannel = async (
        name: string,
        parentFactory: () => Promise<CategoryChannel>,
        options: any = {},
        existingChannelId?: string | null,
        forceCreate = false
    ) => {
        try {
            const channelType = options.type || ChannelType.GuildText;
            let existing = !forceCreate && existingChannelId ? guild.channels.cache.get(existingChannelId) : null;
            let preserveExistingChannel = Boolean(!forceCreate && existingChannelId && existing);
            const aliases = SETUP_CHANNEL_ALIASES[name] || [];
            const matchesManagedName = (channelName?: string | null) => Boolean(channelName && [name, ...aliases].includes(channelName));
            let parentId: string | null = null;
            const getParentId = async () => {
                if (parentId) return parentId;
                parentId = (await parentFactory()).id;
                return parentId;
            };

            if (existing && existing.type !== channelType) {
                existing = null;
                preserveExistingChannel = false;
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
                preserveExistingChannel = false;
            }

            if (existing && preserveExistingChannel) {
                if (!hasBotManagedChannelAccess(existing, botMember)) {
                    logWarn('bot.setup.mapped_channel_missing_bot_send_access', {
                        guildId: guild.id,
                        gangId,
                        channelName: name,
                        channelId: existing.id,
                    });
                }
                logInfo('bot.setup.mapped_channel_preserved', {
                    guildId: guild.id,
                    gangId,
                    channelName: name,
                    channelId: existing.id,
                    currentName: existing.name,
                    parentId: existing.parentId,
                });
                return existing;
            }

            const resolvedParentId = await getParentId();
            const matchingChannels = forceCreate
                ? []
                : guild.channels.cache
                    .filter(c => matchesManagedName(c.name) && c.type === channelType)
                    .map(c => c);
            const pickAccessibleChannel = (candidates: typeof matchingChannels) => {
                return candidates.find(candidate => hasBotManagedChannelView(candidate, botMember)) ?? null;
            };

            if (!existing) {
                // 1. Check if channel already exists under the target parent
                existing = pickAccessibleChannel(matchingChannels.filter(c => c.parentId === resolvedParentId));
            }

            if (!existing && matchingChannels.length > 0) {
                const underManagedCategory = matchingChannels.filter(c => c.parentId === resolvedParentId);
                const outsideManagedCategory = matchingChannels.filter(c => c.parentId !== resolvedParentId);
                if (underManagedCategory.length > 0) {
                    logWarn('bot.setup.channel_inaccessible_replacing', {
                        guildId: guild.id,
                        gangId,
                        channelName: name,
                        candidateCount: underManagedCategory.length,
                        source: 'managed_category_search',
                    });
                }
                if (outsideManagedCategory.length > 0) {
                    logInfo('bot.setup.existing_named_channel_skipped_without_mapping', {
                        guildId: guild.id,
                        gangId,
                        channelName: name,
                        candidateCount: outsideManagedCategory.length,
                    });
                }
            }

            if (existing) {
                let shouldReplaceExisting = false;
                // Move the existing channel to the new parent category if needed.
                if (existing.parentId !== resolvedParentId && 'setParent' in existing) {
                    try {
                        existing = await (existing as TextChannel).setParent(resolvedParentId, { lockPermissions: false });
                        logInfo('bot.setup.channel_moved', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            parentId: resolvedParentId,
                        });
                    } catch (error) {
                        logWarn('bot.setup.channel_move_failed', {
                            guildId: guild.id,
                            gangId,
                            channelName: name,
                            parentId: resolvedParentId,
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

            return await guild.channels.create({ name, parent: resolvedParentId, type: ChannelType.GuildText, ...options });
        } catch (error) {
            logError('bot.setup.channel_ensure_failed', error, {
                guildId: guild.id,
                gangId,
                channelName: name,
            });
            throw new SetupResourceError(
                'CHANNEL_CREATE_FAILED',
                `สร้างหรือซ่อมห้อง "${name}" ไม่สำเร็จ กรุณาตรวจว่าบอทมีสิทธิ์จัดการห้อง แล้วลองอีกครั้ง`
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
    const channelDecision = (key: SetupChannelKey): SetupChannelDecision | undefined => {
        if (options.channelSelections && key in options.channelSelections) {
            return options.channelSelections[key];
        }
        return (existingSettings as any)?.[key] ?? undefined;
    };
    const selectedChannelId = (key: SetupChannelKey) => {
        const decision = channelDecision(key);
        return decision && decision !== 'CREATE' ? decision : undefined;
    };
    const shouldForceCreateChannel = (key: SetupChannelKey) => channelDecision(key) === 'CREATE';
    const shouldSkipChannel = (key: SetupChannelKey) => channelDecision(key) === null;

    const verifyChannel = shouldSkipChannel('verifyChannelId')
        ? null
        : await ensureChannel('ยืนยันตัวตน', getInfoCategory, { permissionOverwrites: verifyPerms }, selectedChannelId('verifyChannelId'), shouldForceCreateChannel('verifyChannelId'));
    const registerChannel = shouldSkipChannel('registerChannelId')
        ? null
        : await ensureChannel('ลงทะเบียน', getInfoCategory, { permissionOverwrites: registerPerms }, selectedChannelId('registerChannelId'), shouldForceCreateChannel('registerChannelId'));
    const announcementChannel = shouldSkipChannel('announcementChannelId')
        ? null
        : await ensureChannel('ประกาศ', getInfoCategory, { permissionOverwrites: readOnlyEveryone }, selectedChannelId('announcementChannelId'), shouldForceCreateChannel('announcementChannelId')); // Visible to all
    const websiteChannel = shouldSkipChannel('websiteChannelId')
        ? null
        : await ensureChannel('Website', getInfoCategory, { permissionOverwrites: readOnlyEveryone }, selectedChannelId('websiteChannelId'), shouldForceCreateChannel('websiteChannelId'));

    // === ⏰ ระบบเช็คชื่อ (Members Only) ===
    const attendanceChannel = shouldSkipChannel('attendanceChannelId')
        ? null
        : await ensureChannel('เช็คชื่อ', getAttendanceCategory, { permissionOverwrites: membersOnlyReadOnly }, selectedChannelId('attendanceChannelId'), shouldForceCreateChannel('attendanceChannelId'));
    const attendanceSummaryChannel = shouldSkipChannel('attendanceSummaryChannelId')
        ? null
        : await ensureChannel('สรุปเช็คชื่อ', getAttendanceCategory, { permissionOverwrites: membersOnlyReadOnly }, selectedChannelId('attendanceSummaryChannelId'), shouldForceCreateChannel('attendanceSummaryChannelId'));
    const leaveChannel = shouldSkipChannel('leaveChannelId')
        ? null
        : await ensureChannel('แจ้งลา', getAttendanceCategory, { permissionOverwrites: membersOnlyWritable }, selectedChannelId('leaveChannelId'), shouldForceCreateChannel('leaveChannelId'));
    const approvedLeaveChannel = shouldSkipChannel('approvedLeaveChannelId')
        ? null
        : await ensureChannel('ห้องคนลา', getAttendanceCategory, { permissionOverwrites: membersOnlyReadOnly }, selectedChannelId('approvedLeaveChannelId'), shouldForceCreateChannel('approvedLeaveChannelId'));

    // === 💰 ระบบการเงิน (Members Only) ===
    const financeChannel = shouldSkipChannel('financeChannelId')
        ? null
        : await ensureChannel('แจ้งธุรกรรม', getFinanceCategory, { permissionOverwrites: membersOnlyWritable }, selectedChannelId('financeChannelId'), shouldForceCreateChannel('financeChannelId'));
    const penaltyChannel = shouldSkipChannel('penaltyChannelId')
        ? null
        : await ensureChannel('ค่าปรับ', getFinanceCategory, { permissionOverwrites: membersOnlyReadOnly }, selectedChannelId('penaltyChannelId'), shouldForceCreateChannel('penaltyChannelId'));

    // === 🔒 หัวแก๊ง (Admin Only - already set at category level) ===
    const adminPanelChannel = shouldSkipChannel('adminPanelChannelId')
        ? null
        : await ensureChannel('แผงควบคุม', getAdminCategory, { permissionOverwrites: adminOnlyPerms }, selectedChannelId('adminPanelChannelId'), shouldForceCreateChannel('adminPanelChannelId'));
    const logChannel = shouldSkipChannel('logChannelId')
        ? null
        : await ensureChannel('log-ระบบ', getAdminCategory, { permissionOverwrites: adminOnlyPerms }, selectedChannelId('logChannelId'), shouldForceCreateChannel('logChannelId'));
    const requestsChannel = shouldSkipChannel('requestsChannelId')
        ? null
        : await ensureChannel('📋-คำขอและอนุมัติ', getAdminCategory, { permissionOverwrites: adminOnlyPerms }, selectedChannelId('requestsChannelId'), shouldForceCreateChannel('requestsChannelId')); // New Request Channel for both Join & Leave

    const requiredChannelChecks = [
        ['ยืนยันตัวตน', verifyChannel],
        ['ลงทะเบียน', registerChannel],
        ['ประกาศ', announcementChannel],
        ['Website', websiteChannel],
        ['เช็คชื่อ', attendanceChannel],
        ['สรุปเช็คชื่อ', attendanceSummaryChannel],
        ['แจ้งลา', leaveChannel],
        ['ห้องคนลา', approvedLeaveChannel],
        ['แจ้งธุรกรรม', financeChannel],
        ['ค่าปรับ', penaltyChannel],
        ['แผงควบคุม', adminPanelChannel],
        shouldSkipChannel('logChannelId') ? null : ['log-ระบบ', logChannel],
        ['📋-คำขอและอนุมัติ', requestsChannel],
    ].filter(Boolean) as Array<[string, unknown]>;
    const missingChannels = requiredChannelChecks.filter(([, channel]) => !channel);

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
        ['ห้องคนลา', approvedLeaveChannel],
        ['แจ้งธุรกรรม', financeChannel],
        ['ค่าปรับ', penaltyChannel],
        ['ยืนยันตัวตน', verifyChannel],
        ['ลงทะเบียน', registerChannel],
        ['แผงควบคุม', adminPanelChannel],
        ['สรุปเช็คชื่อ', attendanceSummaryChannel],
        ['คำขอและอนุมัติ', requestsChannel],
    ].filter(([, channel]) => channel && !hasBotManagedChannelAccess(channel as TextChannel, botMember));

    if (channelsMissingBotAccess.length > 0) {
        throw new SetupResourceError(
            'REQUIRED_CHANNELS_INACCESSIBLE',
            `ติดตั้งไม่ครบ เพราะบอทยังส่งข้อความในห้อง ${channelsMissingBotAccess.map(([name]) => `"${name}"`).join(', ')} ไม่ได้ กรุณาเปิดสิทธิ์ให้บอทในห้องนั้น หรือเลือกห้องอื่นแล้วกดซ่อมแซมอีกครั้ง`
        );
    }

    // Capture IDs, handling potential nulls
    const updates: any = {};
    if (verifyChannel) updates.verifyChannelId = verifyChannel.id;
    if (registerChannel) updates.registerChannelId = registerChannel.id;
    if (attendanceChannel) updates.attendanceChannelId = attendanceChannel.id;
    if (attendanceSummaryChannel) updates.attendanceSummaryChannelId = attendanceSummaryChannel.id;
    if (financeChannel) updates.financeChannelId = financeChannel.id;
    if (penaltyChannel) updates.penaltyChannelId = penaltyChannel.id;
    if (logChannel) updates.logChannelId = logChannel.id;
    if (shouldSkipChannel('logChannelId')) updates.logChannelId = null;
    if (requestsChannel) updates.requestsChannelId = requestsChannel.id;
    if (announcementChannel) updates.announcementChannelId = announcementChannel.id;
    if (leaveChannel) updates.leaveChannelId = leaveChannel.id;
    if (approvedLeaveChannel) updates.approvedLeaveChannelId = approvedLeaveChannel.id;
    if (websiteChannel) updates.websiteChannelId = websiteChannel.id;
    if (adminPanelChannel) updates.adminPanelChannelId = adminPanelChannel.id;

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
        columns: { balance: true, name: true },
    });

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
              .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
              .setCustomId('finance_request_repay')
              .setLabel('🏦 ชำระหนี้ยืม')
              .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
              .setCustomId('finance_request_deposit')
              .setLabel('📥 จ่ายยอดเก็บ/ฝากเครดิต')
              .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
              .setCustomId('finance_balance')
              .setLabel('💳 สถานะการเงิน')
              .setStyle(ButtonStyle.Secondary),
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

            const newMessage = await (financeChannel as TextChannel).send({ embeds: [financeEmbed], components: [financeRow] });

            await db.update(gangSettings)
                .set({ financeMessageId: newMessage.id, financeChannelId: financeChannel.id })
                .where(eq(gangSettings.gangId, gangId));
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
                .setTitle('✅ รับยศคนทั่วไปก่อนใช้งาน')
                .setDescription(
                    'สมาชิกใหม่และผู้เข้ามาใหม่เริ่มจากข้อความนี้ก่อน\n\n' +
                    'หลังจากกดแล้วคุณจะได้รับยศคนทั่วไป เพื่อเห็นห้องพื้นฐานที่แอดมินเปิดไว้\n' +
                    'ขั้นตอนนี้ยังไม่ใช่การเป็นสมาชิกแก๊ง ถ้าต้องการเข้าร่วมแก๊งต่อ ให้ไปกดในห้อง **ลงทะเบียน**'
                )
                .addFields(
                    { name: 'ลำดับที่แนะนำ', value: '1. รับยศคนทั่วไป\n2. อ่านกฎ/ประกาศ\n3. ไปที่ห้องลงทะเบียนเพื่อสมัครเข้าแก๊ง' }
                )
                .setFooter({ text: 'Gang Manager' });

            const verifyRow = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('verify_member')
                        .setLabel('✅ รับยศคนทั่วไป')
                        .setStyle(ButtonStyle.Success)
                );

            const msgs = await (verifyChannel as TextChannel).messages.fetch({ limit: 25 }).catch(() => null);
            const oldVerify = msgs?.find(m =>
                m.author.id === interaction.client.user.id &&
                (m.embeds[0]?.title?.includes('ยืนยันตัวตน') || m.embeds[0]?.title?.includes('ยศคนทั่วไป') || m.embeds[0]?.title?.includes('ยศคนนอกแก๊ง'))
            );
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
        .setDescription('ใช้ข้อความนี้สำหรับส่งคำขอเข้าแก๊งจริง หลังจากได้รับยศคนทั่วไปแล้ว')
        .addFields(
            { name: 'ทำอย่างไร', value: '1. กดปุ่ม "สมัครเข้าแก๊ง"\n2. กรอกชื่อในแก๊งของคุณ\n3. รอหัวหน้า/แอดมินอนุมัติและรับยศสมาชิกแก๊ง' },
            { name: 'หลังจากอนุมัติแล้ว', value: 'คุณจะเริ่มใช้งานเช็คชื่อ, แจ้งลา, การเงิน และ Dashboard ได้ทันที' }
        );

    const button = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(new ButtonBuilder().setCustomId('register').setLabel('📝 สมัครเข้าแก๊ง').setStyle(ButtonStyle.Primary));

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
        columns: { adminPanelMessageId: true, adminPanelChannelId: true, logChannelId: true, requestsChannelId: true }
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

    const dashboardUrl = buildDashboardUrl(gangId, { guildId: interaction.guildId, gangId });
    const settingsUrl = `${dashboardUrl}/settings`;
    const financeUrl = `${dashboardUrl}/finance`;

    const embed = new EmbedBuilder()
        .setColor(0x2B2D31)
        .setTitle('🎛️ ศูนย์ควบคุมหัวหน้าแก๊ง')
        .setDescription('ใช้ข้อความนี้เป็นจุดรวมงานหลักของหัวหน้าแก๊งและแอดมิน\nทั้งงานด่วนใน Discord และงานละเอียดบนหน้าเว็บ')
        .addFields(
            { name: 'ทำอะไรได้ทันทีจากตรงนี้', value: '• เปิด Dashboard เพื่อจัดการสมาชิกและตั้งค่า\n• บันทึกรายรับ/รายจ่ายแบบด่วน\n• ซ่อมห้อง/ยศเมื่อมีคนลบหรือย้าย' },
            { name: 'ถ้าปุ่มหรือข้อความระบบหาย', value: 'กดปุ่มซ่อมห้องและยศได้เลย ระบบจะใช้ห้องเดิมที่เลือกไว้ก่อน และไม่ลบข้อความหรือประวัติแชทเก่า' }
        )
        .setFooter({ text: 'ถ้าข้อความนี้หาย ให้ใช้ /setup เพื่อสร้างแผงควบคุมใหม่' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setLabel('🌐 Dashboard').setStyle(ButtonStyle.Link).setURL(dashboardUrl),
        new ButtonBuilder().setLabel('⚙️ ตั้งค่าเว็บ').setStyle(ButtonStyle.Link).setURL(settingsUrl),
        new ButtonBuilder().setLabel('💰 การเงินบนเว็บ').setStyle(ButtonStyle.Link).setURL(financeUrl)
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`setup_install_existing_${gangId}`).setLabel('🔄 ตรวจและอัปเดต Setup').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('admin_income').setLabel('💰 รายรับด่วน').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('admin_expense').setLabel('💸 รายจ่ายด่วน').setStyle(ButtonStyle.Danger)
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

export { handleSetupStart, handleSetupModalSubmit, handleSetupModeAuto, handleSetupVerifyAuto, handleSetupModeManual, handleSetupInstallExisting, handleSetupInstallNew, handleSetupMemberAuto, handleSetupMemberRoleSelect, handleSetupVerifyRoleSelect, handleSetupRoleSelect, isManagedLeavePanelMessage, sendAdminPanel };
