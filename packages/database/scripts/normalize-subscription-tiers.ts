import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(import.meta.dirname, '../../../.env') });

import { createClient } from '@libsql/client';

const APPLY_FLAG = process.argv.includes('--apply');

async function normalizeSubscriptionTiers() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    console.log(APPLY_FLAG
        ? '🔧 Applying subscription tier normalization...'
        : '🔍 Dry-run: subscription tier normalization preview...');

    const [gangsPreview, licensesPreview] = await Promise.all([
        client.execute(`
            SELECT subscription_tier AS tier, COUNT(*) AS count
            FROM gangs
            GROUP BY subscription_tier
            ORDER BY subscription_tier
        `),
        client.execute(`
            SELECT tier, COUNT(*) AS count
            FROM licenses
            GROUP BY tier
            ORDER BY tier
        `),
    ]);

    console.log('\n=== Current gang subscription tiers ===');
    gangsPreview.rows.forEach((row) => {
        console.log(`- ${String(row.tier)}: ${Number(row.count)}`);
    });

    console.log('\n=== Current license tiers ===');
    licensesPreview.rows.forEach((row) => {
        console.log(`- ${String(row.tier)}: ${Number(row.count)}`);
    });

    if (!APPLY_FLAG) {
        console.log('\nNo changes applied. Re-run with --apply to update legacy tiers to PREMIUM.');
        return;
    }

    const legacyGangResult = await client.execute(`
        UPDATE gangs
        SET subscription_tier = 'PREMIUM'
        WHERE subscription_tier IN ('TRIAL', 'PRO')
    `);

    const legacyLicenseResult = await client.execute(`
        UPDATE licenses
        SET tier = 'PREMIUM'
        WHERE tier IN ('TRIAL', 'PRO')
    `);

    console.log('\n✅ Applied normalization');
    console.log(`- gangs updated: ${legacyGangResult.rowsAffected}`);
    console.log(`- licenses updated: ${legacyLicenseResult.rowsAffected}`);

    const [gangsAfter, licensesAfter] = await Promise.all([
        client.execute(`
            SELECT subscription_tier AS tier, COUNT(*) AS count
            FROM gangs
            GROUP BY subscription_tier
            ORDER BY subscription_tier
        `),
        client.execute(`
            SELECT tier, COUNT(*) AS count
            FROM licenses
            GROUP BY tier
            ORDER BY tier
        `),
    ]);

    console.log('\n=== Final gang subscription tiers ===');
    gangsAfter.rows.forEach((row) => {
        console.log(`- ${String(row.tier)}: ${Number(row.count)}`);
    });

    console.log('\n=== Final license tiers ===');
    licensesAfter.rows.forEach((row) => {
        console.log(`- ${String(row.tier)}: ${Number(row.count)}`);
    });
}

normalizeSubscriptionTiers().catch((error) => {
    console.error('❌ Failed to normalize subscription tiers');
    console.error(error);
    process.exit(1);
});
