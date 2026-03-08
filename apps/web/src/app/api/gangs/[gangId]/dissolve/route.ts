import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, gangRoles, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10';

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

export async function POST(
    req: Request,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { deleteData } = body;

        // 1. Verify Permission — Only OWNER can dissolve
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.discordId, session.user.discordId),
                eq(members.gangId, params.gangId),
                eq(members.isActive, true)
            )
        });

        if (!member) {
            return NextResponse.json({ error: 'Member not found' }, { status: 403 });
        }

        if (member.gangRole !== 'OWNER') {
            console.warn(`[Security] Non-owner ${session.user.discordId} attempted to dissolve gang ${params.gangId}`);
            return NextResponse.json({ error: 'Forbidden: Only OWNER can dissolve a gang' }, { status: 403 });
        }
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
            with: {
                settings: true,
                roles: true,
            }
        });

        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        // 2. Delete Discord Assets (Roles & Channels) via REST
        const guildId = gang.discordGuildId;

        // Delete Roles
        for (const role of gang.roles) {
            try {
                await getRest().delete(Routes.guildRole(guildId, role.discordRoleId));
                console.log(`[API Dissolve] Deleted role ${role.discordRoleId}`);
            } catch (err) {
                // Ignore 404/Unknown Role
                console.error(`[API Dissolve] Failed to delete role ${role.discordRoleId}`, err);
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
                    console.log(`[API Dissolve] Deleted channel ${channel.name} (${channel.id})`);
                } catch (err) {
                    console.error(`[API Dissolve] Failed to delete channel ${channel.id}`, err);
                }
            }

            // Delete the categories themselves
            for (const cat of targetCategoryChannels) {
                try {
                    await getRest().delete(Routes.channel(cat.id));
                    console.log(`[API Dissolve] Deleted category ${cat.name} (${cat.id})`);
                } catch (err) {
                    console.error(`[API Dissolve] Failed to delete category ${cat.id}`, err);
                }
            }
        } catch (error) {
            console.error('[API Dissolve] Error fetching/deleting channels:', error);
        }

        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
        if (deleteData) {
            await db.delete(gangs).where(eq(gangs.id, params.gangId));
        } else {
            await db.update(gangs)
                .set({
                    dissolvedAt: new Date(),
                    isActive: false,
                    dissolvedBy: session.user.discordId,
                })
                .where(eq(gangs.id, params.gangId));
        }

        return NextResponse.json({ success: true, message: 'Gang dissolved successfully' });

    } catch (error) {
        console.error('[API] Dissolve Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
