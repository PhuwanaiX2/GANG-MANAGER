import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(import.meta.dirname, '../../../.env') });

import { createClient } from '@libsql/client';

const APPLY_FLAG = process.argv.includes('--apply');

type DuplicateRow = {
    gang_id: string;
    key_value: string;
    count: number;
    ids: string;
};

async function getDuplicates(client: ReturnType<typeof createClient>) {
    const [permissionDuplicates, roleDuplicates] = await Promise.all([
        client.execute(`
            SELECT gang_id, permission_level AS key_value, COUNT(*) AS count, GROUP_CONCAT(id) AS ids
            FROM gang_roles
            GROUP BY gang_id, permission_level
            HAVING COUNT(*) > 1
            ORDER BY gang_id, permission_level
        `),
        client.execute(`
            SELECT gang_id, discord_role_id AS key_value, COUNT(*) AS count, GROUP_CONCAT(id) AS ids
            FROM gang_roles
            GROUP BY gang_id, discord_role_id
            HAVING COUNT(*) > 1
            ORDER BY gang_id, discord_role_id
        `),
    ]);

    return {
        permissionDuplicates: permissionDuplicates.rows as unknown as DuplicateRow[],
        roleDuplicates: roleDuplicates.rows as unknown as DuplicateRow[],
    };
}

function printDuplicateSection(title: string, duplicates: DuplicateRow[]) {
    console.log(`\n=== ${title} ===`);
    if (duplicates.length === 0) {
        console.log('- none');
        return;
    }

    for (const row of duplicates) {
        console.log(`- gang=${row.gang_id} key=${row.key_value} count=${Number(row.count)} ids=${row.ids}`);
    }
}

async function auditRoleMappings() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    console.log(APPLY_FLAG
        ? 'Applying gang role mapping duplicate cleanup...'
        : 'Dry-run: gang role mapping uniqueness audit...');

    const before = await getDuplicates(client);
    printDuplicateSection('Duplicate permission mappings', before.permissionDuplicates);
    printDuplicateSection('Duplicate Discord role mappings', before.roleDuplicates);

    const hasDuplicates = before.permissionDuplicates.length > 0 || before.roleDuplicates.length > 0;
    if (!hasDuplicates) {
        console.log('\nGang role mappings are ready for unique constraints.');
        return;
    }

    if (!APPLY_FLAG) {
        console.error('\nDuplicate gang role mappings found. Re-run with --apply before applying unique-constraint migrations.');
        process.exitCode = 1;
        return;
    }

    const permissionCleanup = await client.execute(`
        DELETE FROM gang_roles
        WHERE rowid NOT IN (
            SELECT MIN(rowid)
            FROM gang_roles
            GROUP BY gang_id, permission_level
        )
    `);

    const roleCleanup = await client.execute(`
        DELETE FROM gang_roles
        WHERE rowid NOT IN (
            SELECT MIN(rowid)
            FROM gang_roles
            GROUP BY gang_id, discord_role_id
        )
    `);

    console.log('\nApplied duplicate cleanup');
    console.log(`- duplicate permission rows deleted: ${permissionCleanup.rowsAffected}`);
    console.log(`- duplicate role rows deleted: ${roleCleanup.rowsAffected}`);

    const after = await getDuplicates(client);
    printDuplicateSection('Remaining duplicate permission mappings', after.permissionDuplicates);
    printDuplicateSection('Remaining duplicate Discord role mappings', after.roleDuplicates);

    if (after.permissionDuplicates.length > 0 || after.roleDuplicates.length > 0) {
        console.error('\nDuplicate cleanup did not fully resolve role mappings. Please inspect manually before migration.');
        process.exitCode = 1;
    }
}

auditRoleMappings().catch((error) => {
    console.error('Failed to audit gang role mappings');
    console.error(error);
    process.exitCode = 1;
});
