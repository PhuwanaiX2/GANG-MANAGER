import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, auditLogs, gangs, gangRoles } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { logError, logWarn } from '@/lib/logger';
import { checkTierAccess } from '@/lib/tierGuard';

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

const updateMemberSchema = z.object({
    name: z.string().min(1).optional(),
    balance: z.number().optional(),
    isActive: z.boolean().optional(),
});

interface RouteParams {
    params: Promise<{
        gangId: string;
        memberId: string;
    }>;
}

async function enforceMemberMutationRateLimit(
    req: Request,
    gangId: string,
    memberId: string,
    actorDiscordId: string,
    action: 'update' | 'delete'
) {
    return enforceRouteRateLimit(req, {
        scope: `api:members:${action}`,
        limit: action === 'delete' ? 20 : 40,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('members', action, gangId, memberId, actorDiscordId),
    });
}

async function requireMemberMutationAccess(
    gangId: string,
    minimumRole: 'ADMIN' | 'TREASURER',
    forbiddenMessage: string
) {
    try {
        await requireGangAccess({ gangId, minimumRole });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return new NextResponse(forbiddenMessage, { status: 403 });
        }

        throw error;
    }
}

// PATCH: Update member details
export async function PATCH(req: Request, props: RouteParams) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await req.json();
        const validatedData = updateMemberSchema.parse(body);
        const { gangId, memberId } = params;
        const hasUpdateField = validatedData.name !== undefined
            || validatedData.balance !== undefined
            || validatedData.isActive !== undefined;

        if (!hasUpdateField) {
            return NextResponse.json({ error: 'No member update fields provided' }, { status: 400 });
        }

        // 1. Balance Update: STRICT (Treasurer/Owner only)
        if (validatedData.balance !== undefined) {
            const forbiddenResponse = await requireMemberMutationAccess(
                gangId,
                'TREASURER',
                'Forbidden: Only Treasurer or Owner can update balance'
            );
            if (forbiddenResponse) {
                return forbiddenResponse;
            }

            const tierCheck = await checkTierAccess(gangId, 'finance');
            if (!tierCheck.allowed) {
                return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
            }
        }

        // 2. Name/Status Update: (Admin/Owner only)
        if (validatedData.name !== undefined || validatedData.isActive !== undefined) {
            const forbiddenResponse = await requireMemberMutationAccess(
                gangId,
                'ADMIN',
                'Forbidden: Only Admin or Owner can update member details'
            );
            if (forbiddenResponse) {
                return forbiddenResponse;
            }
        }

        const rateLimited = await enforceMemberMutationRateLimit(
            req,
            gangId,
            memberId,
            session.user.discordId,
            'update'
        );
        if (rateLimited) {
            return rateLimited;
        }

        // Protect Owner from being deactivated
        if (validatedData.isActive === false) {
            const targetMember = await db.query.members.findFirst({
                where: and(eq(members.id, memberId), eq(members.gangId, gangId)),
                columns: { gangRole: true },
            });
            if (targetMember?.gangRole === 'OWNER') {
                return NextResponse.json({ error: 'ไม่สามารถปิด Active ของหัวหน้าแก๊งได้' }, { status: 403 });
            }
        }

        // Perform Update
        await db.update(members)
            .set({
                ...validatedData,
                updatedAt: new Date(),
            })
            .where(and(eq(members.id, memberId), eq(members.gangId, gangId)));

        // Create Audit Log
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'UPDATE_MEMBER',
            targetType: 'MEMBER',
            targetId: memberId,
            newValue: JSON.stringify(validatedData),
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: 'Invalid member update payload' }, { status: 400 });
        }

        logError('api.members.update.failed', error, {
            gangId: params.gangId,
            memberId: params.memberId,
            actorDiscordId: session.user.discordId,
        });
        return new NextResponse('Internal Error', { status: 500 });
    }
}

// DELETE: Remove/Kick member
export async function DELETE(req: Request, props: RouteParams) {
    const params = await props.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { gangId, memberId } = params;

        // Verify Permissions (Admin/Owner only)
        const forbiddenResponse = await requireMemberMutationAccess(
            gangId,
            'ADMIN',
            'Forbidden: Only Admin or Owner can kick members'
        );
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceMemberMutationRateLimit(
            req,
            gangId,
            memberId,
            session.user.discordId,
            'delete'
        );
        if (rateLimited) {
            return rateLimited;
        }

        // 1. Get Member Info
        const member = await db.query.members.findFirst({
            where: and(eq(members.id, memberId), eq(members.gangId, gangId)),
        });

        if (!member) return new NextResponse('Member not found', { status: 404 });

        // Protect Owner from being kicked
        if (member.gangRole === 'OWNER') {
            return new NextResponse('Cannot kick the Gang Owner', { status: 403 });
        }

        // 2. Remove Discord Roles (if linked)
        if (member.discordId) {
            const gang = await db.query.gangs.findFirst({ where: eq(gangs.id, gangId) });
            const roles = await db.query.gangRoles.findMany({ where: eq(gangRoles.gangId, gangId) }); // Correct logic for gangRoles query

            if (gang && roles.length > 0) {
                const botToken = process.env.DISCORD_BOT_TOKEN;
                if (botToken) {
                    for (const role of roles) {
                        try {
                            // Note: In a real app, you might only remove roles mapped to 'MEMBER' level, etc.
                            // For simplicity, we try to remove all connected gang roles.
                            const response = await fetch(`https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${role.discordRoleId}`, {
                                method: 'DELETE',
                                headers: {
                                    Authorization: `Bot ${botToken}`,
                                },
                            });

                            if (!response.ok) {
                                const responseBody = await readResponseText(response);
                                logWarn('api.members.delete.discord_role_remove_failed', {
                                    gangId,
                                    memberId,
                                    discordId: member.discordId,
                                    roleId: role.discordRoleId,
                                    statusCode: response.status,
                                    responseBody,
                                });
                            }
                        } catch (e) {
                            logWarn('api.members.delete.discord_role_remove_error', {
                                gangId,
                                memberId,
                                discordId: member.discordId,
                                roleId: role.discordRoleId,
                                error: e,
                            });
                        }
                    }
                }
            }
        }

        // 3. Perform Soft Delete (Kick) -> Status: REJECTED, isActive: false
        await db.update(members)
            .set({ isActive: false, status: 'REJECTED' })
            .where(and(eq(members.id, memberId), eq(members.gangId, gangId)));

        // 4. Log
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'MEMBER_KICK',
            targetType: 'MEMBER',
            targetId: memberId,
            newValue: JSON.stringify({ status: 'REJECTED', reason: 'Kicked by Admin' })
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('api.members.delete.failed', error, {
            gangId: params.gangId,
            memberId: params.memberId,
            actorDiscordId: session.user.discordId,
        });
        return new NextResponse('Internal Error', { status: 500 });
    }
}
