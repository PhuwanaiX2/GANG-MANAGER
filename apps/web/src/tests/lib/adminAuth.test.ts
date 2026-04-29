import { afterEach, describe, expect, it } from 'vitest';
import { getAdminDiscordIds, isAdminDiscordId } from '@/lib/adminAuth';

describe('adminAuth', () => {
    const originalAdminIds = process.env.ADMIN_DISCORD_IDS;

    afterEach(() => {
        process.env.ADMIN_DISCORD_IDS = originalAdminIds;
    });

    it('trims configured admin IDs and ignores empty entries', () => {
        expect(getAdminDiscordIds(' admin-1,admin-2, , admin-3 ')).toEqual([
            'admin-1',
            'admin-2',
            'admin-3',
        ]);
    });

    it('matches admins even when env values contain spaces', () => {
        process.env.ADMIN_DISCORD_IDS = ' admin-1, admin-2 ';

        expect(isAdminDiscordId('admin-2')).toBe(true);
        expect(isAdminDiscordId(' admin-2 ')).toBe(false);
        expect(isAdminDiscordId('user-1')).toBe(false);
    });
});
