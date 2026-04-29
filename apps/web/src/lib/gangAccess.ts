import 'server-only';

import type { Session } from 'next-auth';
import { getAppSession } from '@/lib/appSession';
import { db, gangs, members } from '@gang/database';
import { and, eq } from 'drizzle-orm';
import { getGangPermissionFlags, type GangPermissionFlags, type GangPermissionLevel } from '@/lib/gangPermissionFlags';

export { getGangPermissionFlags };
export type { GangPermissionFlags, GangPermissionLevel };

type RequireGangAccessOptions = {
    gangId?: string;
    guildId?: string;
    minimumRole?: GangPermissionLevel;
};

type RequireGangAccessForDiscordIdOptions = RequireGangAccessOptions & {
    discordId: string | null | undefined;
};

type AuthorizedGangAccess = {
    gang: {
        id: string;
        discordGuildId: string;
        name: string;
        subscriptionTier: string | null;
        logoUrl: string | null;
    };
    member: {
        id: string;
        gangId: string;
        discordId: string | null;
        gangRole: string;
        name: string;
    };
    session: Session;
};

type AuthorizedGangAccessContext = Omit<AuthorizedGangAccess, 'session'>;

const ALLOWED_ROLES: Record<GangPermissionLevel, string[]> = {
    OWNER: ['OWNER'],
    ADMIN: ['OWNER', 'ADMIN'],
    TREASURER: ['OWNER', 'TREASURER'],
    ATTENDANCE_OFFICER: ['OWNER', 'ADMIN', 'ATTENDANCE_OFFICER'],
    MEMBER: ['OWNER', 'ADMIN', 'TREASURER', 'ATTENDANCE_OFFICER', 'MEMBER'],
};


export class GangAccessError extends Error {
    constructor(
        message: string,
        public readonly status: number
    ) {
        super(message);
        this.name = 'GangAccessError';
    }
}

export function isGangAccessError(error: unknown): error is GangAccessError {
    return error instanceof GangAccessError;
}

async function resolveGangAccess(
    options: RequireGangAccessOptions,
    discordId: string | null | undefined
): Promise<AuthorizedGangAccessContext> {
    const { gangId, guildId, minimumRole = 'MEMBER' } = options;

    if (!gangId && !guildId) {
        throw new GangAccessError('Missing gang identifier', 400);
    }

    if (!discordId) {
        throw new GangAccessError('Unauthorized', 401);
    }

    const gang = await db.query.gangs.findFirst({
        where: gangId ? eq(gangs.id, gangId) : eq(gangs.discordGuildId, guildId!),
        columns: {
            id: true,
            discordGuildId: true,
            name: true,
            subscriptionTier: true,
            logoUrl: true,
        },
    });

    if (!gang) {
        throw new GangAccessError('Gang not found', 404);
    }

    const member = await db.query.members.findFirst({
        where: and(
            eq(members.gangId, gang.id),
            eq(members.discordId, discordId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
        columns: {
            id: true,
            gangId: true,
            discordId: true,
            gangRole: true,
            name: true,
        },
    });

    if (!member) {
        throw new GangAccessError('Forbidden', 403);
    }

    if (!ALLOWED_ROLES[minimumRole].includes(member.gangRole)) {
        throw new GangAccessError('Forbidden', 403);
    }

    return { gang, member };
}

export async function requireGangAccess(
    options: RequireGangAccessOptions
): Promise<AuthorizedGangAccess> {
    const session = await getAppSession();
    const access = await resolveGangAccess(options, session?.user?.discordId);

    if (!session) {
        throw new GangAccessError('Unauthorized', 401);
    }

    return { ...access, session };
}

export async function requireGangAccessForDiscordId(
    options: RequireGangAccessForDiscordIdOptions
): Promise<AuthorizedGangAccessContext> {
    const { discordId, ...accessOptions } = options;
    return resolveGangAccess(accessOptions, discordId);
}

export async function getGangAccessContextForDiscordId(
    options: RequireGangAccessForDiscordIdOptions
): Promise<{ access: AuthorizedGangAccessContext | null; permissions: GangPermissionFlags }> {
    try {
        const access = await requireGangAccessForDiscordId(options);
        return {
            access,
            permissions: getGangPermissionFlags(access.member.gangRole),
        };
    } catch (error) {
        if (isGangAccessError(error)) {
            return {
                access: null,
                permissions: getGangPermissionFlags(null),
            };
        }

        throw error;
    }
}

export async function getGangPermissionFlagsForDiscordId(
    options: RequireGangAccessForDiscordIdOptions
): Promise<GangPermissionFlags> {
    const { permissions } = await getGangAccessContextForDiscordId(options);
    return permissions;
}
