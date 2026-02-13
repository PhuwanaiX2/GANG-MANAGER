import 'dotenv/config';
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
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
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
import { createClient } from '@libsql/client/http';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Conditional init: create DB at runtime, skip at build time when env vars are missing
const url = process.env.TURSO_DATABASE_URL;

>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
const client = url
    ? createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
    : undefined;

export const db = client
    ? drizzle(client, { schema })
    : (undefined as unknown as ReturnType<typeof drizzle<typeof schema>>);
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
<<<<<<< C:/Users/Jiwww/Desktop/PROJECTX/packages/database/src/index.ts
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts
=======
>>>>>>> C:/Users/Jiwww/.windsurf/worktrees/PROJECTX/PROJECTX-2b80bc61/packages/database/src/index.ts

// Export schema
export * from './schema';

// Export types
export type Database = typeof db;

// Export services
export * from './services/finance';

// Export tier config
export * from './tierConfig';
