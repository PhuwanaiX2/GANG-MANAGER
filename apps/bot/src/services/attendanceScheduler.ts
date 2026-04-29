import { db, attendanceSessions, attendanceRecords, members, gangs, gangSettings, canAccessFeature, auditLogs, partitionAttendanceRecords, resolveUncheckedAttendanceStatus, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq, and, lte, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { client } from '../index';
import { ChannelType, TextChannel } from 'discord.js';
import { logError, logInfo } from '../utils/logger';

const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds
const MAX_FAILURE_BACKOFF_MS = 5 * 60 * 1000;
let attendanceSchedulerStarted = false;
let attendanceSchedulerTickRunning = false;
let attendanceSchedulerConsecutiveFailures = 0;
let attendanceSchedulerNextRunAt = 0;

type AttendanceAuditActor = {
    actorId: string;
    actorName: string;
    triggeredBy?: 'scheduler' | 'bot';
};

export function getAttendanceSchedulerBackoffMs(consecutiveFailures: number) {
    const safeFailures = Math.max(1, consecutiveFailures);
    const exponent = Math.min(safeFailures - 1, 4);
    return Math.min(CHECK_INTERVAL_MS * (2 ** exponent), MAX_FAILURE_BACKOFF_MS);
}

function resetAttendanceSchedulerBackoff() {
    attendanceSchedulerConsecutiveFailures = 0;
    attendanceSchedulerNextRunAt = 0;
}

function recordAttendanceSchedulerFailure(error: unknown, context?: Record<string, unknown>) {
    attendanceSchedulerConsecutiveFailures += 1;
    const delayMs = getAttendanceSchedulerBackoffMs(attendanceSchedulerConsecutiveFailures);
    attendanceSchedulerNextRunAt = Date.now() + delayMs;

    logError('bot.attendance_scheduler.tick_failed', error, {
        ...context,
        consecutiveFailures: attendanceSchedulerConsecutiveFailures,
        retryInMs: delayMs,
        nextRetryAt: new Date(attendanceSchedulerNextRunAt).toISOString(),
    });
}

export function resetAttendanceSchedulerStateForTests() {
    attendanceSchedulerStarted = false;
    attendanceSchedulerTickRunning = false;
    resetAttendanceSchedulerBackoff();
}

export function startAttendanceScheduler() {
    if (attendanceSchedulerStarted) {
        return;
    }

    attendanceSchedulerStarted = true;
    logInfo('bot.attendance_scheduler.started', { intervalMs: CHECK_INTERVAL_MS });

    // Run immediately once, then on interval
    checkAndProcessSessions();
    setInterval(checkAndProcessSessions, CHECK_INTERVAL_MS);
}

async function findExistingAttendanceMessage(params: {
    channelId: string;
    sessionId: string;
    botToken: string;
}) {
    const { channelId, sessionId, botToken } = params;

    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages?limit=20`, {
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!res.ok) {
        return null;
    }

    const targetCustomId = `attendance_checkin_${sessionId}`;
    const messages = await res.json();
    const existingMessage = messages.find((message: any) =>
        Array.isArray(message.components) && message.components.some((row: any) =>
            Array.isArray(row.components) && row.components.some((component: any) => component.custom_id === targetCustomId)
        )
    );

    if (!existingMessage?.id) {
        return null;
    }

    return {
        channelId,
        messageId: existingMessage.id as string,
    };
}

async function storeDiscordMessageIfMissing(params: {
    sessionId: string;
    channelId: string;
    messageId: string;
}) {
    const { sessionId, channelId, messageId } = params;

    const updated = await db.update(attendanceSessions)
        .set({
            discordChannelId: channelId,
            discordMessageId: messageId,
        })
        .where(and(
            eq(attendanceSessions.id, sessionId),
            sql`${attendanceSessions.discordMessageId} is null`
        ))
        .returning({ id: attendanceSessions.id });

    return updated.length > 0;
}

// === Shared close logic: mark absent, apply penalties, send summary ===
export async function closeSessionAndReport(session: any, auditActor?: AttendanceAuditActor) {
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
        columns: { subscriptionTier: true, subscriptionExpiresAt: true },
    });
    const hasFinance = gangForTier
        ? canAccessFeature(resolveEffectiveSubscriptionTier(gangForTier.subscriptionTier, gangForTier.subscriptionExpiresAt), 'finance')
        : false;

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

        await db.insert(attendanceRecords).values(
            absentMembers.map(m => {
                const status = resolveUncheckedAttendanceStatus({
                    attendanceSession: session,
                    memberId: m.id,
                    approvedLeaves,
                });
                return {
                    id: nanoid(),
                    sessionId: session.id,
                    memberId: m.id,
                    status,
                    penaltyAmount: status === 'ABSENT' && hasFinance ? session.absentPenalty : 0,
                };
            })
        );

        // === Deduct balance & create PENALTY transactions (atomic per member) ===
        const penalty = hasFinance ? session.absentPenalty : 0;
        if (penalty > 0) {
            const { transactions, gangs: gangsTable } = await import('@gang/database');
            const { sql } = await import('drizzle-orm');

            for (const m of absentMembers) {
                const status = resolveUncheckedAttendanceStatus({
                    attendanceSession: session,
                    memberId: m.id,
                    approvedLeaves,
                });
                if (status !== 'ABSENT') continue;

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
                    logError('bot.attendance_scheduler.penalty_create_failed', penaltyError, {
                        sessionId: session.id,
                        gangId: session.gangId,
                        memberId: m.id,
                        penalty,
                    });
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
                        description: `ปรับเงิน ${record.member.name} ขาด (${session.sessionName})`,
                        status: 'APPROVED',
                        balanceBefore: currentGangBalance,
                        balanceAfter: currentGangBalance,
                        createdById: 'SYSTEM',
                        createdAt: new Date(),
                    });
                });
            } catch (penaltyError) {
                logError('bot.attendance_scheduler.penalty_reconcile_failed', penaltyError, {
                    sessionId: session.id,
                    gangId: session.gangId,
                    memberId: record.memberId,
                    desiredPenalty,
                });
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
        actorId: auditActor?.actorId || 'SYSTEM',
        actorName: auditActor?.actorName || 'System',
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
            triggeredBy: auditActor?.triggeredBy || 'scheduler',
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

                    const { present, absent, leave } = partitionAttendanceRecords(finalRecords);

                    const presentList = present.length > 0
                        ? present.map(r => `> ✅ ${r.member?.name || '?'}`).join('\n')
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
                    logInfo('bot.attendance_scheduler.summary_sent', {
                        sessionId: session.id,
                        gangId: session.gangId,
                        messageId: summaryMessage.id,
                    });
                }
            }
        }
    } catch (summaryErr) {
        logError('bot.attendance_scheduler.summary_failed', summaryErr, {
            sessionId: session.id,
            gangId: session.gangId,
        });
    }

    logInfo('bot.attendance_scheduler.session_closed', {
        sessionId: session.id,
        gangId: session.gangId,
        absentCount: absentMembers.length,
    });
}

async function checkAndProcessSessions() {
    if (attendanceSchedulerTickRunning) {
        return;
    }

    if (attendanceSchedulerNextRunAt > Date.now()) {
        return;
    }

    attendanceSchedulerTickRunning = true;
    const now = new Date();
    const botToken = process.env.DISCORD_BOT_TOKEN;

    if (!botToken) {
        recordAttendanceSchedulerFailure(new Error('Missing DISCORD_BOT_TOKEN'), {
            reason: 'missing_bot_token',
        });
        attendanceSchedulerTickRunning = false;
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

                const claimedSession = await db.update(attendanceSessions)
                    .set({ status: 'ACTIVE', closedAt: null })
                    .where(and(eq(attendanceSessions.id, session.id), eq(attendanceSessions.status, 'SCHEDULED')))
                    .returning({ id: attendanceSessions.id });

                if (claimedSession.length === 0) {
                    continue;
                }

                if (session.discordChannelId && session.discordMessageId) {
                    continue;
                }

                const existingMessageRef = await findExistingAttendanceMessage({
                    channelId,
                    sessionId: session.id,
                    botToken,
                });

                if (existingMessageRef) {
                    await db.update(attendanceSessions)
                        .set({
                            discordChannelId: existingMessageRef.channelId,
                            discordMessageId: existingMessageRef.messageId,
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
                            reusedDiscordMessage: true,
                        }),
                    });

                    logInfo('bot.attendance_scheduler.existing_message_reused', {
                        sessionId: session.id,
                        gangId: session.gangId,
                        channelId: existingMessageRef.channelId,
                        messageId: existingMessageRef.messageId,
                    });
                    continue;
                }

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

                if (!res.ok) {
                    await db.update(attendanceSessions)
                        .set({ status: 'SCHEDULED' })
                        .where(and(eq(attendanceSessions.id, session.id), eq(attendanceSessions.status, 'ACTIVE')));

                    throw new Error(await res.text());
                }

                const data = await res.json();
                const storedMessage = await storeDiscordMessageIfMissing({
                    sessionId: session.id,
                    channelId,
                    messageId: data.id,
                });

                if (!storedMessage) {
                    await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${data.id}`, {
                        method: 'DELETE',
                        headers: {
                            Authorization: `Bot ${botToken}`,
                            'Content-Type': 'application/json',
                        },
                    });

                    logInfo('bot.attendance_scheduler.duplicate_open_message_removed', {
                        sessionId: session.id,
                        gangId: session.gangId,
                        channelId,
                        messageId: data.id,
                    });
                    continue;
                }

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

                logInfo('bot.attendance_scheduler.session_auto_started', {
                    sessionId: session.id,
                    gangId: session.gangId,
                    channelId,
                    messageId: data.id,
                });
            } catch (error) {
                logError('bot.attendance_scheduler.session_auto_start_failed', error, {
                    sessionId: session.id,
                    gangId: session.gangId,
                });
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

                logInfo('bot.attendance_scheduler.closed_session_message_removed', {
                    sessionId: session.id,
                    gangId: session.gangId,
                });
            } catch (error) {
                logError('bot.attendance_scheduler.session_auto_close_failed', error, {
                    sessionId: session.id,
                    gangId: session.gangId,
                });
            }
        }
        resetAttendanceSchedulerBackoff();
    } catch (error) {
        recordAttendanceSchedulerFailure(error);
    } finally {
        attendanceSchedulerTickRunning = false;
    }
}
