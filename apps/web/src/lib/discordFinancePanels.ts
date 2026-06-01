import { eq } from 'drizzle-orm';
import { db, gangs, gangSettings } from '@gang/database';
import { logWarn } from '@/lib/logger';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const DEFAULT_PUBLIC_WEB_URL = 'https://gang-manager.vercel.app';

type DiscordComponent = Record<string, unknown>;
type DiscordMessage = {
    id: string;
    author?: { bot?: boolean };
    embeds?: Array<{ title?: string | null }>;
};
type DiscordChannel = {
    id: string;
    name?: string | null;
    type?: number;
};

function normalizePublicWebUrl(value: string) {
    return value.replace(/\/+$/, '');
}

function getPublicWebUrl() {
    const explicitUrl = process.env.PUBLIC_WEB_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;
    if (explicitUrl) {
        return normalizePublicWebUrl(explicitUrl);
    }

    if (process.env.VERCEL_URL) {
        return normalizePublicWebUrl(`https://${process.env.VERCEL_URL}`);
    }

    return DEFAULT_PUBLIC_WEB_URL;
}

export function buildFinancePanelComponents(): DiscordComponent[] {
    return [
        {
            type: 1,
            components: [
                { type: 2, style: 1, custom_id: 'finance_request_loan', label: '💸 ยืมเงิน' },
                { type: 2, style: 3, custom_id: 'finance_request_repay', label: '🏦 ชำระหนี้ยืม' },
                { type: 2, style: 2, custom_id: 'finance_request_deposit', label: '📥 จ่ายยอดเก็บ/ฝากเครดิต' },
                { type: 2, style: 2, custom_id: 'finance_balance', label: '💳 สถานะการเงิน' },
            ],
        },
    ];
}

export function buildAdminPanelComponents(gangId: string): DiscordComponent[] {
    const dashboardUrl = `${getPublicWebUrl()}/dashboard/${gangId}`;

    return [
        {
            type: 1,
            components: [
                { type: 2, style: 5, label: '🌐 Dashboard', url: dashboardUrl },
                { type: 2, style: 5, label: '⚙️ ตั้งค่าเว็บ', url: `${dashboardUrl}/settings` },
                { type: 2, style: 5, label: '💰 การเงินบนเว็บ', url: `${dashboardUrl}/finance` },
            ],
        },
        {
            type: 1,
            components: [
                { type: 2, style: 2, custom_id: `setup_install_existing_${gangId}`, label: '🔄 ตรวจและอัปเดต Setup' },
                { type: 2, style: 3, custom_id: 'admin_income', label: '💰 รายรับด่วน' },
                { type: 2, style: 4, custom_id: 'admin_expense', label: '💸 รายจ่ายด่วน' },
            ],
        },
    ];
}

async function discordRequest(
    token: string,
    path: string,
    init?: RequestInit
) {
    return fetch(`${DISCORD_API_BASE}${path}`, {
        ...init,
        headers: {
            Authorization: `Bot ${token}`,
            'Content-Type': 'application/json',
            ...(init?.headers || {}),
        },
    });
}

async function patchMessageComponents(input: {
    token: string;
    channelId: string;
    messageId: string;
    components: DiscordComponent[];
}) {
    const response = await discordRequest(
        input.token,
        `/channels/${input.channelId}/messages/${input.messageId}`,
        {
            method: 'PATCH',
            body: JSON.stringify({ components: input.components }),
        }
    );

    if (response.ok) {
        return true;
    }

    if (response.status !== 404) {
        logWarn('discord.finance_panels.patch_failed', {
            channelId: input.channelId,
            messageId: input.messageId,
            status: response.status,
        });
    }

    return false;
}

async function fetchRecentMessages(token: string, channelId: string) {
    const response = await discordRequest(token, `/channels/${channelId}/messages?limit=25`);
    if (!response.ok) {
        logWarn('discord.finance_panels.messages_fetch_failed', {
            channelId,
            status: response.status,
        });
        return [];
    }

    const messages = await response.json();
    return Array.isArray(messages) ? messages as DiscordMessage[] : [];
}

