import { db, gangRoles, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';

interface PermissionResult {
    level: 'OWNER' | 'ADMIN' | 'TREASURER' | 'MEMBER' | 'NONE';
    isOwner: boolean;
    isAdmin: boolean;
    isTreasurer: boolean;
    isMember: boolean;
}

export async function getGangPermissions(gangId: string, userId: string): Promise<PermissionResult> {
    const result: PermissionResult = {
        level: 'NONE',
        isOwner: false,
        isAdmin: false,
        isTreasurer: false,
        isMember: false,
    };

    try {
        // 1. Get Gang details for Guild ID
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
        });

        if (!gang) return result;

        // 2. [DEPRECATED] Fetch User's Roles from Discord API
        // We now use the database as the source of truth for Permissions.
        // We only use the DB member record.

        // 3. Find Member in DB
        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, userId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        if (!member) return result;

        result.isMember = true; // If they are in DB, they are at least a member (pending or approved checked below?)
        // Note: The logic call usually assumes if they have a record, they have access? 
        // Or should we check status? 'APPROVED'?
        // The previous logic didn't check status, just role possession.
        // Let's assume if they are in DB with a role, they have that role.

        const role = member.gangRole as string;

        if (role === 'OWNER') {
            result.isOwner = true;
            result.isAdmin = true;
            result.isTreasurer = true;
            result.isMember = true;
        } else if (role === 'ADMIN') {
            result.isAdmin = true;
            result.isMember = true;
        } else if (role === 'TREASURER') {
            result.isTreasurer = true;
        } else if (role === 'MEMBER') {
            result.isMember = true;
        }

        // Set highest level string for convenience
        if (result.isOwner) result.level = 'OWNER';
        else if (result.isAdmin) result.level = 'ADMIN';
        else if (result.isTreasurer) result.level = 'TREASURER';
        else if (result.isMember) result.level = 'MEMBER';

        return result;

    } catch (error) {
        console.error('Permission check error:', error);
        return result;
    }
}
