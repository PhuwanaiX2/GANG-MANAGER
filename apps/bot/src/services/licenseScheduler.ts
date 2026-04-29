import { db, gangs } from '@gang/database';
import { sql, and, eq, isNotNull } from 'drizzle-orm';
import { logError, logInfo } from '../utils/logger';

const GRACE_PERIOD_DAYS = 3;
let licenseSchedulerStarted = false;

export function startLicenseScheduler() {
    if (licenseSchedulerStarted) {
        return;
    }

    licenseSchedulerStarted = true;
    // Run once on startup after 10 seconds, then every 6 hours
    setTimeout(checkExpiredLicenses, 10_000);
    setInterval(checkExpiredLicenses, 6 * 60 * 60 * 1000);
    logInfo('bot.license_scheduler.started', { intervalHours: 6, gracePeriodDays: GRACE_PERIOD_DAYS });
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
            logInfo('bot.license_scheduler.downgrade_started', {
                gangId: gang.id,
                subscriptionTier: gang.subscriptionTier,
                subscriptionExpiresAt: gang.subscriptionExpiresAt,
            });

            await db.update(gangs)
                .set({
                    subscriptionTier: 'FREE',
                    subscriptionExpiresAt: null,
                    updatedAt: now,
                })
                .where(eq(gangs.id, gang.id));
        }

        if (expiredGangs.length > 0) {
            logInfo('bot.license_scheduler.downgraded', { count: expiredGangs.length });
        }

    } catch (error) {
        logError('bot.license_scheduler.failed', error);
    }
}