function findManagedPanelMessage(messages: DiscordMessage[], titleFragments: string[]) {
    return messages.find((message) =>
        message.author?.bot &&
        message.embeds?.some((embed) =>
            titleFragments.some((fragment) => embed.title?.includes(fragment))
        )
    ) ?? null;
}

async function findAndPatchPanel(input: {
    token: string;
    channelId: string;
    components: DiscordComponent[];
    titleFragments: string[];
    knownMessageId?: string | null;
}) {
    if (input.knownMessageId) {
        const patched = await patchMessageComponents({
            token: input.token,
            channelId: input.channelId,
            messageId: input.knownMessageId,
            components: input.components,
        });

        if (patched) {
            return input.knownMessageId;
        }
    }

    const messages = await fetchRecentMessages(input.token, input.channelId);
    const message = findManagedPanelMessage(messages, input.titleFragments);
    if (!message) {
        return null;
    }

    const patched = await patchMessageComponents({
        token: input.token,
        channelId: input.channelId,
        messageId: message.id,
        components: input.components,
    });

    return patched ? message.id : null;
}

async function fetchGuildChannels(token: string, guildId: string) {
    const response = await discordRequest(token, `/guilds/${guildId}/channels`);
    if (!response.ok) {
        logWarn('discord.finance_panels.guild_channels_fetch_failed', {
            guildId,
            status: response.status,
        });
        return [];
    }

    const channels = await response.json();
    return Array.isArray(channels) ? channels as DiscordChannel[] : [];
}

function getAdminPanelCandidateChannelIds(
    channels: DiscordChannel[],
    settings: {
        adminPanelChannelId?: string | null;
        logChannelId?: string | null;
        requestsChannelId?: string | null;
    } | null | undefined
) {
    const candidates = new Set<string>();

    if (settings?.adminPanelChannelId) candidates.add(settings.adminPanelChannelId);

    for (const channel of channels) {
        if (channel.name === 'แผงควบคุม') {
            candidates.add(channel.id);
        }
    }

    return [...candidates];
}

export async function refreshFinanceDiscordPanelsForGang(gangId: string) {
    const token = process.env.DISCORD_BOT_TOKEN?.trim();
    if (!token) {
        return { updated: 0, skipped: 'missing_bot_token' as const };
    }

    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { discordGuildId: true },
        });
        const settings = await db.query.gangSettings.findFirst({
            where: eq(gangSettings.gangId, gangId),
            columns: {
                financeChannelId: true,
                financeMessageId: true,
                adminPanelMessageId: true,
                adminPanelChannelId: true,
                logChannelId: true,
                requestsChannelId: true,
            },
        });

        if (!gang?.discordGuildId || !settings) {
            return { updated: 0, skipped: 'missing_gang_or_settings' as const };
        }

        let updated = 0;

        if (settings.financeChannelId) {
            const financeMessageId = await findAndPatchPanel({
                token,
                channelId: settings.financeChannelId,
                knownMessageId: settings.financeMessageId,
                titleFragments: ['ระบบการเงิน', 'ศูนย์การเงินของสมาชิก'],
                components: buildFinancePanelComponents(),
            });

            if (financeMessageId) {
                updated += 1;
                if (financeMessageId !== settings.financeMessageId) {
                    await db.update(gangSettings)
                        .set({ financeMessageId })
                        .where(eq(gangSettings.gangId, gangId));
                }
            }
        }

        const channels = await fetchGuildChannels(token, gang.discordGuildId);
        const adminChannelIds = getAdminPanelCandidateChannelIds(channels, settings);
        for (const channelId of adminChannelIds) {
            const adminMessageId = await findAndPatchPanel({
                token,
                channelId,
                knownMessageId: settings.adminPanelMessageId,
                titleFragments: ['ศูนย์ควบคุมหัวหน้าแก๊ง'],
                components: buildAdminPanelComponents(gangId),
            });

            if (adminMessageId) {
                updated += 1;
                break;
            }
        }

        return { updated };
    } catch (error) {
        logWarn('discord.finance_panels.refresh_failed', {
            gangId,
            error,
        });
        return { updated: 0, skipped: 'refresh_failed' as const };
    }
}
