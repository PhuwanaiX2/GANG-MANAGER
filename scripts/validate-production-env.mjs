import process from 'node:process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../.env.local'), override: true });

const promptPayBillingEnabled = process.env.ENABLE_PROMPTPAY_BILLING === 'true';
const slipOkAutoVerifyEnabled = process.env.ENABLE_SLIPOK_AUTO_VERIFY === 'true';

function isHttpsOrLocalhostUrl(value) {
    try {
        const url = new URL(value);
        const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
        return url.protocol === 'https:' || (url.protocol === 'http:' && isLocalhost);
    } catch {
        return false;
    }
}

const requiredEntries = [
    ['DISCORD_BOT_TOKEN', (value) => value.length > 0, 'must not be empty'],
    ['DISCORD_CLIENT_ID', (value) => value.length > 0, 'must not be empty'],
    ['DISCORD_CLIENT_SECRET', (value) => value.length > 0, 'must not be empty'],
    ['TURSO_DATABASE_URL', (value) => value.startsWith('libsql://'), 'must start with libsql://'],
    ['TURSO_AUTH_TOKEN', (value) => value.length > 0, 'must not be empty'],
    ['NEXTAUTH_SECRET', (value) => value.length >= 32, 'must be at least 32 characters'],
    ['NEXTAUTH_URL', isHttpsOrLocalhostUrl, 'must be HTTPS, except localhost development URLs'],
    ['ADMIN_DISCORD_IDS', (value) => value.split(',').map((item) => item.trim()).filter(Boolean).length > 0, 'must contain at least one Discord ID'],
    ['BACKUP_CHANNEL_ID', (value) => value.length > 0, 'must not be empty'],
];

const promptPayEntries = [
    ['PROMPTPAY_RECEIVER_NAME', (value) => value.length > 0, 'must be set when PromptPay billing is enabled'],
    ['PROMPTPAY_IDENTIFIER', (value) => value.length > 0, 'must be set when PromptPay billing is enabled'],
];

const slipOkEntries = [
    ['SLIPOK_API_KEY', (value) => value.length > 0, 'must be set when SlipOK auto verify is enabled'],
    ['SLIPOK_BRANCH_ID', (value) => value.length > 0, 'must be set when SlipOK auto verify is enabled'],
];

function isValidPort(value) {
    if (!/^\d+$/.test(value)) {
        return false;
    }

    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535;
}

const recommendedEntries = [
    ['ENABLE_PROMPTPAY_BILLING', (value) => value === 'true' || value === 'false', 'should be true or false if set explicitly'],
    ['ENABLE_SLIPOK_AUTO_VERIFY', (value) => value === 'true' || value === 'false', 'should be true or false if set explicitly'],
    ['CLOUDINARY_CLOUD_NAME', (value) => value.length > 0 && !value.includes('://'), 'should be set to the Cloudinary cloud name only, not a connection URL'],
    ['CLOUDINARY_API_KEY', (value) => value.length > 0, 'should be set if upload features are enabled'],
    ['CLOUDINARY_API_SECRET', (value) => value.length > 0, 'should be set if upload features are enabled'],
    ['BOT_PORT', isValidPort, 'should be a numeric port between 1 and 65535 if set explicitly', { warnWhenMissing: false }],
    ['PORT', isValidPort, 'should be a numeric port between 1 and 65535 if set explicitly', { warnWhenMissing: false }],
];

const missing = [];
const invalid = [];
const recommendedWarnings = [];
const forbiddenStripeEntries = Object.keys(process.env).filter((key) => key.startsWith('STRIPE_'));
if (forbiddenStripeEntries.length > 0) {
    invalid.push(`STRIPE_*: remove legacy Stripe variables (${forbiddenStripeEntries.join(', ')})`);
}

if (process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.trim()) {
    invalid.push('NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: must not be set; use server-only CLOUDINARY_CLOUD_NAME');
}

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

if (promptPayBillingEnabled) {
    for (const [key, validator, message] of promptPayEntries) {
        const value = process.env[key]?.trim() ?? '';
        if (!value) {
            missing.push(key);
            continue;
        }

        if (!validator(value)) {
            invalid.push(`${key}: ${message}`);
        }
    }
}

if (slipOkAutoVerifyEnabled) {
    for (const [key, validator, message] of slipOkEntries) {
        const value = process.env[key]?.trim() ?? '';
        if (!value) {
            missing.push(key);
            continue;
        }

        if (!validator(value)) {
            invalid.push(`${key}: ${message}`);
        }
    }
}

for (const [key, validator, message, options = {}] of recommendedEntries) {
    const value = process.env[key]?.trim() ?? '';
    if (!value) {
        if (key.startsWith('ENABLE_') || options.warnWhenMissing === false) {
            continue;
        }
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

if (!promptPayBillingEnabled) {
    console.log('PromptPay billing is disabled; paid plan purchase flow stays closed.');
}
if (!slipOkAutoVerifyEnabled) {
    console.log('SlipOK auto verify is disabled; submitted slips require manual review when billing is enabled.');
}

if (recommendedWarnings.length > 0) {
    console.warn('Recommended production environment variables still need attention:');
    for (const item of recommendedWarnings) {
        console.warn(`- ${item}`);
    }
}
