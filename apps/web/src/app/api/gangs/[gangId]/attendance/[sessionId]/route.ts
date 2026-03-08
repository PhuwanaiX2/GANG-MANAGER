import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, attendanceSessions, attendanceRecords, members, transactions, leaveRequests, gangs, canAccessFeature } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
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

        if (!['ACTIVE', 'CLOSED', 'SCHEDULED', 'CANCELLED'].includes(status)) {
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
                                name: '🟢 เปิด',
                                value: `${startDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                                inline: true,
                            },
                            {
                                name: '🔴 หมดเขต',
                                value: `${endDate.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                                inline: true,
                            },
                            {
                                name: '✅ เช็คชื่อแล้ว (0 คน)',
                                value: '> *ยังไม่มีใครเช็คชื่อ*',
                            },
                        ],
                        footer: {
                            text: new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
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
                        {
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 4,
                                    label: '🔒 ปิดรอบ',
                                    custom_id: `attendance_close_${sessionId}`,
                                },
                                {
                                    type: 2,
                                    style: 2,
                                    label: '❌ ยกเลิกรอบ',
                                    custom_id: `attendance_cancel_${sessionId}`,
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

            // Fetch APPROVED leave requests for these members (needed for penalty & summary)
            let relevantLeaves: any[] = [];
            if (absentMembers.length > 0) {
                relevantLeaves = await db.query.leaveRequests.findMany({
                    where: and(
                        eq(leaveRequests.gangId, gangId),
                        eq(leaveRequests.status, 'APPROVED')
                    )
                });
            }

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

                // 1. Prepare Batch Insert for Attendance Records
                const attendanceRecordsToInsert: any[] = [];
                const membersToPenalize: { member: typeof absentMembers[0], penalty: number }[] = [];

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

                    // Prepare Record
                    attendanceRecordsToInsert.push({
                        id: nanoid(),
                        sessionId,
                        memberId: member.id,
                        status,
                        penaltyAmount: penalty,
                    });

                    // Prepare Financial Update (if penalty > 0)
                    if (penalty > 0) {
                        membersToPenalize.push({ member, penalty });
                    }
                }

                // Execute Batch Insert: Attendance Records
                if (attendanceRecordsToInsert.length > 0) {
                    try {
                        await db.insert(attendanceRecords).values(attendanceRecordsToInsert);
                        console.log(`[Batch Insert] Successfully inserted ${attendanceRecordsToInsert.length} attendance records.`);
                    } catch (batchError) {
                        console.error('[Batch Insert] Failed to insert attendance records:', batchError);
                        // In a real scenario, we might want to throw here or retry, 
                        // but since these are system-generated IDs, collision is unlikely.
                    }
                }

                // Execute Financial Updates (sequential, each in its own DB transaction with OCC)
                if (membersToPenalize.length > 0) {
                    console.log(`[Financial Update] Processing ${membersToPenalize.length} penalties...`);

                    let successCount = 0;
                    for (const { member, penalty } of membersToPenalize) {
                        try {
                            await db.transaction(async (tx: any) => {
                                // Re-fetch current balance inside transaction
                                const currentMember = await tx.query.members.findFirst({
                                    where: eq(members.id, member.id),
                                    columns: { balance: true }
                                });
                                if (!currentMember) return;

                                // OCC: update only if balance hasn't changed since read
                                const memberResult = await tx.update(members)
                                    .set({ balance: sql`balance - ${penalty}` })
                                    .where(and(eq(members.id, member.id), eq(members.balance, currentMember.balance)))
                                    .returning({ updatedId: members.id });

                                if (memberResult.length === 0) {
                                    throw new Error(`OCC conflict for member ${member.name}`);
                                }

                                // Fetch gang balance for transaction log
                                const gang = await tx.query.gangs.findFirst({
                                    where: eq(gangs.id, gangId),
                                    columns: { balance: true }
                                });
                                const currentGangBalance = gang?.balance || 0;

                                await tx.insert(transactions).values({
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
                            });
                            successCount++;
                        } catch (penaltyError) {
                            console.error(`[Financial Update] ❌ Failed for ${member.name}:`, penaltyError);
                        }
                    }

                    console.log(`[Financial Update] Completed. Success: ${successCount}/${membersToPenalize.length}`);
                }
            }

            // Update Discord message to show closed
            if (botToken && attendanceSession.discordChannelId && attendanceSession.discordMessageId) {
                try {
                    // Update original embed to show closed
                    await fetch(`https://discord.com/api/v10/channels/${attendanceSession.discordChannelId}/messages/${attendanceSession.discordMessageId}`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bot ${botToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            embeds: [{
                                title: `📋 ${attendanceSession.sessionName}`,
                                description: '🔒 **ปิดรอบเช็คชื่อแล้ว**',
                                color: 0x95A5A6,
                                footer: {
                                    text: new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
                                },
                            }],
                            components: [{
                                type: 1,
                                components: [{
                                    type: 2,
                                    style: 2,
                                    label: '🔒 ปิดแล้ว',
                                    custom_id: `attendance_closed_${sessionId}`,
                                    disabled: true,
                                }],
                            }],
                        }),
                    });

                    // === Send Summary to สรุปเช็คชื่อ channel ===
                    // Fetch all records after insert for accurate summary
                    const finalRecords = await db.query.attendanceRecords.findMany({
                        where: eq(attendanceRecords.sessionId, sessionId),
                        with: { member: true },
                    });

                    const presentList = finalRecords.filter(r => r.status === 'PRESENT');
                    const absentList = finalRecords.filter(r => r.status === 'ABSENT');
                    const leaveList = finalRecords.filter(r => r.status === 'LEAVE');

                    const presentText = presentList.length > 0
                        ? presentList.map(r => `> ✅ ${r.member?.name || '?'}`).join('\n')
                        : '> -';
                    const absentText = absentList.length > 0
                        ? absentList.map(r => `> ❌ ${r.member?.name || '?'}${attendanceSession.absentPenalty > 0 ? ` (-฿${attendanceSession.absentPenalty})` : ''}`).join('\n')
                        : '> -';
                    const leaveText = leaveList.length > 0
                        ? leaveList.map(r => `> 🏖️ ${r.member?.name || '?'}`).join('\n')
                        : '> -';

                    const summaryEmbed = {
                        title: `📊 สรุป — ${attendanceSession.sessionName}`,
                        color: 0x5865F2,
                        fields: [
                            { name: `✅ มา (${presentList.length})`, value: presentText.slice(0, 1024) },
                            { name: `❌ ขาด (${absentList.length})`, value: absentText.slice(0, 1024) },
                            { name: `🏖️ ลา (${leaveList.length})`, value: leaveText.slice(0, 1024) },
                        ],
                        footer: {
                            text: `รวม ${allMembers.length} คน • ${new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })}`,
                        },
                        timestamp: new Date().toISOString(),
                    };

                    // Find สรุปเช็คชื่อ channel — search channels in the guild via Discord API
                    const gangData = await db.query.gangs.findFirst({
                        where: eq(gangs.id, gangId),
                        with: { settings: true },
                    });
                    const guildId = gangData?.discordGuildId;

                    if (guildId) {
                        // Fetch guild channels
                        const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
                            headers: { Authorization: `Bot ${botToken}` },
                        });

                        if (channelsRes.ok) {
                            const channels = await channelsRes.json();
                            // Find สรุปเช็คชื่อ channel (prefer same category as attendance channel)
                            const attendanceChId = gangData?.settings?.attendanceChannelId;
                            const attendanceCh = attendanceChId ? channels.find((c: any) => c.id === attendanceChId) : null;

                            let summaryChannel = channels.find((c: any) =>
                                c.name === 'สรุปเช็คชื่อ' && c.type === 0 && attendanceCh?.parent_id && c.parent_id === attendanceCh.parent_id
                            );
                            if (!summaryChannel) {
                                summaryChannel = channels.find((c: any) => c.name === 'สรุปเช็คชื่อ' && c.type === 0);
                            }

                            if (summaryChannel) {
                                await fetch(`https://discord.com/api/v10/channels/${summaryChannel.id}/messages`, {
                                    method: 'POST',
                                    headers: {
                                        Authorization: `Bot ${botToken}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ embeds: [summaryEmbed] }),
                                });
                            }
                        }
                    }

                } catch (e) {
                    console.error('Failed to update Discord message:', e);
                }
            }
        }

        // === CANCEL SESSION: No penalties, just update status + Discord ===
        if (status === 'CANCELLED') {
            updateData.closedAt = new Date();

            // Update Discord message to show cancelled
            if (botToken && attendanceSession.discordChannelId && attendanceSession.discordMessageId) {
                try {
                    await fetch(`https://discord.com/api/v10/channels/${attendanceSession.discordChannelId}/messages/${attendanceSession.discordMessageId}`, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bot ${botToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            embeds: [{
                                title: `📋 ${attendanceSession.sessionName}`,
                                description: '❌ **ยกเลิกรอบเช็คชื่อ** — ไม่มีการคิดค่าปรับ',
                                color: 0xED4245,
                                footer: {
                                    text: new Date(attendanceSession.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
                                },
                            }],
                            components: [{
                                type: 1,
                                components: [{
                                    type: 2,
                                    style: 2,
                                    label: '❌ ยกเลิกแล้ว',
                                    custom_id: `attendance_cancelled_${sessionId}`,
                                    disabled: true,
                                }],
                            }],
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
