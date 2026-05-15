import { afterEach, describe, expect, it, vi } from 'vitest';

describe('auth session callbacks', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env = { ...originalEnv };
        vi.resetModules();
    });

    it('does not store or expose the Discord OAuth access token', async () => {
        process.env.DISCORD_CLIENT_ID = 'discord-client';
        process.env.DISCORD_CLIENT_SECRET = 'discord-secret';
        process.env.NEXTAUTH_SECRET = 'nextauth-secret';

        const { authOptions } = await import('@/lib/auth');
        const jwtCallback = authOptions.callbacks?.jwt;
        const sessionCallback = authOptions.callbacks?.session;

        expect(jwtCallback).toBeTypeOf('function');
        expect(sessionCallback).toBeTypeOf('function');

        const token = await jwtCallback!({
            token: {},
            account: { access_token: 'discord-oauth-token' },
            profile: { id: 'discord-123' },
        } as any);

        expect(token).toMatchObject({ discordId: 'discord-123' });
        expect(token).not.toHaveProperty('accessToken');

        const session = await sessionCallback!({
            session: { user: { name: 'Tester', email: null, image: null } },
            token,
        } as any);

        expect(session.user.discordId).toBe('discord-123');
        expect(session).not.toHaveProperty('accessToken');
    });

    it('uses secure NextAuth cookies when NEXTAUTH_URL is https', async () => {
        process.env.DISCORD_CLIENT_ID = 'discord-client';
        process.env.DISCORD_CLIENT_SECRET = 'discord-secret';
        process.env.NEXTAUTH_SECRET = 'nextauth-secret';
        process.env.NEXTAUTH_URL = 'https://gang.example.com';

        const { authOptions } = await import('@/lib/auth');
        const cookies = authOptions.cookies!;

        expect(cookies.sessionToken.name).toBe('__Secure-next-auth.session-token');
        expect(cookies.callbackUrl.name).toBe('__Secure-next-auth.callback-url');
        expect(cookies.csrfToken.name).toBe('__Host-next-auth.csrf-token');
        expect(cookies.pkceCodeVerifier.name).toBe('__Secure-next-auth.pkce.code_verifier');
        expect(cookies.state.name).toBe('__Secure-next-auth.state');

        for (const cookie of Object.values(cookies)) {
            expect(cookie.options.secure).toBe(true);
            expect(cookie.options.path).toBe('/');
        }
        expect(cookies.csrfToken.options).not.toHaveProperty('domain');
    });

    it('keeps local development cookies non-secure for localhost OAuth', async () => {
        process.env.DISCORD_CLIENT_ID = 'discord-client';
        process.env.DISCORD_CLIENT_SECRET = 'discord-secret';
        process.env.NEXTAUTH_SECRET = 'nextauth-secret';
        process.env.NEXTAUTH_URL = 'http://localhost:3000';

        const { authOptions } = await import('@/lib/auth');
        const cookies = authOptions.cookies!;

        expect(cookies.sessionToken.name).toBe('next-auth.session-token');
        expect(cookies.callbackUrl.name).toBe('next-auth.callback-url');
        expect(cookies.csrfToken.name).toBe('next-auth.csrf-token');
        expect(cookies.pkceCodeVerifier.name).toBe('next-auth.pkce.code_verifier');
        expect(cookies.state.name).toBe('next-auth.state');

        for (const cookie of Object.values(cookies)) {
            expect(cookie.options.secure).toBe(false);
        }
    });
});
