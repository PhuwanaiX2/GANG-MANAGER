import { config } from 'dotenv';
import { resolve } from 'path';

// Load env BEFORE importing db
config({ path: resolve(import.meta.dirname, '../../.env') });

import { createClient } from '@libsql/client';

async function cleanDatabase() {
    const client = createClient({
        url: process.env.TURSO_DATABASE_URL!,
        authToken: process.env.TURSO_AUTH_TOKEN,
    });

    console.log('🧹 Cleaning database...\n');

    // Delete in order to respect foreign key constraints
    const tables = [
        'audit_logs',
        'attendance_records',
        'attendance_sessions',
        'leave_requests',
        'transactions',
        'announcements',
        'members',
        'gang_roles',
        'gang_settings',
        'gangs',
    ];

    for (const table of tables) {
        try {
            const result = await client.execute(`DELETE FROM ${table}`);
            console.log(`✅ Deleted ${result.rowsAffected} rows from ${table}`);
        } catch (error) {
            console.log(`⚠️ Error deleting from ${table}:`, error);
        }
    }

    console.log('\n✨ Database cleaned! Now you can run /setup in Discord to create a new gang.');
    process.exit(0);
}

cleanDatabase().catch(console.error);
