import { db, attendanceSessions, attendanceRecords, members, gangs } from '@gang/database';
import { eq, and, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

export function startAttendanceScheduler() {
    console.log('📅 Attendance scheduler started (checking every 30s)');

    // Run immediately once, then on interval
    checkAndProcessSessions();
    setInterval(checkAndProcessSessions, CHECK_INTERVAL_MS);
}

async function checkAndProcessSessions() {
    const now = new Date();
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
        console.error('❌ Missing DISCORD_BOT_TOKEN. Attendance scheduler paused.');
        return;
    }

    try {
        // === 1. Auto-START: Find SCHEDULED sessions where startTime <= now ===
        const sessionsToStart = await db.query.attendanceSessions.findMany({
            where: and(
                eq(attendanceSessions.status, 'SCHEDULED'),
                lte(attendanceSessions.startTime, now)
            ),
        });

        for (const session of sessionsToStart) {
            try {
                // Get gang settings for channel ID
                const gang = await db.query.gangs.findFirst({
                    where: eq(gangs.id, session.gangId),
                    with: { settings: true },
                });

                const channelId = gang?.settings?.attendanceChannelId;
                if (!channelId) continue;

                const startDate = new Date(session.startTime);
                const endDate = new Date(session.endTime);

                const embed = {
                    title: `📋 ${session.sessionName}`,
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
                        text: new Date(session.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }),
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
                                custom_id: `attendance_checkin_${session.id}`,
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
                    await db.update(attendanceSessions)
                        .set({
                            status: 'ACTIVE',
                            discordMessageId: data.id,
                            discordChannelId: channelId,
                        })
                        .where(eq(attendanceSessions.id, session.id));

                    console.log(`✅ Auto-started session: ${session.sessionName}`);
                }
            } catch (e) {
                console.error(`Failed to auto-start session ${session.id}:`, e);
            }
        }

        // === 2. Auto-CLOSE: Find ACTIVE sessions where endTime <= now ===
        const sessionsToClose = await db.query.attendanceSessions.findMany({
            where: and(
                eq(attendanceSessions.status, 'ACTIVE'),
                lte(attendanceSessions.endTime, now)
            ),
            with: { records: true },
        });

        for (const session of sessionsToClose) {
            try {
                // Mark all non-checked members as ABSENT
                const allMembers = await db.query.members.findMany({
                    where: and(
                        eq(members.gangId, session.gangId),
                        eq(members.isActive, true),
                        eq(members.status, 'APPROVED')
                    ),
                });

                const checkedInMemberIds = new Set(session.records.map(r => r.memberId));
                const absentMembers = allMembers.filter(m => !checkedInMemberIds.has(m.id));

                if (absentMembers.length > 0) {
                    // Check for approved leave requests for these members today
                    // - FULL leave: Member gets LEAVE status (no penalty)
                    // - LATE leave: Only grants LEAVE if session start time < expected arrival time

                    const { leaveRequests } = await import('@gang/database');
                    const { gte, lte } = await import('drizzle-orm');

                    const todayStart = new Date(now);
                    todayStart.setHours(0, 0, 0, 0);
                    const todayEnd = new Date(now);
                    todayEnd.setHours(23, 59, 59, 999);

                    const approvedLeaves = await db.query.leaveRequests.findMany({
                        where: and(
                            eq(leaveRequests.gangId, session.gangId),
                            eq(leaveRequests.status, 'APPROVED'),
                            // Check start date is today (for both FULL and LATE)
                            lte(leaveRequests.startDate, todayEnd)
                        ),
                    });

                    // Filter leaves that actually apply to this session
                    const sessionStartTime = new Date(session.startTime);

                    // Build a map of memberId -> whether they have valid leave for THIS session
                    const memberHasValidLeave = new Map<string, boolean>();

                    for (const leave of approvedLeaves) {
                        if (leave.type === 'FULL') {
                            // FULL leave: Check if session date is within leave date range
                            const leaveStart = new Date(leave.startDate);
                            const leaveEnd = new Date(leave.endDate);
                            leaveStart.setHours(0, 0, 0, 0);
                            leaveEnd.setHours(23, 59, 59, 999);

                            if (sessionStartTime >= leaveStart && sessionStartTime <= leaveEnd) {
                                memberHasValidLeave.set(leave.memberId, true);
                            }
                        } else if (leave.type === 'LATE') {
                            // LATE leave: Only valid if session starts BEFORE expected arrival time
                            const expectedArrival = new Date(leave.startDate); // startDate stores expected arrival time

                            if (sessionStartTime < expectedArrival) {
                                // Session starts before they said they'd arrive -> LEAVE is valid
                                memberHasValidLeave.set(leave.memberId, true);
                            }
                            // If session starts AFTER their expected arrival, they should have been there -> ABSENT
                        }
                    }

                    await db.insert(attendanceRecords).values(
                        absentMembers.map(m => {
                            const hasLeave = memberHasValidLeave.get(m.id) === true;
                            return {
                                id: nanoid(),
                                sessionId: session.id,
                                memberId: m.id,
                                status: hasLeave ? 'LEAVE' : 'ABSENT',
                                penaltyAmount: hasLeave ? 0 : session.absentPenalty,
                            };
                        })
                    );

                    // === Deduct balance & create PENALTY transactions ===
                    const penalty = session.absentPenalty;
                    if (penalty > 0) {
                        const { transactions, gangs: gangsTable } = await import('@gang/database');

                        for (const m of absentMembers) {
                            const hasLeave = memberHasValidLeave.get(m.id) === true;
                            if (hasLeave) continue; // Don't penalize members on leave

                            try {
                                console.log(`[Scheduler Penalty] Deducting ${penalty} from ${m.name} (${m.id})`);

                                // OCC: Re-fetch current member balance to prevent race conditions
                                const currentMember = await db.query.members.findFirst({
                                    where: eq(members.id, m.id),
                                    columns: { balance: true }
                                });
                                if (!currentMember) continue;

                                const balanceBefore = currentMember.balance;
                                const balanceAfter = balanceBefore - penalty;

                                // OCC: Update member balance only if balance hasn't changed
                                const memberUpdateResult = await db.update(members)
                                    .set({ balance: balanceAfter })
                                    .where(and(eq(members.id, m.id), eq(members.balance, balanceBefore)));

                                if (memberUpdateResult.rowsAffected === 0) {
                                    console.warn(`[Scheduler Penalty] OCC conflict for member ${m.name}, retrying...`);
                                    // Simple retry: re-fetch and try once more
                                    const retryMember = await db.query.members.findFirst({
                                        where: eq(members.id, m.id),
                                        columns: { balance: true }
                                    });
                                    if (retryMember) {
                                        await db.update(members)
                                            .set({ balance: retryMember.balance - penalty })
                                            .where(and(eq(members.id, m.id), eq(members.balance, retryMember.balance)));
                                    }
                                }

                                // Fetch gang balance for accurate log
                                const gang2 = await db.query.gangs.findFirst({
                                    where: eq(gangsTable.id, session.gangId),
                                    columns: { balance: true }
                                });
                                const gangBalance = gang2?.balance || 0;

                                // Create PENALTY transaction
                                await db.insert(transactions).values({
                                    id: nanoid(),
                                    gangId: session.gangId,
                                    memberId: m.id,
                                    type: 'PENALTY',
                                    amount: penalty,
                                    category: 'ATTENDANCE',
                                    description: `ปรับเงิน ${m.name} ขาด (Session: ${session.sessionName})`,
                                    status: 'APPROVED',
                                    balanceBefore: gangBalance,
                                    balanceAfter: gangBalance,
                                    createdById: 'SYSTEM',
                                    createdAt: new Date(),
                                });
                                console.log(`[Scheduler Penalty] ✅ Done for ${m.name}`);
                            } catch (penaltyError) {
                                console.error(`[Scheduler Penalty] ❌ Failed for ${m.name}:`, penaltyError);
                            }
                        }
                    }
                }

                // Update session status
                await db.update(attendanceSessions)
                    .set({
                        status: 'CLOSED',
                        closedAt: now,
                    })
                    .where(eq(attendanceSessions.id, session.id));

                // Update Discord message
                if (session.discordChannelId && session.discordMessageId) {
                    await fetch(`https://discord.com/api/v10/channels/${session.discordChannelId}/messages/${session.discordMessageId}`, {
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
                                            custom_id: `attendance_closed_${session.id}`,
                                            disabled: true,
                                        },
                                    ],
                                },
                            ],
                        }),
                    });
                }

                console.log(`🔒 Auto-closed session: ${session.sessionName} (${absentMembers.length} absent)`);
            } catch (e) {
                console.error(`Failed to auto-close session ${session.id}:`, e);
            }
        }
    } catch (error) {
        console.error('Attendance scheduler error:', error);
    }
}
