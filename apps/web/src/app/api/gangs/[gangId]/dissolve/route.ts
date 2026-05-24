import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { eq } from 'drizzle-orm';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';
import { logError, logInfo, logWarn } from '@/lib/logger';

// Lazy-init REST to avoid crash if DISCORD_BOT_TOKEN is missing at module load
let _rest: REST | null = null;
function getRest() {
    if (!_rest) {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) throw new Error('DISCORD_BOT_TOKEN is not set');
        _rest = new REST({ version: '10' }).setToken(token);
    }
    return _rest;
}

const DISCORD_CHANNEL_CLEANUP_MODES = ['DELETE_MANAGED', 'KEEP_CHAT', 'KEEP_SELECTED', 'KEEP_ALL'] as const;
type DiscordChannelCleanupMode = typeof DISCORD_CHANNEL_CLEANUP_MODES[number];
type DiscordGuildChannel = {
    id: string;
    name?: string;
    type?: number;
    parent_id?: string | null;
    position?: number;
};

const DISCORD_TEXT_LIKE_CHANNEL_TYPES = new Set([0, 5, 10, 11, 12]);
const TARGET_CATEGORY_NAMES = [
    '\u{1F4CC} \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B',
    '\u23F0 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D',
    '\u{1F4B0} \u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19',
    '\u{1F512} \u0E2B\u0E31\u0E27\u0E41\u0E01\u0E4A\u0E07',
    '\u{1F50A} \u0E2B\u0E49\u0E2D\u0E07\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22',
] as const;
const FORCE_DELETE_CHANNEL_NAMES = [
    '\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E15\u0E31\u0E27\u0E15\u0E19',
    '\u0E25\u0E07\u0E17\u0E30\u0E40\u0E1A\u0E35\u0E22\u0E19',
    'website',
    '\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D',
    '\u0E41\u0E08\u0E49\u0E07\u0E25\u0E32',
    '\u0E41\u0E08\u0E49\u0E07\u0E18\u0E38\u0E23\u0E01\u0E23\u0E23\u0E21',
    '\u0E41\u0E1C\u0E07\u0E04\u0E27\u0E1A\u0E04\u0E38\u0E21',
    'log-\u0E23\u0E30\u0E1A\u0E1A',
    '\u{1F4CB}-\u0E04\u0E33\u0E02\u0E2D\u0E41\u0E25\u0E30\u0E2D\u0E19\u0E38\u0E21\u0E31\u0E15\u0E34',
] as const;
const FORCE_DELETE_CHANNEL_ALIASES = [
    'dashboard',
    '\u0E41\u0E14\u0E0A\u0E1A\u0E2D\u0E23\u0E4C\u0E14',
    'verify',
    'verification',
    'register',
    'registration',
    'check-in',
    'attendance',
    'bot-commands',
    'admin-log',
    'gang-log',
    'log-system',
    'admin-panel',
    'control-panel',
    'finance',
    'leave',
    'attendance-summary',
    'summary-attendance',
    'requests',
] as const;

function normalizeDiscordChannelCleanupMode(value: unknown): DiscordChannelCleanupMode {
    return DISCORD_CHANNEL_CLEANUP_MODES.includes(value as DiscordChannelCleanupMode)
        ? value as DiscordChannelCleanupMode
        : 'DELETE_MANAGED';
}

function normalizeDiscordName(name?: string | null) {
    return (name || '').trim().toLowerCase();
}

function isTextLikeChannel(channel: { type?: number }) {
    return channel.type === undefined || DISCORD_TEXT_LIKE_CHANNEL_TYPES.has(channel.type);
}

function isForceDeleteChannel(channel: { name?: string; type?: number }) {
    if (!isTextLikeChannel(channel)) {
        return false;
    }

    const name = normalizeDiscordName(channel.name);
    if (!name) return false;

    return [...FORCE_DELETE_CHANNEL_NAMES, ...FORCE_DELETE_CHANNEL_ALIASES].some((keyword) => {
        const normalizedKeyword = normalizeDiscordName(keyword);
        return name === normalizedKeyword || name.includes(normalizedKeyword);
    });
}

function isPreservedChatChannel(channel: { name?: string; type?: number }) {
    if (!isTextLikeChannel(channel) || isForceDeleteChannel(channel)) {
        return false;
    }

    const name = normalizeDiscordName(channel.name);
    if (!name) return false;

    return [
        'general',
        'chat',
        'พูดคุย',
        'ทั่วไป',
        'แชท',
        'ห้องแชท',
        'สนทนา',
    ].some((keyword) => name === keyword || name.includes(keyword));
}

