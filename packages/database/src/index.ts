import 'dotenv/config';
import { createClient, type Client } from '@libsql/client/http';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Lazy-init to avoid crashing at build time when env vars aren't set
let _client: Client | null = null;
let _db: LibSQLDatabase<typeof schema> | null = null;

function getClient(): Client {
    if (!_client) {
        _client = createClient({
            url: process.env.TURSO_DATABASE_URL!,
            authToken: process.env.TURSO_AUTH_TOKEN,
        });
    }
    return _client;
}

function getDb(): LibSQLDatabase<typeof schema> {
    if (!_db) {
        _db = drizzle(getClient(), { schema });
    }
    return _db;
}

// Export as a proxy so it initializes only on first access at runtime
export const db: LibSQLDatabase<typeof schema> = new Proxy({} as LibSQLDatabase<typeof schema>, {
    get(_target, prop: string | symbol) {
        return (getDb() as any)[prop];
    },
});

// Export schema
export * from './schema';

// Export types
export type Database = typeof db;

// Export services
export * from './services/finance';
export * from './services/featureFlags';

// Export tier config
export * from './tierConfig';
