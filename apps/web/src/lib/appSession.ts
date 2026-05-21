import 'server-only';

import * as React from 'react';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/lib/auth';

const cacheRequest = (React as typeof React & { cache?: <T extends (...args: any[]) => any>(fn: T) => T }).cache
    ?? (<T extends (...args: any[]) => any>(fn: T) => fn);

export const getAppSession = cacheRequest(async (): Promise<Session | null> => {
    return getServerSession(authOptions);
});

export async function requireAppSession(): Promise<Session> {
    const session = await getAppSession();

    if (!session?.user?.discordId) {
        throw new Error('Unauthorized');
    }

    return session;
}
