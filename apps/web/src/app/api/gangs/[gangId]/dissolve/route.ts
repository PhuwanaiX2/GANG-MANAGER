import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, gangRoles } from '@gang/database';
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

        let body: { deleteData?: unknown; confirmationText?: unknown };
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const deleteData = body.deleteData === true;

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

        // Delete ALL channels inside bot-managed categories, then delete the categories too
        try {
            const allChannels = await getRest().get(Routes.guildChannels(guildId)) as any[];

            // Categories managed by the bot
            const targetCategories = ['\u{1F4CC} \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E17\u0E31\u0E48\u0E27\u0E44\u0E1B', '\u23F0 \u0E23\u0E30\u0E1A\u0E1A\u0E40\u0E0A\u0E47\u0E04\u0E0A\u0E37\u0E48\u0E2D', '\u{1F4B0} \u0E23\u0E30\u0E1A\u0E1A\u0E01\u0E32\u0E23\u0E40\u0E07\u0E34\u0E19', '\u{1F512} \u0E2B\u0E31\u0E27\u0E41\u0E01\u0E4A\u0E07', '\u{1F50A} \u0E2B\u0E49\u0E2D\u0E07\u0E1E\u0E39\u0E14\u0E04\u0E38\u0E22'];

            // Identify target category IDs
            const targetCategoryChannels = allChannels.filter(c => c.type === 4 && targetCategories.includes(c.name));
            const targetCategoryIds = new Set(targetCategoryChannels.map(c => c.id));

            // Delete ALL child channels inside target categories (no exceptions)
            const childChannels = allChannels.filter(c => c.parent_id && targetCategoryIds.has(c.parent_id));
            for (const channel of childChannels) {
                try {
                    await getRest().delete(Routes.channel(channel.id));
                    logInfo('api.dissolve.channel_deleted', {
                        gangId,
                        actorDiscordId,
                        guildId,
                        channelId: channel.id,
                        channelName: channel.name,
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
