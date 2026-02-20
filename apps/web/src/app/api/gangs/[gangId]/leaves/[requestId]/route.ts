import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, leaveRequests, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { getGangPermissions } from '@/lib/permissions';
import { isFeatureEnabled } from '@/lib/tierGuard';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { gangId: string; requestId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId, requestId } = params;

        // Global feature flag check
        if (!await isFeatureEnabled('leave')) {
            return NextResponse.json({ error: 'ฟีเจอร์นี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ' }, { status: 503 });
        }

        const body = await request.json();
        const { status, startDate, endDate } = body;

        // PERMISSION CHECK
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
        }

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
        }

        // Get the leave request first to get member info
        const leaveRequest = await db.query.leaveRequests.findFirst({
            where: and(
                eq(leaveRequests.id, requestId),
                eq(leaveRequests.gangId, gangId)
            ),
            with: {
                member: true,
            }
        });

        if (!leaveRequest) {
            return NextResponse.json({ error: 'ไม่พบคำขอลา' }, { status: 404 });
        }

        // Check if already processed (prevent double-confirm from bot + web)
        if (leaveRequest.status !== 'PENDING') {
            const statusText = leaveRequest.status === 'APPROVED' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว';
            return NextResponse.json({ error: `คำขอลานี้ถูกดำเนินการไปแล้ว (${statusText})` }, { status: 409 });
        }

        // Get Reviewer Member ID
        const reviewer = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
        });

        if (!reviewer) {
            return NextResponse.json({ error: 'ไม่พบข้อมูลผู้ตรวจสอบ' }, { status: 404 });
        }

        // Prepare update data
        const updateData: any = {
            status,
            reviewedAt: new Date(),
            reviewedById: reviewer.id,
        };

        if (startDate) updateData.startDate = new Date(startDate);
        if (endDate) updateData.endDate = new Date(endDate);

        // Update status and dates
        const [updatedRequest] = await db.update(leaveRequests)
            .set(updateData)
            .where(
                and(
                    eq(leaveRequests.id, requestId),
                    eq(leaveRequests.gangId, gangId)
                )
            )
            .returning();

        // === SEND AUDIT LOG TO ADMIN CHANNEL ===
        if (updatedRequest) {
            try {
                // Fetch Gang Settings for Log Channel ID
                const gang = await db.query.gangs.findFirst({
                    where: eq(gangs.id, gangId),
                    with: {
                        settings: true,
                    }
                });

                const logChannelId = gang?.settings?.logChannelId;

                if (logChannelId && process.env.DISCORD_BOT_TOKEN) {
                    const isApproved = status === 'APPROVED';
                    const memberName = leaveRequest.member?.name || 'Unknown';
                    const reviewerName = session.user.name || session.user.discordId;

                    // Format date info based on type
                    let dateInfo = '';
                    if (leaveRequest.type === 'FULL') {
                        dateInfo = `${new Date(updatedRequest.startDate).toLocaleDateString('th-TH')} - ${new Date(updatedRequest.endDate).toLocaleDateString('th-TH')}`;
                    } else {
                        // LATE type - show expected arrival time
                        dateInfo = `เข้า ${new Date(updatedRequest.startDate).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`;
                    }

                    const embed = {
                        title: isApproved
                            ? (leaveRequest.type === 'FULL' ? 'อนุมัติการลา' : 'รับทราบการเข้าช้า')
                            : (leaveRequest.type === 'FULL' ? 'ปฏิเสธการลา' : 'ปฏิเสธการเข้าช้า'),
                        description: [
                            `**ผู้ขอ:** ${memberName}`,
                            `**ประเภท:** ${leaveRequest.type === 'FULL' ? 'ลาหยุด' : 'เข้าช้า'}`,
                            `**${leaveRequest.type === 'FULL' ? 'วันที่' : 'เวลา'}:** ${dateInfo}`,
                            `**เหตุผล:** ${leaveRequest.reason}`,
                            ``,
                            `**ผู้ดำเนินการ:** ${reviewerName}`,
                        ].join('\n'),
                        color: isApproved ? 0x57F287 : 0xED4245, // Green or Red
                        timestamp: new Date().toISOString(),
                    };

                    await fetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ embeds: [embed] }),
                    });
                }
            } catch (err) {
                console.error('Failed to send audit log to Discord:', err);
                // Don't fail the request just because notification failed
            }

            // === SEND DM NOTIFICATION TO LEAVE REQUESTER ===
            if (leaveRequest.member?.discordId && process.env.DISCORD_BOT_TOKEN) {
                try {
                    const isApproved = status === 'APPROVED';
                    const statusText = isApproved ? '✅ อนุมัติ' : '❌ ปฏิเสธ';
                    const color = isApproved ? 0x57F287 : 0xED4245;
                    const reviewerName = session.user.name || session.user.discordId;

                    // Open DM channel first
                    const dmChannelRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ recipient_id: leaveRequest.member.discordId }),
                    });

                    if (dmChannelRes.ok) {
                        const dmChannel = await dmChannelRes.json();
                        const dmText = status === 'APPROVED'
                            ? `✅ รายการลาของคุณได้รับอนุมัติแล้วครับ`
                            : `❌ รายการลาของคุณถูกปฏิเสธครับ`;

                        await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ content: dmText }),
                        });
                    }
                } catch (dmErr) {
                    console.error('Failed to send DM to leave requester:', dmErr);
                    // Don't fail the request just because DM failed
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating leave request:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

