import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, auditLogs, gangs, gangRoles } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const updateMemberSchema = z.object({
    name: z.string().min(1).optional(),
    balance: z.number().optional(),
    isActive: z.boolean().optional(),
});

interface RouteParams {
    params: {
        gangId: string;
        memberId: string;
    };
}

// PATCH: Update member details
export async function PATCH(req: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const body = await req.json();
        const validatedData = updateMemberSchema.parse(body);
        const { gangId, memberId } = params;

        // Verify Permissions
        const permissions = await getGangPermissions(gangId, session.user.discordId);

        // 1. Balance Update: STRICT (Treasurer/Owner only)
        if (validatedData.balance !== undefined) {
            if (!permissions.isTreasurer && !permissions.isOwner) {
                return new NextResponse('Forbidden: Only Treasurer or Owner can update balance', { status: 403 });
            }
        }

        // 2. Name/Status Update: (Admin/Owner only)
        if (validatedData.name !== undefined || validatedData.isActive !== undefined) {
            if (!permissions.isAdmin && !permissions.isOwner) {
                // Optional: Allow user to update their own name? For now, strict Admin only.
                return new NextResponse('Forbidden: Only Admin or Owner can update member details', { status: 403 });
            }
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
        console.error('[MEMBER_UPDATE_ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}

// DELETE: Remove/Kick member
export async function DELETE(req: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const { gangId, memberId } = params;

        // Verify Permissions (Admin/Owner only)
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner) {
            return new NextResponse('Forbidden: Only Admin or Owner can kick members', { status: 403 });
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
                            await fetch(`https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${role.discordRoleId}`, {
                                method: 'DELETE',
                                headers: {
                                    Authorization: `Bot ${botToken}`,
                                },
                            });
                        } catch (e) {
                            console.error(`Failed to remove role ${role.discordRoleId}`, e);
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
        console.error('[MEMBER_DELETE_ERROR]', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
