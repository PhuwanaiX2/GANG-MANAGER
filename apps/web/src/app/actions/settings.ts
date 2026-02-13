'use server';

import { db, gangRoles, gangSettings } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { revalidatePath } from 'next/cache';

export async function updateGangRoles(
    gangId: string,
    mappings: Array<{ permission: 'OWNER' | 'ADMIN' | 'TREASURER' | 'MEMBER', roleId: string }>
) {
    try {
        console.log(`Updating roles for gang ${gangId}`, mappings);

        // We could use a transaction here for safety
        await db.transaction(async (tx) => {
            for (const map of mappings) {
                // Check if mapping for this permission exists
                const existing = await tx.query.gangRoles.findFirst({
                    where: and(
                        eq(gangRoles.gangId, gangId),
                        eq(gangRoles.permissionLevel, map.permission)
                    )
                });

                if (existing) {
                    // Update connection
                    // If user selects "None" (empty string), we might want to delete? 
                    // But here we assume valid roleId.
                    if (map.roleId) {
                        await tx.update(gangRoles)
                            .set({ discordRoleId: map.roleId })
                            .where(eq(gangRoles.id, existing.id));
                    }
                } else {
                    // Insert new
                    if (map.roleId) {
                        await tx.insert(gangRoles).values({
                            id: nanoid(),
                            gangId: gangId,
                            permissionLevel: map.permission,
                            discordRoleId: map.roleId
                        });
                    }
                }
            }
        });

        revalidatePath(`/dashboard/${gangId}/settings`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update gang roles:', error);
        return { success: false, error: 'Database error' };
    }
}

export async function updateGangSettings(
    gangId: string,
    settings: {
        logChannelId?: string;
        registerChannelId?: string;
        attendanceChannelId?: string;
        financeChannelId?: string;
        announcementChannelId?: string;
        leaveChannelId?: string;
        requestsChannelId?: string;
    }
) {
    try {
        console.log(`Updating settings for gang ${gangId}`, settings);

        await db.update(gangSettings)
            .set(settings)
            .where(eq(gangSettings.gangId, gangId));

        revalidatePath(`/dashboard/${gangId}/settings`);
        return { success: true };
    } catch (error) {
        console.error('Failed to update gang settings:', error);
        return { success: false, error: 'Database error' };
    }
}

