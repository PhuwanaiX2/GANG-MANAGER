import { ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { db, FeatureFlagService, gangs, members, canAccessFeature, normalizeSubscriptionTier, resolveEffectiveSubscriptionTier } from '@gang/database';
import { and, eq } from 'drizzle-orm';

type AnyInteraction = ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction;
type TierFeatureKey = Parameters<typeof canAccessFeature>[1];
type GuardOptions = {
    alreadyDeferred?: boolean;
    requireApprovedMember?: boolean;
    missingMemberMessage?: string;
};

type GuardGang = {
    id: string;
    name: string;
    subscriptionTier: string;
    balance: number | null;
};

type GuardMember = {
    id: string;
    name: string;
    discordId: string;
    gangId: string;
    gangRole: string;
    status: string;
    balance: number | null;
};

const DEFAULT_FEATURE_LABEL = 'ฟีเจอร์นี้';
const DEFAULT_MISSING_MEMBER_MESSAGE = '❌ ไม่พบข้อมูลสมาชิกแก๊ง หรือคุณยังไม่มีสิทธิ์ใช้งานฟีเจอร์นี้';
const CORRUPTED_TEXT_MARKERS = [
    String.fromCharCode(0x00C3),
    String.fromCharCode(0x00C2),
    String.fromCharCode(0x00E2, 0x009D),
    String.fromCharCode(0x00E2, 0x009C),
    String.fromCharCode(0x00E0, 0x00B8),
    String.fromCharCode(0x00E0, 0x00B9),
];

async function respondToInteraction(
    interaction: AnyInteraction,
    message: string,
    options?: { alreadyDeferred?: boolean }
) {
    if (options?.alreadyDeferred || interaction.replied || interaction.deferred) {
        await interaction.editReply(message);
        return;
    }

    await (interaction as any).reply({ content: message, ephemeral: true });
}

function isCorruptedText(value: string | undefined): boolean {
    if (!value) return false;
    return CORRUPTED_TEXT_MARKERS.some((marker) => value.includes(marker));
}

function safeText(value: string | undefined, fallback: string): string {
    if (!value || isCorruptedText(value)) {
        return fallback;
    }
    return value;
}

/**
 * Check if a feature is globally enabled.
 * If disabled, replies to the interaction and returns false.
 */
export async function checkFeatureEnabled(
    interaction: AnyInteraction,
    featureKey: string,
    featureLabel: string,
    options?: { alreadyDeferred?: boolean }
): Promise<boolean> {
    const enabled = await FeatureFlagService.isEnabled(db, featureKey);
    if (enabled) return true;

    const safeFeatureLabel = safeText(featureLabel, DEFAULT_FEATURE_LABEL);
    const msg = `🔧 **ฟีเจอร์ "${safeFeatureLabel}" ถูกปิดใช้งานชั่วคราว**\nผู้ดูแลระบบกำลังปรับปรุง กรุณารอสักครู่`;

    await respondToInteraction(interaction, msg, options);

    return false;
}

/**
 * Resolve gangId from a guild ID, then check feature flag.
 */
export async function checkFeatureForGuild(
    interaction: AnyInteraction,
    guildId: string | null | undefined,
    featureKey: string,
    featureLabel: string,
    options?: { alreadyDeferred?: boolean }
): Promise<{ gangId: string | null; allowed: boolean }> {
    if (!guildId) return { gangId: null, allowed: true };

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
        columns: { id: true },
    });

    if (!gang) return { gangId: null, allowed: true };

    const allowed = await checkFeatureEnabled(interaction, featureKey, featureLabel, options);
    return { gangId: gang.id, allowed };
}

export async function checkGangSubscriptionFeatureAccess(
    interaction: AnyInteraction,
    guildId: string | null | undefined,
    featureKey: TierFeatureKey,
    featureLabel: string,
    options?: GuardOptions
): Promise<{ gang: GuardGang | null; allowed: boolean }> {
    if (!await checkFeatureEnabled(interaction, featureKey, featureLabel, options)) {
        return { gang: null, allowed: false };
    }

    if (!guildId) {
        await respondToInteraction(interaction, '❌ ใช้ได้เฉพาะในเซิร์ฟเวอร์เท่านั้น', options);
        return { gang: null, allowed: false };
    }

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
        columns: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionExpiresAt: true,
            balance: true,
        },
    });

    if (!gang) {
        await respondToInteraction(interaction, '❌ ไม่พบแก๊งที่ผูกกับเซิร์ฟเวอร์นี้', options);
        return { gang: null, allowed: false };
    }

    const effectiveSubscriptionTier = resolveEffectiveSubscriptionTier(gang.subscriptionTier, gang.subscriptionExpiresAt);
    if (!canAccessFeature(effectiveSubscriptionTier, featureKey)) {
        const normalizedTier = normalizeSubscriptionTier(gang.subscriptionTier);
        const safeFeatureLabel = safeText(featureLabel, DEFAULT_FEATURE_LABEL);
        await respondToInteraction(
            interaction,
            `❌ แพลน ${normalizedTier} ยังไม่รองรับ ${safeFeatureLabel} ในตอนนี้`,
            options
        );
        return {
            gang: {
                id: gang.id,
                name: gang.name,
                subscriptionTier: gang.subscriptionTier,
                balance: gang.balance,
            },
            allowed: false,
        };
    }

    return {
        gang: {
            id: gang.id,
            name: gang.name,
            subscriptionTier: gang.subscriptionTier,
            balance: gang.balance,
        },
        allowed: true,
    };
}

export async function checkMemberSubscriptionFeatureAccess(
    interaction: AnyInteraction,
    guildId: string | null | undefined,
    discordId: string,
    featureKey: TierFeatureKey,
    featureLabel: string,
    options?: GuardOptions
): Promise<{ gang: GuardGang | null; member: GuardMember | null; allowed: boolean }> {
    const { gang, allowed } = await checkGangSubscriptionFeatureAccess(
        interaction,
        guildId,
        featureKey,
        featureLabel,
        options
    );

    if (!allowed || !gang) {
        return { gang, member: null, allowed: false };
    }

    const memberConditions = [
        eq(members.gangId, gang.id),
        eq(members.discordId, discordId),
        eq(members.isActive, true),
    ];

    if (options?.requireApprovedMember) {
        memberConditions.push(eq(members.status, 'APPROVED'));
    }

    const member = await db.query.members.findFirst({
        where: and(...memberConditions),
        columns: {
            id: true,
            name: true,
            discordId: true,
            gangId: true,
            gangRole: true,
            status: true,
            balance: true,
        },
    });

    if (!member) {
        await respondToInteraction(
            interaction,
            safeText(options?.missingMemberMessage, DEFAULT_MISSING_MEMBER_MESSAGE),
            options
        );
        return { gang, member: null, allowed: false };
    }

    return {
        gang,
        member: {
            id: member.id,
            name: member.name,
            discordId: member.discordId ?? discordId,
            gangId: member.gangId ?? gang.id,
            gangRole: member.gangRole,
            status: member.status,
            balance: member.balance,
        },
        allowed: true,
    };
}
