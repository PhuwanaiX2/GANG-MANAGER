import 'dotenv/config';
import { db, FeatureFlagService, gangSettings, gangs, members } from '../src';

const confirm = process.env.DEV_SEED_CONFIRM;
const databaseUrl = process.env.TURSO_DATABASE_URL || '';
const allowAnyDb = process.env.DEV_SEED_ALLOW_ANY_DB === 'true';

if (confirm !== 'seed-dev') {
    throw new Error('Set DEV_SEED_CONFIRM=seed-dev before running the dev seed script.');
}

if (!allowAnyDb && !databaseUrl.includes('testting')) {
    throw new Error('Refusing to seed a non-dev database. Use a dev DB URL or set DEV_SEED_ALLOW_ANY_DB=true intentionally.');
}

const now = new Date();
const premiumExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

const seedConfig = {
    premiumGangId: process.env.DEV_SEED_PREMIUM_GANG_ID || 'dev-premium-gang',
    premiumGuildId: process.env.DEV_SEED_PREMIUM_GUILD_ID || 'dev-premium-guild',
    premiumGangName: process.env.DEV_SEED_PREMIUM_GANG_NAME || 'Dev Premium Gang',
    freeGangId: process.env.DEV_SEED_FREE_GANG_ID || 'dev-free-gang',
    freeGuildId: process.env.DEV_SEED_FREE_GUILD_ID || 'dev-free-guild',
    freeGangName: process.env.DEV_SEED_FREE_GANG_NAME || 'Dev Free Gang',
    adminDiscordId: process.env.DEV_SEED_ADMIN_DISCORD_ID || '300275711539806220',
    freeOwnerDiscordId: process.env.DEV_SEED_FREE_OWNER_DISCORD_ID || process.env.DEV_SEED_ADMIN_DISCORD_ID || '300275711539806220',
};

async function upsertGang(input: {
    id: string;
    discordGuildId: string;
    name: string;
    tier: 'FREE' | 'PREMIUM';
    expiresAt: Date | null;
    balance: number;
}) {
    await db.insert(gangs)
        .values({
            id: input.id,
            discordGuildId: input.discordGuildId,
            name: input.name,
            subscriptionTier: input.tier,
            subscriptionExpiresAt: input.expiresAt,
            balance: input.balance,
            isActive: true,
            transferStatus: 'NONE',
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: gangs.id,
            set: {
                discordGuildId: input.discordGuildId,
                name: input.name,
                subscriptionTier: input.tier,
                subscriptionExpiresAt: input.expiresAt,
                balance: input.balance,
                isActive: true,
                updatedAt: now,
            },
        });

    await db.insert(gangSettings)
        .values({
            id: `${input.id}-settings`,
            gangId: input.id,
            currency: 'THB',
            requirePhotoDefault: false,
            defaultAbsentPenalty: 0,
        })
        .onConflictDoUpdate({
            target: gangSettings.gangId,
            set: {
                currency: 'THB',
                requirePhotoDefault: false,
                defaultAbsentPenalty: 0,
            },
        });
}

async function upsertMember(input: {
    id: string;
    gangId: string;
    discordId: string;
    name: string;
    role: 'OWNER' | 'ADMIN' | 'TREASURER' | 'ATTENDANCE_OFFICER' | 'MEMBER';
    balance?: number;
}) {
    await db.insert(members)
        .values({
            id: input.id,
            gangId: input.gangId,
            discordId: input.discordId,
            name: input.name,
            discordUsername: input.name,
            status: 'APPROVED',
            gangRole: input.role,
            isActive: true,
            balance: input.balance || 0,
            joinedAt: now,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: members.id,
            set: {
                discordId: input.discordId,
                name: input.name,
                discordUsername: input.name,
                status: 'APPROVED',
                gangRole: input.role,
                isActive: true,
                balance: input.balance || 0,
                updatedAt: now,
            },
        });
}

await FeatureFlagService.seed(db);

await upsertGang({
    id: seedConfig.premiumGangId,
    discordGuildId: seedConfig.premiumGuildId,
    name: seedConfig.premiumGangName,
    tier: 'PREMIUM',
    expiresAt: premiumExpiresAt,
    balance: 100000,
});

await upsertMember({
    id: `${seedConfig.premiumGangId}-owner`,
    gangId: seedConfig.premiumGangId,
    discordId: seedConfig.adminDiscordId,
    name: 'Dev Premium Owner',
    role: 'OWNER',
    balance: 0,
});

await upsertMember({
    id: `${seedConfig.premiumGangId}-treasurer`,
    gangId: seedConfig.premiumGangId,
    discordId: `${seedConfig.adminDiscordId}-treasurer`,
    name: 'Dev Treasurer',
    role: 'TREASURER',
    balance: 500,
});

await upsertGang({
    id: seedConfig.freeGangId,
    discordGuildId: seedConfig.freeGuildId,
    name: seedConfig.freeGangName,
    tier: 'FREE',
    expiresAt: null,
    balance: 0,
});

await upsertMember({
    id: `${seedConfig.freeGangId}-owner`,
    gangId: seedConfig.freeGangId,
    discordId: seedConfig.freeOwnerDiscordId,
    name: 'Dev Free Owner',
    role: 'OWNER',
    balance: 0,
});

console.log(JSON.stringify({
    ok: true,
    premiumGangId: seedConfig.premiumGangId,
    freeGangId: seedConfig.freeGangId,
    adminDiscordId: seedConfig.adminDiscordId,
    freeOwnerDiscordId: seedConfig.freeOwnerDiscordId,
}, null, 2));
