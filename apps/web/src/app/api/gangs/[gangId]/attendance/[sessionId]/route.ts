import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, attendanceSessions, attendanceRecords, members, transactions, leaveRequests, gangs, canAccessFeature, auditLogs, getAttendanceBucketCounts, normalizeAttendanceStatus, partitionAttendanceRecords, resolveUncheckedAttendanceStatus, resolveEffectiveSubscriptionTier } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { nanoid } from 'nanoid';
import { logError, logWarn } from '@/lib/logger';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

async function requireAttendanceSessionManageAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
        }

        throw error;
    }
}

async function requireAttendanceSessionDeleteAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return NextResponse.json({ error: 'เฉพาะหัวหน้าแก๊งเท่านั้นที่ลบได้' }, { status: 403 });
        }

        throw error;
    }
}

type AttendanceSessionMutationAction = 'record-update' | 'status-update' | 'delete';

async function enforceAttendanceSessionMutationRateLimit(
    request: NextRequest,
    gangId: string,
    sessionId: string,
    actorDiscordId: string | null,
    action: AttendanceSessionMutationAction
) {
    const limits: Record<AttendanceSessionMutationAction, number> = {
        'record-update': 180,
        'status-update': 30,
        delete: 10,
    };

    return enforceRouteRateLimit(request, {
        scope: `api:attendance:${action}`,
        limit: limits[action],
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('attendance-session', action, gangId, sessionId, actorDiscordId),
    });
}

function buildAttendanceSummaryEmbed(params: {
    sessionName: string;
    sessionDate: Date;
    totalMembers: number;
    records: any[];
}) {
    const { sessionName, sessionDate, totalMembers, records } = params;
    const { present: presentList, absent: absentList, leave: leaveList } = partitionAttendanceRecords(records);

    const presentText = presentList.length > 0
        ? presentList.map(r => `> ✅ ${r.member?.name || '?'}`).join('\n')
        : '> -';
    const absentText = absentList.length > 0
        ? absentList.map(r => `> ❌ ${r.member?.name || '?'}${r.penaltyAmount > 0 ? ` (-฿${r.penaltyAmount})` : ''}`).join('\n')
        : '> -';
    const leaveText = leaveList.length > 0
        ? leaveList.map(r => `> 🏖️ ${r.member?.name || '?'}`).join('\n')
        : '> -';

    return {
        title: `📊 สรุป — ${sessionName}`,
        color: 0x5865F2,
        fields: [
            { name: `✅ มา (${presentList.length})`, value: presentText.slice(0, 1024) },
            { name: `❌ ขาด (${absentList.length})`, value: absentText.slice(0, 1024) },
            { name: `🏖️ ลา (${leaveList.length})`, value: leaveText.slice(0, 1024) },
        ],
        footer: {
            text: `รวม ${totalMembers} คน • ${new Date(sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })}`,
        },
        timestamp: new Date().toISOString(),
    };
}

