import process from 'node:process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });

const requiredEntries = [
    ['DISCORD_BOT_TOKEN', (value) => value.length > 0, 'must not be empty'],
    ['DISCORD_CLIENT_ID', (value) => value.length > 0, 'must not be empty'],
    ['DISCORD_CLIENT_SECRET', (value) => value.length > 0, 'must not be empty'],
    ['TURSO_DATABASE_URL', (value) => value.startsWith('libsql://'), 'must start with libsql://'],
    ['TURSO_AUTH_TOKEN', (value) => value.length > 0, 'must not be empty'],
    ['NEXTAUTH_SECRET', (value) => value.length >= 16, 'must be at least 16 characters'],
    ['NEXTAUTH_URL', (value) => {
        try {
            const url = new URL(value);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch {
            return false;
        }
    }, 'must be a valid http(s) URL'],
    ['STRIPE_SECRET_KEY', (value) => value.length > 0, 'must not be empty'],
    ['STRIPE_WEBHOOK_SECRET', (value) => value.length > 0, 'must not be empty'],
    ['STRIPE_PRICE_PREMIUM', (value) => value.length > 0, 'must not be empty'],
    ['STRIPE_PRICE_PREMIUM_YEARLY', (value) => value.length > 0, 'must not be empty'],
    ['ADMIN_DISCORD_IDS', (value) => value.split(',').map((item) => item.trim()).filter(Boolean).length > 0, 'must contain at least one Discord ID'],
    ['BACKUP_CHANNEL_ID', (value) => value.length > 0, 'must not be empty'],
];

const recommendedEntries = [
    ['DISCORD_WEBHOOK_URL', (value) => {
        try {
            const url = new URL(value);
            return url.protocol === 'https:';
        } catch {
            return false;
        }
    }, 'should be a valid https URL for production error alerts'],
    ['NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME', (value) => value.length > 0, 'should be set if upload features are enabled'],
    ['CLOUDINARY_API_KEY', (value) => value.length > 0, 'should be set if upload features are enabled'],
    ['CLOUDINARY_API_SECRET', (value) => value.length > 0, 'should be set if upload features are enabled'],
    ['BOT_PORT', (value) => /^\d+$/.test(value), 'should be a numeric port if set explicitly'],
];

const missing = [];
const invalid = [];
const recommendedWarnings = [];

for (const [key, validator, message] of requiredEntries) {
    const value = process.env[key]?.trim() ?? '';
    if (!value) {
        missing.push(key);
        continue;
    }

    if (!validator(value)) {
        invalid.push(`${key}: ${message}`);
    }
}

for (const [key, validator, message] of recommendedEntries) {
    const value = process.env[key]?.trim() ?? '';
    if (!value) {
        recommendedWarnings.push(`${key}: ${message}`);
        continue;
    }

    if (!validator(value)) {
        recommendedWarnings.push(`${key}: ${message}`);
    }
}

if (missing.length > 0 || invalid.length > 0) {
    if (missing.length > 0) {
        console.error('Missing required production environment variables:');
        for (const key of missing) {
            console.error(`- ${key}`);
        }
    }

    if (invalid.length > 0) {
        console.error('Invalid production environment variables:');
        for (const item of invalid) {
            console.error(`- ${item}`);
        }
    }

    process.exit(1);
}

console.log('Production environment contract passed for Turso deployment.');

if (recommendedWarnings.length > 0) {
    console.warn('Recommended production environment variables still need attention:');
    for (const item of recommendedWarnings) {
        console.warn(`- ${item}`);
    }
}
