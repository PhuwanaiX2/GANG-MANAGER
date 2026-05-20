import { describe, expect, it } from 'vitest';
import { getOptimizedCloudinaryImageUrl, getOptimizedAvatarUrl } from '@/lib/imageUrls';

describe('image URL helpers', () => {
    it('adds a bounded Cloudinary transform for gang logos and avatars', () => {
        const optimized = getOptimizedCloudinaryImageUrl(
            'https://res.cloudinary.com/demo/image/upload/v123/gangs/logo.png',
            { width: 96, height: 96 }
        );

        expect(optimized).toBe('https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,c_fill,w_96,h_96/v123/gangs/logo.png');
    });

    it('does not rewrite non-Cloudinary image URLs', () => {
        const discordUrl = 'https://cdn.discordapp.com/avatars/1/avatar.png';

        expect(getOptimizedAvatarUrl(discordUrl)).toBe(discordUrl);
    });
});
