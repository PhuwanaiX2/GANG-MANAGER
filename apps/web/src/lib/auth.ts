import NextAuth, { NextAuthOptions } from 'next-auth';
import DiscordProvider from 'next-auth/providers/discord';

const useSecureCookies = process.env.NEXTAUTH_URL?.startsWith('https://') ?? false;

export const authOptions: NextAuthOptions = {
    providers: [
        DiscordProvider({
            clientId: process.env.DISCORD_CLIENT_ID!,
            clientSecret: process.env.DISCORD_CLIENT_SECRET!,
            authorization: {
                params: {
                    scope: 'identify guilds',
                },
            },
        }),
    ],
    cookies: {
        sessionToken: {
            name: `${useSecureCookies ? '__Secure-' : ''}next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
            },
        },
        callbackUrl: {
            name: `${useSecureCookies ? '__Secure-' : ''}next-auth.callback-url`,
            options: {
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
            },
        },
        csrfToken: {
            name: `${useSecureCookies ? '__Host-' : ''}next-auth.csrf-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
            },
        },
        pkceCodeVerifier: {
            name: `${useSecureCookies ? '__Secure-' : ''}next-auth.pkce.code_verifier`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
                maxAge: 60 * 15, // 15 minutes
            },
        },
        state: {
            name: `${useSecureCookies ? '__Secure-' : ''}next-auth.state`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: useSecureCookies,
                maxAge: 60 * 15, // 15 minutes
            },
        },
    },
    callbacks: {
        async jwt({ token, account, profile }) {
            if (account) {
                token.accessToken = account.access_token;
                token.discordId = (profile as any)?.id;
            }
            return token;
        },
        async session({ session, token }) {
            session.accessToken = token.accessToken as string;
            session.user.discordId = token.discordId as string;
            return session;
        },
    },
    secret: process.env.NEXTAUTH_SECRET,
};

// Extend types
declare module 'next-auth' {
    interface Session {
        accessToken: string;
        user: {
            discordId: string;
            name?: string | null;
            email?: string | null;
            image?: string | null;
        };
    }
}

declare module 'next-auth/jwt' {
    interface JWT {
        accessToken?: string;
        discordId?: string;
    }
}
