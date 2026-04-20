import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, members, gangs, gangRoles, auditLogs } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

type MemberStatus = 'APPROVED' | 'REJECTED';

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
        const { status } = body as { status?: MemberStatus };

        if (!status || !['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'สถานะสมาชิกไม่ถูกต้อง' }, { status: 400 });
        }

        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
        }

        const member = await db.query.members.findFirst({
            where: and(eq(members.id, memberId), eq(members.gangId, gangId)),
        });

        if (!member) {
            return NextResponse.json({ error: 'ไม่พบสมาชิก' }, { status: 404 });
        }

        if (member.gangRole === 'OWNER' && status === 'REJECTED') {
            return NextResponse.json({ error: 'ไม่สามารถปฏิเสธหัวหน้าแก๊งได้' }, { status: 403 });
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { discordGuildId: true, transferStatus: true },
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        const updateData: {
            status: MemberStatus;
            isActive: boolean;
            updatedAt: Date;
            transferStatus?: 'CONFIRMED';
        } = {
            status,
            isActive: status === 'APPROVED',
            updatedAt: new Date(),
        };

        if (status === 'APPROVED' && gang.transferStatus === 'ACTIVE') {
            updateData.transferStatus = 'CONFIRMED';
        }

        await db.update(members)
            .set(updateData)
            .where(and(eq(members.id, memberId), eq(members.gangId, gangId)));

        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken && gang.discordGuildId && member.discordId) {
            const roleMappings = await db.query.gangRoles.findMany({
                where: eq(gangRoles.gangId, gangId),
            });
            const memberRole = member.gangRole || 'MEMBER';
            const roleMapping = roleMappings.find((role) => role.permissionLevel === memberRole);

            if (status === 'APPROVED' && roleMapping) {
                try {
                    await fetch(
                        `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${roleMapping.discordRoleId}`,
                        {
                            method: 'PUT',
                            headers: { Authorization: `Bot ${botToken}` },
                        }
                    );
                } catch (error) {
                    console.error('Failed to assign Discord role during approval:', error);
                }

                try {
                    await fetch(
                        `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                Authorization: `Bot ${botToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ nick: member.name }),
                        }
                    );
                } catch (error) {
                    console.error('Failed to update nickname during approval:', error);
                }
            }

            if (status === 'REJECTED' && roleMapping) {
                try {
                    await fetch(
                        `https://discord.com/api/v10/guilds/${gang.discordGuildId}/members/${member.discordId}/roles/${roleMapping.discordRoleId}`,
                        {
                            method: 'DELETE',
                            headers: { Authorization: `Bot ${botToken}` },
                        }
                    );
                } catch (error) {
                    console.error('Failed to remove Discord role during rejection:', error);
                }
            }
        }

        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: status === 'APPROVED' ? 'MEMBER_APPROVE' : 'MEMBER_REJECT',
            targetType: 'MEMBER',
            targetId: memberId,
            oldValue: JSON.stringify({
                status: member.status,
                isActive: member.isActive,
                transferStatus: member.transferStatus,
            }),
            newValue: JSON.stringify(updateData),
        });

        return NextResponse.json({ success: true, status });
    } catch (error) {
        console.error('[MEMBER_STATUS_UPDATE_ERROR]', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
