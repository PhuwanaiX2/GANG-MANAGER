import { createHash } from 'crypto';

type EnvLike = Record<string, string | undefined>;

const FINGERPRINT_LENGTH = 12;

function firstNonEmpty(values: Array<string | undefined>) {
    return values.map(value => value?.trim()).find(Boolean) || null;
}

export function getDatabaseConnectionFingerprint(env: EnvLike = process.env) {
    const connectionUrl = firstNonEmpty([
        env.TURSO_DATABASE_URL,
        env.DATABASE_URL,
    ]);

    if (!connectionUrl) {
        return null;
    }

    return createHash('sha256')
        .update(connectionUrl)
        .digest('hex')
        .slice(0, FINGERPRINT_LENGTH);
}

export function getDatabaseConnectionLabel(env: EnvLike = process.env) {
    const connectionUrl = firstNonEmpty([
        env.TURSO_DATABASE_URL,
        env.DATABASE_URL,
    ]);

    if (!connectionUrl) {
        return null;
    }

    try {
        const url = new URL(connectionUrl);
        return `${url.protocol}//${url.hostname}`;
    } catch {
        return 'configured';
    }
}
