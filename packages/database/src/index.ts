import 'dotenv/config';
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

const client = url
    ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
    : undefined;

export const db = client
    ? drizzle(client, { schema })
    : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>);

// Export schema
export * from './schema';

// Export types
export type Database = typeof db;

// Export services
export * from './services/finance';

// Export tier config
export * from './tierConfig';
