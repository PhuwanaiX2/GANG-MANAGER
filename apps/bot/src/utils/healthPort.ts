const DEFAULT_HEALTH_PORT = 8080;
const HEALTH_PORT_KEYS = ['BOT_PORT', 'PORT'] as const;

type HealthPortSource = typeof HEALTH_PORT_KEYS[number] | 'default';

type HealthPortResolution = {
    port: number;
    source: HealthPortSource;
    ignoredInvalidKeys: string[];
};

function parsePort(value: string | undefined) {
    const normalized = value?.trim();
    if (!normalized) {
        return null;
    }

    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        return null;
    }

    return parsed;
}

export function resolveHealthPort(env: NodeJS.ProcessEnv = process.env): HealthPortResolution {
    const ignoredInvalidKeys: string[] = [];

    for (const key of HEALTH_PORT_KEYS) {
        const rawValue = env[key];
        if (rawValue === undefined || rawValue.trim().length === 0) {
            continue;
        }

        const parsed = parsePort(rawValue);
        if (parsed !== null) {
            return {
                port: parsed,
                source: key,
                ignoredInvalidKeys,
            };
        }

        ignoredInvalidKeys.push(key);
    }

    return {
        port: DEFAULT_HEALTH_PORT,
        source: 'default',
        ignoredInvalidKeys,
    };
}

export type { HealthPortResolution, HealthPortSource };
