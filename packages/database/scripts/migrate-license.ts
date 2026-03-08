import { config } from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

import { createClient } from '@libsql/client/http';

const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
});

async function migrate() {
    try {
        await client.execute('ALTER TABLE licenses ADD COLUMN duration_days INTEGER NOT NULL DEFAULT 30');
        console.log('OK: duration_days added');
    } catch (e: any) {
        if (e.message?.includes('duplicate')) {
            console.log('Already exists');
        } else {
            console.error(e.message);
        }
    }
}

migrate();