function parsePreserveDiscordChannelIds(value: unknown) {
    if (!Array.isArray(value)) return new Set<string>();

    return new Set(
        value
            .filter((id): id is string => typeof id === 'string')
            .map((id) => id.trim())
            .filter((id) => /^\d{5,32}$/.test(id))
            .slice(0, 100)
    );
}

function shouldPreserveDiscordChannel(
    channel: DiscordGuildChannel,
    mode: DiscordChannelCleanupMode,
    selectedChannelIds: Set<string>
) {
    if (isForceDeleteChannel(channel)) {
        return false;
    }

    if (!isTextLikeChannel(channel)) {
        return false;
    }

    if (mode === 'KEEP_SELECTED') {
        return selectedChannelIds.has(channel.id);
    }

    if (mode === 'KEEP_CHAT') {
        return selectedChannelIds.has(channel.id) || isPreservedChatChannel(channel);
    }

    if (mode === 'KEEP_ALL') {
        return true;
    }

    return false;
}

function buildDiscordCleanupPreview(allChannels: DiscordGuildChannel[]) {
    const targetCategoryChannels = allChannels.filter(c =>
        c.type === 4 && typeof c.name === 'string' && TARGET_CATEGORY_NAMES.includes(c.name as typeof TARGET_CATEGORY_NAMES[number])
    );
    const targetCategoryIds = new Set(targetCategoryChannels.map(c => c.id));
    const categoryNameById = new Map(targetCategoryChannels.map(c => [c.id, c.name || '']));
    const childChannels = allChannels
        .filter(c => c.parent_id && targetCategoryIds.has(c.parent_id) && isTextLikeChannel(c))
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    return {
        channels: childChannels.map(channel => ({
            id: channel.id,
            name: channel.name || '',
            type: channel.type ?? 0,
            parentId: channel.parent_id || null,
            parentName: channel.parent_id ? categoryNameById.get(channel.parent_id) || null : null,
            canPreserve: !isForceDeleteChannel(channel),
            forceDelete: isForceDeleteChannel(channel),
            defaultPreserve: isPreservedChatChannel(channel),
        })),
    };
}

async function requireDissolveAccess(gangId: string, actorDiscordId: string | null) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            logWarn('api.dissolve.forbidden', {
                gangId,
                actorDiscordId,
            });
            return NextResponse.json({ error: 'Forbidden: Only OWNER can dissolve a gang' }, { status: 403 });
        }

        throw error;
    }
}

