import { db, gangs } from '@gang/database';
import { sql, and, eq, isNotNull } from 'drizzle-orm';

const GRACE_PERIOD_DAYS = 3;

export function startLicenseScheduler() {
    // Run once on startup after 10 seconds, then every 6 hours
    setTimeout(checkExpiredLicenses, 10_000);
    setInterval(checkExpiredLicenses, 6 * 60 * 60 * 1000);
    console.log('📋 License expiry scheduler started (every 6 hours)');
}

async function checkExpiredLicenses() {
    try {
        const now = new Date();
        const graceDate = new Date(now.getTime() - GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

        // Find gangs with expired subscriptions (past grace period)
        const expiredGangs = await db.query.gangs.findMany({
            where: and(
                eq(gangs.isActive, true),
                isNotNull(gangs.subscriptionExpiresAt),
                sql`${gangs.subscriptionExpiresAt} < ${graceDate.getTime()}`,
                sql`${gangs.subscriptionTier} != 'FREE'`
            ),
            columns: { id: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true },
        });

        for (const gang of expiredGangs) {
            console.log(`[License] Downgrading gang "${gang.name}" (${gang.id}) from ${gang.subscriptionTier} to FREE — expired ${gang.subscriptionExpiresAt}`);

            await db.update(gangs)
                .set({
                    subscriptionTier: 'FREE',
                    updatedAt: now,
                })
                .where(eq(gangs.id, gang.id));
        }

        if (expiredGangs.length > 0) {
            console.log(`[License] Downgraded ${expiredGangs.length} gang(s) to FREE tier`);
        }

    } catch (error) {
        console.error('[License Scheduler] Error:', error);
    }
}
