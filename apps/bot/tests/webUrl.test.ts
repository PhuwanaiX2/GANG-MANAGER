import { describe, expect, it } from 'vitest';
import { resolvePublicWebUrl } from '../src/utils/webUrl';

describe('public web URL resolution', () => {
    it('does not allow localhost dashboard links in production', () => {
        expect(resolvePublicWebUrl({
            NODE_ENV: 'production',
            NEXTAUTH_URL: 'http://localhost:3000',
        } as NodeJS.ProcessEnv)).toBe('https://gang-manager.vercel.app');
    });

    it('keeps localhost links available during local development', () => {
        expect(resolvePublicWebUrl({
            NODE_ENV: 'development',
            NEXTAUTH_URL: 'http://localhost:3000',
        } as NodeJS.ProcessEnv)).toBe('http://localhost:3000');
    });

    it('prefers a configured public URL and strips trailing slashes', () => {
        expect(resolvePublicWebUrl({
            NODE_ENV: 'production',
            PUBLIC_WEB_URL: 'https://gang.example.com///',
            NEXTAUTH_URL: 'http://localhost:3000',
        } as NodeJS.ProcessEnv)).toBe('https://gang.example.com');
    });
});
