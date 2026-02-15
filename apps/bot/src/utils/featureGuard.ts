import { ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { db, FeatureFlagService, gangs } from '@gang/database';
import { eq } from 'drizzle-orm';

type AnyInteraction = ButtonInteraction | ChatInputCommandInteraction | ModalSubmitInteraction;

/**
 * Check if a feature is globally enabled.
 * If disabled, replies to the interaction and returns false.
 * If enabled, returns true (caller should proceed).
 */
export async function checkFeatureEnabled(
    interaction: AnyInteraction,
    featureKey: string,
    featureLabel: string,
    options?: { alreadyDeferred?: boolean }
): Promise<boolean> {
    const enabled = await FeatureFlagService.isEnabled(db, featureKey);
    if (enabled) return true;

    const msg = `🔧 **ฟีเจอร์ "${featureLabel}" ถูกปิดใช้งานชั่วคราว**\nผู้ดูแลระบบกำลังปรับปรุง กรุณารอสักครู่`;

    if (options?.alreadyDeferred) {
        await interaction.editReply(msg);
    } else if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg);
    } else {
        await (interaction as any).reply({ content: msg, ephemeral: true });
    }

    return false;
}

/**
 * Resolve gangId from a guild ID, then check feature flag.
 * Returns { gangId, allowed } — if not allowed, already replied.
 */
export async function checkFeatureForGuild(
    interaction: AnyInteraction,
    guildId: string | null | undefined,
    featureKey: string,
    featureLabel: string,
    options?: { alreadyDeferred?: boolean }
): Promise<{ gangId: string | null; allowed: boolean }> {
    if (!guildId) return { gangId: null, allowed: true }; // let downstream handle missing guild

    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.discordGuildId, guildId),
        columns: { id: true },
    });

    if (!gang) return { gangId: null, allowed: true }; // let downstream handle missing gang

    const allowed = await checkFeatureEnabled(interaction, featureKey, featureLabel, options);
    return { gangId: gang.id, allowed };
}
