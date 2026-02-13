import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, attendanceSessions, attendanceRecords, members, transactions, leaveRequests, gangs, canAccessFeature } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { getGangPermissions } from '@/lib/permissions';

// GET - Get session details with records
export async function GET(
    request: NextRequest,
    { params }: { params: { gangId: string; sessionId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId, sessionId } = params;

        const attendanceSession = await db.query.attendanceSessions.findFirst({
            where: and(
                eq(attendanceSessions.id, sessionId),
                eq(attendanceSessions.gangId, gangId)
            ),
            with: {
                records: {
                    with: {
                        member: true,
                    },
                },
            },
        });

        if (!attendanceSession) {
            return NextResponse.json({ error: 'ไม่พบรอบเช็คชื่อ' }, { status: 404 });
        }

        // Get all members for this gang to show who hasn't checked in
        const allMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        // Calculate stats
        const checkedInMemberIds = new Set(attendanceSession.records.map(r => r.memberId));
        const notCheckedIn = allMembers.filter(m => !checkedInMemberIds.has(m.id));

        const stats = {
            total: allMembers.length,
            present: attendanceSession.records.filter(r => r.status === 'PRESENT').length,
            late: attendanceSession.records.filter(r => r.status === 'LATE').length,
            absent: attendanceSession.records.filter(r => r.status === 'ABSENT').length,
            leave: attendanceSession.records.filter(r => r.status === 'LEAVE').length,
            notCheckedIn: notCheckedIn.length,
        };

        return NextResponse.json({
            session: attendanceSession,
            stats,
            notCheckedIn,
        });
    } catch (error) {
        console.error('Error fetching session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update session status (ACTIVE/CLOSED)
export async function PATCH(
    request: NextRequest,
    { params }: { params: { gangId: string; sessionId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId, sessionId } = params;
        const body = await request.json();
        const { status } = body;

        if (!['ACTIVE', 'CLOSED', 'SCHEDULED'].includes(status)) {
            return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
        }

        // Check permissions
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
        }

        // Update status
        const updateData: any = { status };

        // Get session data for Discord operations
        const attendanceSession = await db.query.attendanceSessions.findFirst({
            where: eq(attendanceSessions.id, sessionId),
            with: { records: true },
        });

        if (!attendanceSession) {
            return NextResponse.json({ error: 'ไม่พบรอบเช็คชื่อ' }, { status: 404 });
        }

        const botToken = process.env.DISCORD_BOT_TOKEN;

        // === START SESSION: Send Discord message ===
        if (status === 'ACTIVE' && attendanceSession.status === 'SCHEDULED') {
            // Get gang settings for channel ID
            const { gangs } = await import('@gang/database');
            const gang = await db.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                with: { settings: true },
            });

            const channelId = gang?.settings?.attendanceChannelId;

            if (botToken && channelId) {
                try {
                    const startDate = new Date(attendanceSession.startTime);
                    const endDate = new Date(attendanceSession.endTime);

                    const embed = {
                        title: `📋 ${attendanceSession.sessionName}`,
                        description: `กดปุ่มด้านล่างเพื่อเช็คชื่อ`,
                        color: 0x57F287,
                        fields: [
                            {
                                name: '🟢 เปิดเช็คชื่อ',
                                value: `${startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
                                inline: true,
                            },
                            {
                                name: '🔴 หมดเขต',
                                value: `${endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`,
                                inline: true,
                            },
                        ],
                        footer: {
                            text: new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
                        },
                    };

                    const components = [
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 3,
                                    label: '✅ เช็คชื่อ',
                                    custom_id: `attendance_checkin_${sessionId}`,
                                },
                            ],
                        },
                    ];

                    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bot ${botToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            content: '@everyone 📢 **เปิดเช็คชื่อแล้ว!**',
                            embeds: [embed],
                            components,
                        }),
                    });

                    if (res.ok) {
                        const data = await res.json();
                        updateData.discordMessageId = data.id;
                        updateData.discordChannelId = channelId;
                    }
                } catch (e) {
                    console.error('Discord API error:', e);
                }
            }
        }

        // === CLOSE SESSION: Mark absent and update Discord ===
        if (status === 'CLOSED') {
            updateData.closedAt = new Date();

            // Mark all non-checked members as ABSENT
            const allMembers = await db.query.members.findMany({
                where: and(
                    eq(members.gangId, gangId),
                    eq(members.isActive, true),
                    eq(members.status, 'APPROVED')
                ),
            });

            const checkedInMemberIds = new Set(attendanceSession.records.map(r => r.memberId));
            const absentMembers = allMembers.filter(m => !checkedInMemberIds.has(m.id));

            // Insert ABSENT records AND Deduct Balance
            if (absentMembers.length > 0) {
                const { nanoid } = await import('nanoid');

                // Check if gang has finance feature for penalties
                const gangForTier = await db.query.gangs.findFirst({
                    where: eq(gangs.id, gangId),
                    columns: { subscriptionTier: true },
                });
                const hasFinance = gangForTier ? canAccessFeature(gangForTier.subscriptionTier, 'finance') : false;

                // Get actor for transaction log
                const actor = await db.query.members.findFirst({
                    where: and(eq(members.gangId, gangId), eq(members.discordId, session.user.discordId))
                });

                // Fetch APPROVED leave requests for these members
                const relevantLeaves = await db.query.leaveRequests.findMany({
                    where: and(
                        eq(leaveRequests.gangId, gangId),
                        eq(leaveRequests.status, 'APPROVED')
                    )
                });

                for (const member of absentMembers) {
                    // Check for covering leave
                    let status = 'ABSENT';
                    // Force penalty to 0 if gang doesn't have finance feature
                    let penalty = hasFinance ? attendanceSession.absentPenalty : 0;

                    const activeLeave = relevantLeaves.find(leave => {
                        if (leave.memberId !== member.id) return false;

                        const sessionStart = new Date(attendanceSession.startTime);
                        const leaveStart = new Date(leave.startDate);
                        const leaveEnd = new Date(leave.endDate);

                        // FULL Day Leave
                        if (leave.type === 'FULL') {
                            // Check if session date matches leave dates
                            return sessionStart >= leaveStart && sessionStart <= leaveEnd;
                        }

                        // LATE Leave
                        if (leave.type === 'LATE') {
                            // If Session Starts BEFORE Expected Arrival -> Excused (LEAVE)
                            // If Session Starts AFTER Expected Arrival -> Should be here -> ABSENT
                            return sessionStart < leaveStart;
                        }

                        return false;
                    });

                    if (activeLeave) {
                        status = 'LEAVE';
                        penalty = 0; // Excused
                    }

                    // 1. Create Attendance Record
                    await db.insert(attendanceRecords).values({
                        id: nanoid(),
                        sessionId,
                        memberId: member.id,
                        status,
                        penaltyAmount: penalty,
                    });

                    // 2. Deduct Balance & Create Transaction (if penalty > 0)
                    if (penalty > 0) {
                        try {
                            console.log(`[Attendance Penalty] Deducting ${penalty} from ${member.name} (${member.id})`);
                            const balanceBefore = member.balance;
                            const balanceAfter = balanceBefore - penalty;

                            // Update Member
                            await db.update(members)
                                .set({ balance: balanceAfter })
                                .where(eq(members.id, member.id));

                            // Fetch latest gang balance for accurate transaction log
                            const gang = await db.query.gangs.findFirst({
                                where: eq(gangs.id, gangId),
                                columns: { balance: true }
                            });
                            const currentGangBalance = gang?.balance || 0;

                            // Create Transaction (Log as event, but keeps Gang Balance unchanged)
                            await db.insert(transactions).values({
                                id: nanoid(),
                                gangId,
                                memberId: member.id,
                                type: 'PENALTY',
                                amount: penalty,
                                category: 'ATTENDANCE',
                                description: `ปรับเงิน ${member.name} ขาด (Session: ${attendanceSession.sessionName})`,
                                status: 'APPROVED',
                                balanceBefore: currentGangBalance,
                                balanceAfter: currentGangBalance,
                                createdById: actor?.id || 'SYSTEM',
                                createdAt: new Date(),
                            });
                            console.log(`[Attendance Penalty] ✅ Done for ${member.name}`);
                        } catch (penaltyError) {
                            console.error(`[Attendance Penalty] ❌ Failed for ${member.name}:`, penaltyError);
                        }
                    }
                }
            }

            // Update Discord message to show closed
            if (botToken && attendanceSession.discordChannelId && attendanceSession.discordMessageId) {
                try {
                    await fetch(`https://discord.com/api/v10/channels/${attendanceSession.discordChannelId}/messages/${attendanceSession.discordMessageId}`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bot ${botToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            components: [
                                {
                                    type: 1,
                                    components: [
                                        {
                                            type: 2,
                                            style: 2,
                                            label: '🔒 ปิดแล้ว',
                                            custom_id: `attendance_closed_${sessionId}`,
                                            disabled: true,
                                        },
                                    ],
                                },
                            ],
                        }),
                    });
                } catch (e) {
                    console.error('Failed to update Discord message:', e);
                }
            }
        }

        await db.update(attendanceSessions)
            .set(updateData)
            .where(eq(attendanceSessions.id, sessionId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete session
export async function DELETE(
    request: NextRequest,
    { params }: { params: { gangId: string; sessionId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId, sessionId } = params;

        // Check permissions
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isOwner) {
            return NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้นที่ลบได้' }, { status: 403 });
        }

        await db.delete(attendanceSessions).where(eq(attendanceSessions.id, sessionId));

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
