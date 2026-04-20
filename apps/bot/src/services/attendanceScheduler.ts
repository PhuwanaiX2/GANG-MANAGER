import { db, attendanceSessions, attendanceRecords, members, gangs, gangSettings, canAccessFeature, auditLogs } from '@gang/database';
import { eq, and, lte } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { client } from '../index';
import { ChannelType, TextChannel } from 'discord.js';

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
let attendanceSchedulerStarted = false;

export function startAttendanceScheduler() {
    if (attendanceSchedulerStarted) {
        return;
    }

    attendanceSchedulerStarted = true;
    console.log('📅 Attendance scheduler started (checking every 30s)');

    // Run immediately once, then on interval
    checkAndProcessSessions();
    setInterval(checkAndProcessSessions, CHECK_INTERVAL_MS);
}

// === Shared close logic: mark absent, apply penalties, send summary ===
export async function closeSessionAndReport(session: any) {
    const now = new Date();

    // Get all records for this session
    const existingRecords = await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.sessionId, session.id),
    });

    // Get all active approved members
    const allMembers = await db.query.members.findMany({
        where: and(
            eq(members.gangId, session.gangId),
            eq(members.isActive, true),
            eq(members.status, 'APPROVED')
        ),
    });

    const checkedInMemberIds = new Set(existingRecords.map(r => r.memberId));
    const absentMembers = allMembers.filter(m => !checkedInMemberIds.has(m.id));

    const gangForTier = await db.query.gangs.findFirst({
        where: eq(gangs.id, session.gangId),
        columns: { subscriptionTier: true },
    });
    const hasFinance = gangForTier ? canAccessFeature(gangForTier.subscriptionTier, 'finance') : false;

    if (absentMembers.length > 0) {
        const { leaveRequests } = await import('@gang/database');

        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        const approvedLeaves = await db.query.leaveRequests.findMany({
            where: and(
                eq(leaveRequests.gangId, session.gangId),
                eq(leaveRequests.status, 'APPROVED'),
                lte(leaveRequests.startDate, todayEnd)
            ),
        });

        const sessionStartTime = new Date(session.startTime);
        const memberHasValidLeave = new Map<string, boolean>();

        for (const leave of approvedLeaves) {
            if (leave.type === 'FULL') {
                const leaveStart = new Date(leave.startDate);
                const leaveEnd = new Date(leave.endDate);
                leaveStart.setHours(0, 0, 0, 0);
                leaveEnd.setHours(23, 59, 59, 999);
                if (sessionStartTime >= leaveStart && sessionStartTime <= leaveEnd) {
                    memberHasValidLeave.set(leave.memberId, true);
                }
            } else if (leave.type === 'LATE') {
                const expectedArrival = new Date(leave.startDate);
                if (sessionStartTime < expectedArrival) {
                    memberHasValidLeave.set(leave.memberId, true);
                }
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
                    penaltyAmount: hasLeave ? 0 : hasFinance ? session.absentPenalty : 0,
                };
            })
        );

        // === Deduct balance & create PENALTY transactions (atomic per member) ===
        const penalty = hasFinance ? session.absentPenalty : 0;
        if (penalty > 0) {
            const { transactions, gangs: gangsTable } = await import('@gang/database');
            const { sql } = await import('drizzle-orm');

            for (const m of absentMembers) {
                const hasLeave = memberHasValidLeave.get(m.id) === true;
                if (hasLeave) continue;

                try {
                    await db.transaction(async (tx: any) => {
                        const currentMember = await tx.query.members.findFirst({
                            where: eq(members.id, m.id),
                            columns: { balance: true }
                        });
                        if (!currentMember) return;

                        // OCC: update only if balance hasn't changed
                        const memberResult = await tx.update(members)
                            .set({ balance: sql`balance - ${penalty}` })
                            .where(and(eq(members.id, m.id), eq(members.balance, currentMember.balance)))
                            .returning({ updatedId: members.id });

                        if (memberResult.length === 0) {
                            throw new Error(`OCC conflict for member ${m.name}`);
                        }

                        const gang2 = await tx.query.gangs.findFirst({
                            where: eq(gangsTable.id, session.gangId),
                            columns: { balance: true }
                        });
                        const gangBalance = gang2?.balance || 0;

                        await tx.insert(transactions).values({
                            id: nanoid(),
                            gangId: session.gangId,
                            memberId: m.id,
                            type: 'PENALTY',
                            amount: penalty,
                            category: 'ATTENDANCE',
                            description: `ปรับเงิน ${m.name} ขาด (${session.sessionName})`,
                            status: 'APPROVED',
                            balanceBefore: gangBalance,
                            balanceAfter: gangBalance,
                            createdById: 'SYSTEM',
                            createdAt: new Date(),
                        });
                    });
                } catch (penaltyError) {
                    console.error(`[Penalty] ❌ Failed for ${m.name}:`, penaltyError);
                }
            }
        }
    }

    const recordsForReconciliation = await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.sessionId, session.id),
        with: { member: true },
    });

    if (hasFinance) {
        const { transactions, gangs: gangsTable } = await import('@gang/database');
        const { sql } = await import('drizzle-orm');

        for (const record of recordsForReconciliation) {
            const desiredPenalty = record.status === 'ABSENT'
                ? session.absentPenalty
                : record.status === 'LATE' && session.allowLate
                    ? session.latePenalty
                    : 0;

            if (desiredPenalty <= record.penaltyAmount || desiredPenalty <= 0 || !record.member) {
                continue;
            }

            try {
                await db.transaction(async (tx: any) => {
                    const currentMember = await tx.query.members.findFirst({
                        where: eq(members.id, record.memberId),
                        columns: { balance: true }
                    });
                    if (!currentMember) return;

                    const memberResult = await tx.update(members)
                        .set({ balance: sql`balance - ${desiredPenalty}` })
                        .where(and(eq(members.id, record.memberId), eq(members.balance, currentMember.balance)))
                        .returning({ updatedId: members.id });

                    if (memberResult.length === 0) {
                        throw new Error(`OCC conflict for member ${record.member.name}`);
                    }

                    const currentGang = await tx.query.gangs.findFirst({
                        where: eq(gangsTable.id, session.gangId),
                        columns: { balance: true }
                    });
                    const currentGangBalance = currentGang?.balance || 0;

                    await tx.update(attendanceRecords)
                        .set({ penaltyAmount: desiredPenalty })
                        .where(eq(attendanceRecords.id, record.id));

                    await tx.insert(transactions).values({
                        id: nanoid(),
                        gangId: session.gangId,
                        memberId: record.memberId,
                        type: 'PENALTY',
                        amount: desiredPenalty,
                        category: 'ATTENDANCE',
                        description: record.status === 'LATE'
                            ? `ปรับเงิน ${record.member.name} มาสาย (${session.sessionName})`
                            : `ปรับเงิน ${record.member.name} ขาด (${session.sessionName})`,
                        status: 'APPROVED',
                        balanceBefore: currentGangBalance,
                        balanceAfter: currentGangBalance,
                        createdById: 'SYSTEM',
                        createdAt: new Date(),
                    });
                });
            } catch (penaltyError) {
                console.error(`[Penalty] ❌ Failed for ${record.member.name}:`, penaltyError);
            }
        }
    }

    // Update session status
    await db.update(attendanceSessions)
        .set({ status: 'CLOSED', closedAt: now })
        .where(eq(attendanceSessions.id, session.id));

    await db.insert(auditLogs).values({
        id: nanoid(),
        gangId: session.gangId,
        actorId: 'SYSTEM',
        actorName: 'System',
        action: 'ATTENDANCE_CLOSE',
        targetType: 'ATTENDANCE_SESSION',
        targetId: session.id,
        oldValue: JSON.stringify({
            status: session.status,
            closedAt: session.closedAt || null,
        }),
        newValue: JSON.stringify({
            status: 'CLOSED',
            closedAt: now,
        }),
        details: JSON.stringify({
            sessionId: session.id,
            sessionName: session.sessionName,
            triggeredBy: 'scheduler',
        }),
    });

    // === Send summary report to สรุปเช็คชื่อ channel ===
    try {
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, session.gangId),
            with: { settings: true },
        });

        if (gang) {
            const guild = client.guilds.cache.get(gang.discordGuildId);
            if (guild) {
                // Find summary channel by name under attendance category
                const attendanceChannelId = gang.settings?.attendanceChannelId;
                let summaryChannel: TextChannel | undefined;

                if (attendanceChannelId) {
                    const attendanceCh = guild.channels.cache.get(attendanceChannelId);
                    if (attendanceCh?.parentId) {
                        summaryChannel = guild.channels.cache.find(
                            c => c.name === 'สรุปเช็คชื่อ' && c.parentId === attendanceCh.parentId && c.type === ChannelType.GuildText
                        ) as TextChannel;
                    }
                }

                // Fallback: search guild-wide
                if (!summaryChannel) {
                    summaryChannel = guild.channels.cache.find(
                        c => c.name === 'สรุปเช็คชื่อ' && c.type === ChannelType.GuildText
                    ) as TextChannel;
                }

                if (summaryChannel) {
                    // Fetch final records with member names
                    const finalRecords = await db.query.attendanceRecords.findMany({
                        where: eq(attendanceRecords.sessionId, session.id),
                        with: { member: true },
                    });

                    const present = finalRecords.filter(r => r.status === 'PRESENT');
                    const late = finalRecords.filter(r => r.status === 'LATE');
                    const absent = finalRecords.filter(r => r.status === 'ABSENT');
                    const leave = finalRecords.filter(r => r.status === 'LEAVE');

                    const presentList = present.length > 0
                        ? present.map(r => `> ✅ ${r.member?.name || '?'}`).join('\n')
                        : '> -';
                    const lateList = late.length > 0
                        ? late.map(r => `> 🟡 ${r.member?.name || '?'}${session.latePenalty > 0 ? ` (-฿${r.penaltyAmount})` : ''}`).join('\n')
                        : '> -';
                    const absentList = absent.length > 0
                        ? absent.map(r => `> ❌ ${r.member?.name || '?'}${r.penaltyAmount > 0 ? ` (-฿${r.penaltyAmount})` : ''}`).join('\n')
                        : '> -';
                    const leaveList = leave.length > 0
                        ? leave.map(r => `> 🏖️ ${r.member?.name || '?'}`).join('\n')
                        : '> -';

                    const summaryEmbed = {
                        title: `📊 สรุป — ${session.sessionName}`,
                        color: 0x5865F2,
                        fields: [
                            { name: `✅ มา (${present.length})`, value: presentList.slice(0, 1024) },
                            { name: `🟡 มาสาย (${late.length})`, value: lateList.slice(0, 1024) },
                            { name: `❌ ขาด (${absent.length})`, value: absentList.slice(0, 1024) },
                            { name: `🏖️ ลา (${leave.length})`, value: leaveList.slice(0, 1024) },
                        ],
                        footer: {
                            text: `รวม ${allMembers.length} คน • ${new Date(session.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })} เวลา ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                        },
                    };

                    const summaryMessage = await summaryChannel.send({ embeds: [summaryEmbed] });
                    await db.update(attendanceSessions)
                        .set({
                            discordChannelId: summaryChannel.id,
                            discordMessageId: summaryMessage.id,
                        })
                        .where(eq(attendanceSessions.id, session.id));
                    console.log(`📊 Summary sent for session: ${session.sessionName}`);
                }
            }
        }
    } catch (summaryErr) {
        console.error(`[Summary] Failed to send summary:`, summaryErr);
    }

    console.log(`🔒 Closed session: ${session.sessionName} (${absentMembers.length} absent)`);
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
                        text: new Date(session.sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }),
                    },
                };

                // All buttons in ONE row
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
                            {
                                type: 2,
                                style: 4,
                                label: '🔒 ปิดรอบ',
                                custom_id: `attendance_close_${session.id}`,
                            },
                            {
                                type: 2,
                                style: 2,
                                label: '❌ ยกเลิกรอบ',
                                custom_id: `attendance_cancel_${session.id}`,
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

                    await db.insert(auditLogs).values({
                        id: nanoid(),
                        gangId: session.gangId,
                        actorId: 'SYSTEM',
                        actorName: 'System',
                        action: 'ATTENDANCE_START',
                        targetType: 'ATTENDANCE_SESSION',
                        targetId: session.id,
                        oldValue: JSON.stringify({
                            status: session.status,
                            closedAt: session.closedAt || null,
                        }),
                        newValue: JSON.stringify({
                            status: 'ACTIVE',
                            closedAt: null,
                        }),
                        details: JSON.stringify({
                            sessionId: session.id,
                            sessionName: session.sessionName,
                            triggeredBy: 'scheduler',
                        }),
                    });

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
        });

        for (const session of sessionsToClose) {
            try {
                // Use shared close logic
                await closeSessionAndReport(session);

                // Delete the Discord message entirely when session closes
                if (session.discordChannelId && session.discordMessageId) {
                    try {
                        await fetch(`https://discord.com/api/v10/channels/${session.discordChannelId}/messages/${session.discordMessageId}`, {
                            method: 'DELETE',
                            headers: { Authorization: `Bot ${botToken}` },
                        });
                    } catch {
                        // Fallback: disable buttons if delete fails
                        await fetch(`https://discord.com/api/v10/channels/${session.discordChannelId}/messages/${session.discordMessageId}`, {
                            method: 'PATCH',
                            headers: {
                                Authorization: `Bot ${botToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                embeds: [{
                                    title: `📋 ${session.sessionName}`,
                                    description: '🔒 **ปิดรอบเช็คชื่อแล้ว**',
                                    color: 0x95A5A6,
                                }],
                                components: [],
                            }),
                        });
                    }
                }
            } catch (e) {
                console.error(`Failed to auto-close session ${session.id}:`, e);
            }
        }
    } catch (error) {
        console.error('Attendance scheduler error:', error);
    }
}