function buildActiveAttendanceEmbed(params: {
    sessionName: string;
    sessionDate: Date;
    startTime: Date;
    endTime: Date;
    records: any[];
}) {
    const { sessionName, sessionDate, startTime, endTime, records } = params;
    const { present, absent, leave } = partitionAttendanceRecords(records);
    const totalRecorded = present.length + absent.length + leave.length;

    return {
        title: `📋 ${sessionName}`,
        description: 'สถานะล่าสุดจากหน้าเว็บ อัปเดตหลังมีการแก้ไข/รีเซ็ตโดยแอดมิน',
        color: 0x57F287,
        fields: [
            {
                name: '🟢 เปิด',
                value: `${startTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                inline: true,
            },
            {
                name: '🔴 หมดเขต',
                value: `${endTime.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น.`,
                inline: true,
            },
            {
                name: '📊 สรุปล่าสุด',
                value: [
                    `> ✅ มา: **${present.length}**`,
                    `> ❌ ขาด: **${absent.length}**`,
                    `> 🏖️ ลา: **${leave.length}**`,
                    `> 📝 บันทึกแล้ว: **${totalRecorded}**`,
                ].join('\n'),
            },
        ],
        footer: {
            text: `แก้ไขล่าสุด ${new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' })} น. • ${new Date(sessionDate).toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' })}`,
        },
        timestamp: new Date().toISOString(),
    };
}

async function syncActiveAttendanceMessage(params: {
    gangId: string;
    sessionId: string;
    sessionName: string;
    sessionDate: Date;
    startTime: Date;
    endTime: Date;
    channelId?: string | null;
    messageId?: string | null;
    botToken: string;
}) {
    const { gangId, sessionId, sessionName, sessionDate, startTime, endTime, channelId, messageId, botToken } = params;

    if (!channelId || !messageId) {
        return null;
    }

    const records = await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.sessionId, sessionId),
        with: { member: true },
    });

    const embed = buildActiveAttendanceEmbed({
        sessionName,
        sessionDate,
        startTime,
        endTime,
        records,
    });

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
        const responseBody = await readResponseText(response);
        logWarn('api.attendance.session.active_message_sync_failed', {
            gangId,
            sessionId,
            channelId,
            messageId,
            statusCode: response.status,
            responseBody,
        });
        return null;
    }

    return { channelId, messageId };
}

async function upsertAttendanceSummaryMessage(params: {
    gangId: string;
    sessionId: string;
    sessionName: string;
    sessionDate: Date;
    storedChannelId?: string | null;
    storedMessageId?: string | null;
    botToken: string;
}) {
    const { gangId, sessionId, sessionName, sessionDate, storedChannelId, storedMessageId, botToken } = params;

    const gangData = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
        with: { settings: true },
    });
    const guildId = gangData?.discordGuildId;

    if (!guildId) {
        logWarn('api.attendance.summary.guild_missing', {
            gangId,
            sessionId,
        });
        return null;
    }

    const channelsRes = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
        headers: { Authorization: `Bot ${botToken}` },
    });

    if (!channelsRes.ok) {
        const responseBody = await readResponseText(channelsRes);
        logWarn('api.attendance.summary.channels_fetch_failed', {
            gangId,
            sessionId,
            guildId,
            statusCode: channelsRes.status,
            responseBody,
        });
        return null;
    }

    const channels = await channelsRes.json();
    const attendanceChannelId = gangData?.settings?.attendanceChannelId || null;
    const attendanceCh = attendanceChannelId ? channels.find((c: any) => c.id === attendanceChannelId) : null;

    let summaryChannel = channels.find((c: any) =>
        c.name === 'สรุปเช็คชื่อ' && c.type === 0 && attendanceCh?.parent_id && c.parent_id === attendanceCh.parent_id
    );
    if (!summaryChannel) {
        summaryChannel = channels.find((c: any) => c.name === 'สรุปเช็คชื่อ' && c.type === 0);
    }

    if (!summaryChannel) {
        logWarn('api.attendance.summary.channel_missing', {
            gangId,
            sessionId,
            guildId,
            attendanceChannelId,
        });
        return null;
    }

    const [finalRecords, allMembers] = await Promise.all([
        db.query.attendanceRecords.findMany({
            where: eq(attendanceRecords.sessionId, sessionId),
            with: { member: true },
        }),
        db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        }),
    ]);

    const summaryEmbed = buildAttendanceSummaryEmbed({
        sessionName,
        sessionDate,
        totalMembers: allMembers.length,
        records: finalRecords,
    });

    const canPatchExisting = Boolean(storedChannelId && storedMessageId);

    if (canPatchExisting) {
        const patchRes = await fetch(`https://discord.com/api/v10/channels/${storedChannelId}/messages/${storedMessageId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ embeds: [summaryEmbed] }),
        });

        if (patchRes.ok) {
            return {
                channelId: storedChannelId!,
                messageId: storedMessageId!,
            };
        }

        const responseBody = await readResponseText(patchRes);
        logWarn('api.attendance.summary.patch_failed', {
            gangId,
            sessionId,
            channelId: storedChannelId,
            messageId: storedMessageId,
            statusCode: patchRes.status,
            responseBody,
        });
    }

    const postRes = await fetch(`https://discord.com/api/v10/channels/${summaryChannel.id}/messages`, {
        method: 'POST',
        headers: {
            Authorization: `Bot ${botToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ embeds: [summaryEmbed] }),
    });

    if (!postRes.ok) {
        const responseBody = await readResponseText(postRes);
        logWarn('api.attendance.summary.post_failed', {
            gangId,
            sessionId,
            channelId: summaryChannel.id,
            statusCode: postRes.status,
            responseBody,
        });
        return null;
    }

    const data = await postRes.json();
    return {
        channelId: summaryChannel.id,
        messageId: data.id,
    };
}

// GET - Get session details with records
export async function GET(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; sessionId: string }> }
) {
    const params = await props.params;
    const { gangId, sessionId } = params;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

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

        const allMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        const checkedInMemberIds = new Set(attendanceSession.records.map(r => r.memberId));
        const notCheckedIn = allMembers.filter(m => !checkedInMemberIds.has(m.id));
        const counts = getAttendanceBucketCounts(attendanceSession.records);

        const stats = {
            total: allMembers.length,
            present: counts.present,
            absent: counts.absent,
            leave: counts.leave,
            notCheckedIn: notCheckedIn.length,
        };

        return NextResponse.json({
            session: attendanceSession,
            stats,
            notCheckedIn,
        });
    } catch (error) {
        logError('api.attendance.session.get.failed', error, {
            gangId,
            sessionId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// PATCH - Update session status (ACTIVE/CLOSED)
export async function PATCH(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; sessionId: string }> }
) {
    const params = await props.params;
    const { gangId, sessionId } = params;
    let actorDiscordId: string | null = null;
    let requestedStatus: string | null = null;
    let requestedMemberId: string | null = null;
    let requestedAttendanceStatus: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;
        const body = await request.json();
        const { status, memberId, attendanceStatus } = body as {
            status?: string;
            memberId?: string;
            attendanceStatus?: string;
        };
        requestedStatus = typeof status === 'string' ? status : null;
        requestedMemberId = typeof memberId === 'string' ? memberId : null;
        requestedAttendanceStatus = typeof attendanceStatus === 'string' ? attendanceStatus : null;

        if (memberId || attendanceStatus) {
            if (!memberId || !['PRESENT', 'ABSENT', 'LEAVE', 'RESET'].includes(attendanceStatus || '')) {
                return NextResponse.json({ error: 'ข้อมูลการอัปเดตเช็คชื่อไม่ถูกต้อง' }, { status: 400 });
            }

            const targetMemberId = memberId;
            const nextAttendanceStatus = attendanceStatus as 'PRESENT' | 'ABSENT' | 'LEAVE' | 'RESET';

            const forbiddenResponse = await requireAttendanceSessionManageAccess(gangId);
            if (forbiddenResponse) {
                return forbiddenResponse;
            }

            const rateLimited = await enforceAttendanceSessionMutationRateLimit(
                request,
                gangId,
                sessionId,
                actorDiscordId,
                'record-update'
            );
            if (rateLimited) {
                return rateLimited;
            }

            const attendanceSession = await db.query.attendanceSessions.findFirst({
                where: and(
                    eq(attendanceSessions.id, sessionId),
                    eq(attendanceSessions.gangId, gangId)
                ),
            });

            if (!attendanceSession) {
                return NextResponse.json({ error: 'ไม่พบรอบเช็คชื่อ' }, { status: 404 });
            }

            if (!['ACTIVE', 'CLOSED'].includes(attendanceSession.status)) {
                return NextResponse.json({ error: 'จัดการรายชื่อได้เฉพาะรอบที่เปิดอยู่หรือปิดแล้ว' }, { status: 400 });
            }

            const isClosedSession = attendanceSession.status === 'CLOSED';

            const targetMember = await db.query.members.findFirst({
                where: and(
                    eq(members.id, targetMemberId),
                    eq(members.gangId, gangId),
                    eq(members.isActive, true),
                    eq(members.status, 'APPROVED')
                ),
            });

            if (!targetMember) {
                return NextResponse.json({ error: 'ไม่พบสมาชิกที่สามารถเช็คชื่อได้' }, { status: 404 });
            }

            const existingRecord = await db.query.attendanceRecords.findFirst({
                where: and(
                    eq(attendanceRecords.sessionId, sessionId),
                    eq(attendanceRecords.memberId, targetMemberId)
                ),
            });

            const currentStatus = normalizeAttendanceStatus(existingRecord?.status);

            if (existingRecord && nextAttendanceStatus !== 'RESET' && currentStatus === nextAttendanceStatus) {
                return NextResponse.json({
                    success: true,
                    noop: true,
                    record: {
                        id: existingRecord.id,
                        status: existingRecord.status,
                        checkedInAt: existingRecord.checkedInAt,
                        penaltyAmount: existingRecord.penaltyAmount,
                        member: {
                            id: targetMember.id,
                            name: targetMember.name,
                            discordAvatar: targetMember.discordAvatar,
                            discordUsername: targetMember.discordUsername,
                        },
                    },
                });
            }

            if (nextAttendanceStatus === 'RESET') {
                if (isClosedSession) {
                    return NextResponse.json({ error: 'ไม่สามารถรีเซ็ตหลังปิดรอบได้' }, { status: 400 });
                }

                if (existingRecord) {
                    await db.delete(attendanceRecords)
                        .where(eq(attendanceRecords.id, existingRecord.id));
                }

                await db.insert(auditLogs).values({
                    id: nanoid(),
                    gangId,
                    actorId: session.user.discordId,
                    actorName: session.user.name || 'Unknown',
                    action: 'ATTENDANCE_UPDATE',
                    targetType: 'ATTENDANCE',
                    targetId: existingRecord?.id || `${sessionId}:${targetMemberId}`,
                    oldValue: JSON.stringify(existingRecord ? {
                        status: existingRecord.status,
                        checkedInAt: existingRecord.checkedInAt,
                    } : null),
                    newValue: JSON.stringify(null),
                    details: JSON.stringify({
                        sessionId,
                        memberId: targetMemberId,
                        memberName: targetMember.name,
                        operation: 'RESET',
                    }),
                });

                const botToken = process.env.DISCORD_BOT_TOKEN;
                if (attendanceSession.status === 'ACTIVE' && botToken) {
                    try {
                        await syncActiveAttendanceMessage({
                            gangId,
                            sessionId,
                            sessionName: attendanceSession.sessionName,
                            sessionDate: new Date(attendanceSession.sessionDate),
                            startTime: new Date(attendanceSession.startTime),
                            endTime: new Date(attendanceSession.endTime),
                            channelId: attendanceSession.discordChannelId,
                            messageId: attendanceSession.discordMessageId,
                            botToken,
                        });
                    } catch (syncError) {
                        logWarn('api.attendance.session.active_message_sync_error', {
                            gangId,
                            sessionId,
                            memberId: targetMemberId,
                            attendanceStatus: nextAttendanceStatus,
                            error: syncError,
                        });
                    }
                }

                return NextResponse.json({
                    success: true,
                    member: {
                        id: targetMember.id,
                        name: targetMember.name,
                        discordAvatar: targetMember.discordAvatar,
                        discordUsername: targetMember.discordUsername,
                    },
                });
            }

            const checkedInAt = nextAttendanceStatus === 'PRESENT'
                ? existingRecord?.checkedInAt || (isClosedSession ? null : new Date())
                : null;

            const recordId = existingRecord?.id || nanoid();

            let nextPenaltyAmount = 0;
            let penaltyDelta = 0;
            let actorMemberId: string | null = null;

            if (isClosedSession) {
                const gangForTier = await db.query.gangs.findFirst({
                    where: eq(gangs.id, gangId),
                    columns: { subscriptionTier: true, subscriptionExpiresAt: true },
                });
                const hasFinance = gangForTier
                    ? canAccessFeature(resolveEffectiveSubscriptionTier(gangForTier.subscriptionTier, gangForTier.subscriptionExpiresAt), 'finance')
                    : false;

                nextPenaltyAmount = hasFinance
                    ? nextAttendanceStatus === 'ABSENT'
                        ? attendanceSession.absentPenalty
                        : 0
                    : 0;

                penaltyDelta = nextPenaltyAmount - (existingRecord?.penaltyAmount || 0);

                if (hasFinance && penaltyDelta !== 0) {
                    const actorMember = await db.query.members.findFirst({
                        where: and(eq(members.gangId, gangId), eq(members.discordId, session.user.discordId)),
                        columns: { id: true },
                    });
                    actorMemberId = actorMember?.id || null;
                }
            }

            await db.transaction(async (tx: any) => {
                if (existingRecord) {
                    await tx.update(attendanceRecords)
                        .set({
                            status: nextAttendanceStatus,
                            checkedInAt,
                            penaltyAmount: isClosedSession ? nextPenaltyAmount : 0,
                        })
                        .where(eq(attendanceRecords.id, existingRecord.id));
                } else {
                    await tx.insert(attendanceRecords).values({
                        id: recordId,
                        sessionId,
                        memberId: targetMemberId,
                        status: nextAttendanceStatus,
                        checkedInAt,
                        penaltyAmount: isClosedSession ? nextPenaltyAmount : 0,
                    });
                }

                if (isClosedSession && penaltyDelta !== 0) {
                    const currentMember = await tx.query.members.findFirst({
                        where: eq(members.id, targetMemberId),
                        columns: { balance: true }
                    });

                    if (!currentMember) {
                        throw new Error('ไม่พบยอดเงินสมาชิกสำหรับ reconciliation');
                    }

                    const memberResult = await tx.update(members)
                        .set({ balance: sql`balance - ${penaltyDelta}` })
                        .where(and(eq(members.id, targetMemberId), eq(members.balance, currentMember.balance)))
                        .returning({ updatedId: members.id });

                    if (memberResult.length === 0) {
                        throw new Error(`OCC conflict for member ${targetMember.name}`);
                    }

                    const currentGang = await tx.query.gangs.findFirst({
                        where: eq(gangs.id, gangId),
                        columns: { balance: true }
                    });
                    const currentGangBalance = currentGang?.balance || 0;

                    await tx.insert(transactions).values({
                        id: nanoid(),
                        gangId,
                        memberId: targetMemberId,
                        type: 'PENALTY',
                        amount: penaltyDelta,
                        category: 'ATTENDANCE',
                        description: penaltyDelta > 0
                            ? `ปรับเงิน ${targetMember.name} ขาด (Reconcile: ${attendanceSession.sessionName})`
                            : `คืนค่าปรับ ${targetMember.name} (Reconcile: ${attendanceSession.sessionName})`,
                        status: 'APPROVED',
                        balanceBefore: currentGangBalance,
                        balanceAfter: currentGangBalance,
                        createdById: actorMemberId || 'SYSTEM',
                        createdAt: new Date(),
                    });
                }
            });

            await db.insert(auditLogs).values({
                id: nanoid(),
                gangId,
                actorId: session.user.discordId,
                actorName: session.user.name || 'Unknown',
                action: 'ATTENDANCE_UPDATE',
                targetType: 'ATTENDANCE',
                targetId: recordId,
                oldValue: JSON.stringify(existingRecord ? {
                    status: existingRecord.status,
                    checkedInAt: existingRecord.checkedInAt,
                    penaltyAmount: existingRecord.penaltyAmount,
                } : null),
                newValue: JSON.stringify({
                    status: nextAttendanceStatus,
                    checkedInAt,
                    penaltyAmount: isClosedSession ? nextPenaltyAmount : 0,
                }),
                details: JSON.stringify({
                    sessionId,
                    memberId: targetMemberId,
                    memberName: targetMember.name,
                    operation: existingRecord ? 'UPDATE' : 'CREATE',
                    sessionStatus: attendanceSession.status,
                    penaltyDelta,
                }),
            });

            const botToken = process.env.DISCORD_BOT_TOKEN;
            if (!isClosedSession && botToken) {
                try {
                    await syncActiveAttendanceMessage({
                        gangId,
                        sessionId,
                        sessionName: attendanceSession.sessionName,
                        sessionDate: new Date(attendanceSession.sessionDate),
                        startTime: new Date(attendanceSession.startTime),
                        endTime: new Date(attendanceSession.endTime),
                        channelId: attendanceSession.discordChannelId,
                        messageId: attendanceSession.discordMessageId,
                        botToken,
                    });
                } catch (syncError) {
                    logWarn('api.attendance.session.active_message_sync_error', {
                        gangId,
                        sessionId,
                        memberId: targetMemberId,
                        attendanceStatus: nextAttendanceStatus,
                        error: syncError,
                    });
                }
            }

            if (isClosedSession && botToken) {
                try {
                    const summaryRef = await upsertAttendanceSummaryMessage({
                        gangId,
                        sessionId,
                        sessionName: attendanceSession.sessionName,
                        sessionDate: new Date(attendanceSession.sessionDate),
                        storedChannelId: attendanceSession.discordChannelId,
                        storedMessageId: attendanceSession.discordMessageId,
                        botToken,
                    });

                    if (summaryRef && (
                        summaryRef.channelId !== attendanceSession.discordChannelId ||
                        summaryRef.messageId !== attendanceSession.discordMessageId
                    )) {
                        await db.update(attendanceSessions)
                            .set({
                                discordChannelId: summaryRef.channelId,
                                discordMessageId: summaryRef.messageId,
                            })
                            .where(eq(attendanceSessions.id, sessionId));
                    }
                } catch (summaryError) {
                    logWarn('api.attendance.session.summary_sync_failed', {
                        gangId,
                        sessionId,
                        memberId: targetMemberId,
                        attendanceStatus: nextAttendanceStatus,
                        sessionStatus: attendanceSession.status,
                        error: summaryError,
                    });
                }
            }

            return NextResponse.json({
                success: true,
                record: {
                    id: recordId,
                    status: nextAttendanceStatus,
                    checkedInAt,
                    penaltyAmount: isClosedSession ? nextPenaltyAmount : 0,
                    member: {
                        id: targetMember.id,
                        name: targetMember.name,
                        discordAvatar: targetMember.discordAvatar,
                        discordUsername: targetMember.discordUsername,
                    },
                },
            });
        }

        if (typeof status !== 'string' || !['ACTIVE', 'CLOSED', 'SCHEDULED', 'CANCELLED'].includes(status)) {
            return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
        }

        const sessionStatus = status as 'ACTIVE' | 'CLOSED' | 'SCHEDULED' | 'CANCELLED';
        const forbiddenResponse = await requireAttendanceSessionManageAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceAttendanceSessionMutationRateLimit(
            request,
            gangId,
            sessionId,
            actorDiscordId,
            'status-update'
        );
        if (rateLimited) {
            return rateLimited;
        }

        const updateData: any = { status: sessionStatus };
        const attendanceSession = await db.query.attendanceSessions.findFirst({
            where: eq(attendanceSessions.id, sessionId),
            with: { records: true },
        });

        if (!attendanceSession) {
            return NextResponse.json({ error: 'ไม่พบรอบเช็คชื่อ' }, { status: 404 });
        }

        const botToken = process.env.DISCORD_BOT_TOKEN;

        if (sessionStatus === 'ACTIVE' && attendanceSession.status === 'SCHEDULED') {
            const gang = await db.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                with: { settings: true },
            });
            const channelId = gang?.settings?.attendanceChannelId;

            const claimedSession = await db.update(attendanceSessions)
                .set({ status: 'ACTIVE', closedAt: null })
                .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.status, 'SCHEDULED')))
                .returning({ id: attendanceSessions.id });

            if (claimedSession.length === 0) {
                return NextResponse.json({ success: true, alreadyStarted: true });
            }

            if (!botToken || !channelId) {
                await db.update(attendanceSessions)
                    .set({ status: 'SCHEDULED' })
                    .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.status, 'ACTIVE')));

                return NextResponse.json({ error: 'ยังไม่สามารถส่งปุ่มเช็คชื่อไป Discord ได้' }, { status: 500 });
            }

            try {
                const startDate = new Date(attendanceSession.startTime);
                const endDate = new Date(attendanceSession.endTime);

                const embed = {
                    title: `📋 ${attendanceSession.sessionName}`,
                    description: 'กดปุ่มด้านล่างเพื่อเช็คชื่อ',
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

                if (!res.ok) {
                    throw new Error(await res.text());
                }

                const data = await res.json();
                await db.update(attendanceSessions)
                    .set({
                        discordMessageId: data.id,
                        discordChannelId: channelId,
                    })
                    .where(eq(attendanceSessions.id, sessionId));
            } catch (e) {
                await db.update(attendanceSessions)
                    .set({ status: 'SCHEDULED' })
                    .where(and(eq(attendanceSessions.id, sessionId), eq(attendanceSessions.status, 'ACTIVE')));

                logError('api.attendance.session.start.discord_failed', e, {
                    gangId,
                    sessionId,
                    channelId,
                    actorDiscordId,
                });
                return NextResponse.json({ error: 'ไม่สามารถส่งปุ่มเช็คชื่อไป Discord ได้' }, { status: 500 });
            }

            await db.insert(auditLogs).values({
                id: nanoid(),
                gangId,
                actorId: session.user.discordId,
                actorName: session.user.name || 'Unknown',
                action: 'ATTENDANCE_START',
                targetType: 'ATTENDANCE_SESSION',
                targetId: sessionId,
                oldValue: JSON.stringify({
                    status: attendanceSession.status,
                    closedAt: attendanceSession.closedAt,
                }),
                newValue: JSON.stringify({
                    status: 'ACTIVE',
                    closedAt: null,
                }),
                details: JSON.stringify({
                    sessionId,
                    sessionName: attendanceSession.sessionName,
                }),
            });

            return NextResponse.json({ success: true });
        }

        if (sessionStatus === 'CLOSED') {
            updateData.closedAt = new Date();

            const allMembers = await db.query.members.findMany({
                where: and(
                    eq(members.gangId, gangId),
                    eq(members.isActive, true),
                    eq(members.status, 'APPROVED')
                ),
            });

            const checkedInMemberIds = new Set(attendanceSession.records.map(r => r.memberId));
            const absentMembers = allMembers.filter(m => !checkedInMemberIds.has(m.id));

            let relevantLeaves: any[] = [];
            if (absentMembers.length > 0) {
                relevantLeaves = await db.query.leaveRequests.findMany({
                    where: and(
                        eq(leaveRequests.gangId, gangId),
                        eq(leaveRequests.status, 'APPROVED')
                    )
                });
            }

            const gangForTier = await db.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { subscriptionTier: true, subscriptionExpiresAt: true },
            });
            const hasFinance = gangForTier
                ? canAccessFeature(resolveEffectiveSubscriptionTier(gangForTier.subscriptionTier, gangForTier.subscriptionExpiresAt), 'finance')
                : false;

            const actor = await db.query.members.findFirst({
                where: and(eq(members.gangId, gangId), eq(members.discordId, session.user.discordId))
            });

            if (absentMembers.length > 0) {
                const attendanceRecordsToInsert: any[] = [];
                const membersToPenalize: { member: typeof absentMembers[0], penalty: number }[] = [];

                for (const member of absentMembers) {
                    const memberStatus = resolveUncheckedAttendanceStatus({
                        attendanceSession,
                        memberId: member.id,
                        approvedLeaves: relevantLeaves,
                    });
                    const penalty = memberStatus === 'ABSENT' && hasFinance ? attendanceSession.absentPenalty : 0;

                    attendanceRecordsToInsert.push({
                        id: nanoid(),
                        sessionId,
                        memberId: member.id,
                        status: memberStatus,
                        penaltyAmount: penalty,
                    });

                    if (penalty > 0) {
                        membersToPenalize.push({ member, penalty });
                    }
                }

                if (attendanceRecordsToInsert.length > 0) {
                    try {
                        await db.insert(attendanceRecords).values(attendanceRecordsToInsert);
                    } catch (batchError) {
                        logWarn('api.attendance.session.close.batch_insert_failed', {
                            gangId,
                            sessionId,
                            recordCount: attendanceRecordsToInsert.length,
                            error: batchError,
                        });
                    }
                }

                if (membersToPenalize.length > 0) {
                    for (const { member, penalty } of membersToPenalize) {
                        try {
                            await db.transaction(async (tx: any) => {
                                const currentMember = await tx.query.members.findFirst({
                                    where: eq(members.id, member.id),
                                    columns: { balance: true }
                                });
                                if (!currentMember) return;

                                const memberResult = await tx.update(members)
                                    .set({ balance: sql`balance - ${penalty}` })
                                    .where(and(eq(members.id, member.id), eq(members.balance, currentMember.balance)))
                                    .returning({ updatedId: members.id });

                                if (memberResult.length === 0) {
                                    throw new Error(`OCC conflict for member ${member.name}`);
                                }

                                const currentGang = await tx.query.gangs.findFirst({
                                    where: eq(gangs.id, gangId),
                                    columns: { balance: true }
                                });
                                const currentGangBalance = currentGang?.balance || 0;

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
                        } catch (penaltyError) {
                            logWarn('api.attendance.session.close.penalty_apply_failed', {
                                gangId,
                                sessionId,
                                memberId: member.id,
                                memberName: member.name,
                                penalty,
                                error: penaltyError,
                            });
                        }
                    }
                }
            }

            const recordsForReconciliation = await db.query.attendanceRecords.findMany({
                where: eq(attendanceRecords.sessionId, sessionId),
                with: { member: true },
            });

            if (hasFinance) {
                for (const record of recordsForReconciliation) {
                    const desiredPenalty = record.status === 'ABSENT'
                        ? attendanceSession.absentPenalty
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
                                where: eq(gangs.id, gangId),
                                columns: { balance: true }
                            });
                            const currentGangBalance = currentGang?.balance || 0;

                            await tx.update(attendanceRecords)
                                .set({ penaltyAmount: desiredPenalty })
                                .where(eq(attendanceRecords.id, record.id));

                            await tx.insert(transactions).values({
                                id: nanoid(),
                                gangId,
                                memberId: record.memberId,
                                type: 'PENALTY',
                                amount: desiredPenalty,
                                category: 'ATTENDANCE',
                                description: `ปรับเงิน ${record.member.name} ขาด (Session: ${attendanceSession.sessionName})`,
                                status: 'APPROVED',
                                balanceBefore: currentGangBalance,
                                balanceAfter: currentGangBalance,
                                createdById: actor?.id || 'SYSTEM',
                                createdAt: new Date(),
                            });
                        });
                    } catch (penaltyError) {
                        logWarn('api.attendance.session.close.reconcile_penalty_failed', {
                            gangId,
                            sessionId,
                            memberId: record.memberId,
                            memberName: record.member.name,
                            desiredPenalty,
                            error: penaltyError,
                        });
                    }
                }
            }

            if (botToken && attendanceSession.discordChannelId && attendanceSession.discordMessageId) {
                try {
                    const response = await fetch(`https://discord.com/api/v10/channels/${attendanceSession.discordChannelId}/messages/${attendanceSession.discordMessageId}`, {
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

                    if (!response.ok) {
                        const responseBody = await readResponseText(response);
                        logWarn('api.attendance.session.close.discord_update_failed', {
                            gangId,
                            sessionId,
                            channelId: attendanceSession.discordChannelId,
                            messageId: attendanceSession.discordMessageId,
                            statusCode: response.status,
                            responseBody,
                        });
                    }
                } catch (e) {
                    logWarn('api.attendance.session.close.discord_update_error', {
                        gangId,
                        sessionId,
                        channelId: attendanceSession.discordChannelId,
                        messageId: attendanceSession.discordMessageId,
                        error: e,
                    });
                }
            }

            if (botToken) {
                try {
                    const summaryRef = await upsertAttendanceSummaryMessage({
                        gangId,
                        sessionId,
                        sessionName: attendanceSession.sessionName,
                        sessionDate: new Date(attendanceSession.sessionDate),
                        storedChannelId: attendanceSession.status === 'CLOSED' ? attendanceSession.discordChannelId : null,
                        storedMessageId: attendanceSession.status === 'CLOSED' ? attendanceSession.discordMessageId : null,
                        botToken,
                    });

                    if (summaryRef) {
                        updateData.discordChannelId = summaryRef.channelId;
                        updateData.discordMessageId = summaryRef.messageId;
                    }
                } catch (summaryError) {
                    logWarn('api.attendance.session.close.summary_upsert_failed', {
                        gangId,
                        sessionId,
                        error: summaryError,
                    });
                }
            }
        }

        if (sessionStatus === 'CANCELLED') {
            updateData.closedAt = new Date();

            if (botToken && attendanceSession.discordChannelId && attendanceSession.discordMessageId) {
                try {
                    const response = await fetch(`https://discord.com/api/v10/channels/${attendanceSession.discordChannelId}/messages/${attendanceSession.discordMessageId}`, {
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

                    if (!response.ok) {
                        const responseBody = await readResponseText(response);
                        logWarn('api.attendance.session.cancel.discord_update_failed', {
                            gangId,
                            sessionId,
                            channelId: attendanceSession.discordChannelId,
                            messageId: attendanceSession.discordMessageId,
                            statusCode: response.status,
                            responseBody,
                        });
                    }
                } catch (e) {
                    logWarn('api.attendance.session.cancel.discord_update_error', {
                        gangId,
                        sessionId,
                        channelId: attendanceSession.discordChannelId,
                        messageId: attendanceSession.discordMessageId,
                        error: e,
                    });
                }
            }
        }

        await db.update(attendanceSessions)
            .set(updateData)
            .where(eq(attendanceSessions.id, sessionId));

        if (attendanceSession.status !== sessionStatus) {
            const action = sessionStatus === 'ACTIVE'
                ? 'ATTENDANCE_START'
                : sessionStatus === 'CLOSED'
                    ? 'ATTENDANCE_CLOSE'
                    : sessionStatus === 'CANCELLED'
                        ? 'ATTENDANCE_CANCEL'
                        : 'ATTENDANCE_UPDATE';

            await db.insert(auditLogs).values({
                id: nanoid(),
                gangId,
                actorId: session.user.discordId,
                actorName: session.user.name || 'Unknown',
                action,
                targetType: 'ATTENDANCE_SESSION',
                targetId: sessionId,
                oldValue: JSON.stringify({
                    status: attendanceSession.status,
                    closedAt: attendanceSession.closedAt,
                }),
                newValue: JSON.stringify({
                    status: sessionStatus,
                    closedAt: updateData.closedAt || attendanceSession.closedAt || null,
                }),
                details: JSON.stringify({
                    sessionId,
                    sessionName: attendanceSession.sessionName,
                }),
            });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('api.attendance.session.update.failed', error, {
            gangId,
            sessionId,
            actorDiscordId,
            requestedStatus,
            requestedMemberId,
            requestedAttendanceStatus,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// DELETE - Delete session
export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ gangId: string; sessionId: string }> }
) {
    const params = await props.params;
    const { gangId, sessionId } = params;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;
        const forbiddenResponse = await requireAttendanceSessionDeleteAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceAttendanceSessionMutationRateLimit(
            request,
            gangId,
            sessionId,
            actorDiscordId,
            'delete'
        );
        if (rateLimited) {
            return rateLimited;
        }

        await db.delete(attendanceSessions).where(eq(attendanceSessions.id, sessionId));

        return NextResponse.json({ success: true });
    } catch (error) {
        logError('api.attendance.session.delete.failed', error, {
            gangId,
            sessionId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
