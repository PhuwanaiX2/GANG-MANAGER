import 'server-only';

import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getAppSession(): Promise<Session | null> {
    return getServerSession(authOptions);
}

export async function requireAppSession(): Promise<Session> {
    const session = await getAppSession();

    if (!session?.user?.discordId) {
        throw new Error('Unauthorized');
    }

    return session;
}
