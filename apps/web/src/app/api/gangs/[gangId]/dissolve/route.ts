import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, gangRoles, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { REST } from 'discord.js';
import { Routes } from 'discord-api-types/v10'; // Use v10 types for better compatibility usually, or import from discord.js directly if preferred but REST uses Routes
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
import { stripe } from '@/lib/stripe';

=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
// Helper to init REST
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN!);

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
                await rest.delete(Routes.guildRole(guildId, role.discordRoleId));
                console.log(`[API Dissolve] Deleted role ${role.discordRoleId}`);
            } catch (err) {
                // Ignore 404/Unknown Role
                console.error(`[API Dissolve] Failed to delete role ${role.discordRoleId}`, err);
            }
        }

        // Delete ALL channels inside bot-managed categories, then delete the categories too
        try {
            const allChannels = await rest.get(Routes.guildChannels(guildId)) as any[];

            // Categories managed by the bot
            const targetCategories = ['📌 ข้อมูลทั่วไป', '⏰ ระบบเช็คชื่อ', '💰 ระบบการเงิน', '🔒 หัวแก๊ง', '🔊 ห้องพูดคุย'];

            // Identify target category IDs
            const targetCategoryChannels = allChannels.filter(c => c.type === 4 && targetCategories.includes(c.name));
            const targetCategoryIds = new Set(targetCategoryChannels.map(c => c.id));

            // Delete ALL child channels inside target categories (no exceptions)
            const childChannels = allChannels.filter(c => c.parent_id && targetCategoryIds.has(c.parent_id));
            for (const channel of childChannels) {
                try {
                    await rest.delete(Routes.channel(channel.id));
                    console.log(`[API Dissolve] Deleted channel ${channel.name} (${channel.id})`);
                } catch (err) {
                    console.error(`[API Dissolve] Failed to delete channel ${channel.id}`, err);
                }
            }

            // Delete the categories themselves
            for (const cat of targetCategoryChannels) {
                try {
                    await rest.delete(Routes.channel(cat.id));
                    console.log(`[API Dissolve] Deleted category ${cat.name} (${cat.id})`);
                } catch (err) {
                    console.error(`[API Dissolve] Failed to delete category ${cat.id}`, err);
                }
            }
        } catch (error) {
            console.error('[API Dissolve] Error fetching/deleting channels:', error);
        }

<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
        // 3. Cancel Stripe Subscription (if any)
        if (gang.stripeCustomerId) {
            try {
                const subscriptionsList = await stripe.subscriptions.list({
                    customer: gang.stripeCustomerId,
                    status: 'active',
                });

                for (const sub of subscriptionsList.data) {
                    await stripe.subscriptions.update(sub.id, {
                        cancel_at_period_end: true,
                        metadata: { cancelReason: 'gang_dissolved' },
                    });
                    console.log(`[API Dissolve] Cancelled Stripe subscription ${sub.id} at period end`);
                }
            } catch (stripeErr) {
                console.error('[API Dissolve] Failed to cancel Stripe subscription:', stripeErr);
            }
        }

        // 4. Update Database
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
=======
        // 3. Update Database (no Stripe subscription to cancel — payment mode expires naturally)
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/apps/web/src/app/api/gangs/[gangId]/dissolve/route.ts
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