export async function POST(req: Request, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const forbiddenResponse = await requireDissolveAccess(gangId, actorDiscordId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(req, {
            scope: 'api:dissolve',
            limit: 5,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('dissolve', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        let body: {
            deleteData?: unknown;
            confirmationText?: unknown;
            discordChannelCleanupMode?: unknown;
            preserveDiscordChannelIds?: unknown;
        };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const deleteData = body.deleteData === true;
        const discordChannelCleanupMode = normalizeDiscordChannelCleanupMode(body.discordChannelCleanupMode);
        const preserveDiscordChannelIds = parsePreserveDiscordChannelIds(body.preserveDiscordChannelIds);

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: {
                settings: true,
                roles: true,
            }
        });

        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        const confirmationText = typeof body.confirmationText === 'string' ? body.confirmationText : '';
        if (confirmationText.trim() !== gang.name.trim()) {
            return NextResponse.json(
                { error: 'กรุณาพิมพ์ชื่อแก๊งให้ตรงก่อนยุบแก๊ง' },
                { status: 400 }
            );
        }

        if (!process.env.DISCORD_BOT_TOKEN) {
            return NextResponse.json(
                { error: 'ยังไม่ได้ตั้งค่า DISCORD_BOT_TOKEN จึงยุบแก๊งแบบ production ไม่ได้' },
                { status: 503 }
            );
        }

        // 2. Delete Discord Assets (Roles & Channels) via REST
        const guildId = gang.discordGuildId;

        // Delete Roles
        for (const role of gang.roles) {
            try {
                await getRest().delete(Routes.guildRole(guildId, role.discordRoleId));
                logInfo('api.dissolve.role_deleted', {
                    gangId,
                    actorDiscordId,
                    guildId,
                    roleId: role.discordRoleId,
                });
            } catch (err) {
                // Ignore 404/Unknown Role
                logWarn('api.dissolve.role_delete_failed', {
                    gangId,
                    actorDiscordId,
                    guildId,
                    roleId: role.discordRoleId,
                    error: err,
                });
            }
        }

        try {
            const allChannels = await getRest().get(Routes.guildChannels(guildId)) as DiscordGuildChannel[];

            const targetCategoryChannels = allChannels.filter(c =>
                c.type === 4 && typeof c.name === 'string' && TARGET_CATEGORY_NAMES.includes(c.name as typeof TARGET_CATEGORY_NAMES[number])
            );
            const targetCategoryIds = new Set(targetCategoryChannels.map(c => c.id));

                // Delete child channels inside target categories. KEEP_CHAT preserves common chat rooms such as general/ทั่วไป.
                const childChannels = allChannels.filter(c => c.parent_id && targetCategoryIds.has(c.parent_id));
                const preservedParentCategoryIds = new Set<string>();
                for (const channel of childChannels) {
                    if (shouldPreserveDiscordChannel(channel, discordChannelCleanupMode, preserveDiscordChannelIds) && channel.parent_id) {
                        preservedParentCategoryIds.add(channel.parent_id);
                        logInfo('api.dissolve.channel_preserved', {
                            gangId,
                            actorDiscordId,
                            guildId,
                            channelId: channel.id,
                            channelName: channel.name,
                            mode: discordChannelCleanupMode,
                        });
                        continue;
                    }

                    try {
                        await getRest().delete(Routes.channel(channel.id));
                        logInfo('api.dissolve.channel_deleted', {
                            gangId,
                            actorDiscordId,
                            guildId,
                            channelId: channel.id,
                            channelName: channel.name,
                            forceDelete: isForceDeleteChannel(channel),
                        });
                    } catch (err) {
                        logWarn('api.dissolve.channel_delete_failed', {
                            gangId,
                            actorDiscordId,
                            guildId,
                            channelId: channel.id,
                            channelName: channel.name,
                            error: err,
                        });
                    }
                }

                // Delete the categories themselves
                for (const cat of targetCategoryChannels) {
                    if (preservedParentCategoryIds.has(cat.id)) {
                        logInfo('api.dissolve.category_preserved', {
                            gangId,
                            actorDiscordId,
                            guildId,
                            categoryId: cat.id,
                            categoryName: cat.name,
                            mode: discordChannelCleanupMode,
                        });
                        continue;
                    }

                    try {
                        await getRest().delete(Routes.channel(cat.id));
                        logInfo('api.dissolve.category_deleted', {
                            gangId,
                            actorDiscordId,
                            guildId,
                            categoryId: cat.id,
                            categoryName: cat.name,
                        });
                    } catch (err) {
                        logWarn('api.dissolve.category_delete_failed', {
                            gangId,
                            actorDiscordId,
                            guildId,
                            categoryId: cat.id,
                            categoryName: cat.name,
                            error: err,
                        });
                    }
                }
        } catch (error) {
            logWarn('api.dissolve.channel_cleanup_failed', {
                gangId,
                actorDiscordId,
                guildId,
                error,
            });
        }

        // 3. Update Database. Billing access is time-based and expires naturally.
        if (deleteData) {
            await db.delete(gangs).where(eq(gangs.id, gangId));
        } else {
            await db.update(gangs)
                .set({
                    dissolvedAt: new Date(),
                    isActive: false,
                    dissolvedBy: session.user.discordId,
                })
                .where(eq(gangs.id, gangId));
        }

        return NextResponse.json({ success: true, message: 'Gang dissolved successfully' });

    } catch (error) {
        logError('api.dissolve.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function GET(req: Request, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const forbiddenResponse = await requireDissolveAccess(gangId, actorDiscordId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(req, {
            scope: 'api:discord:channels',
            limit: 30,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('discord-cleanup-preview', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: {
                id: true,
                discordGuildId: true,
            },
        });

        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        if (!process.env.DISCORD_BOT_TOKEN) {
            return NextResponse.json({ channels: [], warning: 'DISCORD_BOT_TOKEN is not set' });
        }

        const allChannels = await getRest().get(Routes.guildChannels(gang.discordGuildId)) as DiscordGuildChannel[];
        return NextResponse.json(buildDiscordCleanupPreview(allChannels));
    } catch (error) {
        logError('api.dissolve.preview_failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
