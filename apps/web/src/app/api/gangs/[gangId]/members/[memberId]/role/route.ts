import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangRoles, gangs, auditLogs } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

type GangRole = 'MEMBER' | 'ADMIN' | 'TREASURER';

// PATCH - Update member's gang role
export async function PATCH(
    request: NextRequest,
    { params }: { params: { gangId: string; memberId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId, memberId } = params;
        const body = await request.json();
        const { role } = body as { role: GangRole };

        // Validate role
        if (!['ADMIN', 'TREASURER', 'MEMBER'].includes(role)) {
            return NextResponse.json({ error: 'ยศไม่ถูกต้อง' }, { status: 400 });
        }

        // Get the member to update
        const member = await db.query.members.findFirst({
            where: and(eq(members.id, memberId), eq(members.gangId, gangId)),
        });

        if (!member) {
            return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
        }

        // Prevent changing OWNER role (should be handled manually or via dedicated flow)
        if (member.gangRole === 'OWNER') {
            return NextResponse.json({ error: 'ไม่สามารถเปลี่ยนยศหัวหน้าแก๊งได้' }, { status: 403 });
        }

        const oldRole = member.gangRole || 'MEMBER';

        const requester = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
        });

        if (!requester || !['OWNER', 'ADMIN'].includes(requester.gangRole || '')) {
            return new NextResponse('Forbidden: Insufficient Permissions', { status: 403 });
        }

        // Get gang info for Discord sync
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        // Get role mappings
        const roleMappings = await db.query.gangRoles.findMany({
            where: eq(gangRoles.gangId, gangId),
        });

        // Update member role in database
        await db.update(members)
            .set({ gangRole: role, updatedAt: new Date() })
            .where(eq(members.id, memberId));

        // Sync Discord roles
        if (member.discordId) {
            const botToken = process.env.DISCORD_BOT_TOKEN;
            if (botToken && gang.discordGuildId) {
                const oldRoleMapping = roleMappings.find(r => r.permissionLevel === oldRole);
                const newRoleMapping = roleMappings.find(r => r.permissionLevel === role);

                // Remove old role (if different and exists)
                if (oldRoleMapping && oldRoleMapping.discordRoleId !== newRoleMapping?.discordRoleId) {
                    try {
                        await fetch(
                            `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${oldRoleMapping.discordRoleId}`,
                            {
                                method: 'DELETE',
                                headers: { Authorization: `Bot ${botToken}` },
                            }
                        );
                    } catch (e) {
                        console.error('Failed to remove old Discord role:', e);
                    }
                }

                // Add new role
                if (newRoleMapping) {
                    try {
                        await fetch(
                            `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${newRoleMapping.discordRoleId}`,
                            {
                                method: 'PUT',
                                headers: { Authorization: `Bot ${botToken}` },
                            }
                        );
                    } catch (e) {
                        console.error('Failed to add new Discord role:', e);
                    }
                }
            }
        }

        // Audit log
        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'MEMBER_UPDATE',
            targetType: 'MEMBER',
            targetId: memberId,
            oldValue: JSON.stringify({ gangRole: oldRole }),
            newValue: JSON.stringify({ gangRole: role }),
        });

        return NextResponse.json({ success: true, role });
    } catch (error) {
        console.error('Error updating member role:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
