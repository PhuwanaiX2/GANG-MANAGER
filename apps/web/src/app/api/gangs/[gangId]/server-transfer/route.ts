import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, attendanceSessions, transactions, leaveRequests, attendanceRecords, gangSettings, gangRoles } from '@gang/database';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logInfo, logWarn } from '@/lib/logger';
import { eq, and, sql } from 'drizzle-orm';

const SERVER_TRANSFER_RATE_LIMITS = {
    start: 5,
    cancel: 10,
    complete: 10,
} as const;

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch {
        return undefined;
    }
}

type ServerTransferStartBody = {
    deadlineHours?: unknown;
    deadlineDays?: unknown;
    confirmationText?: unknown;
};

function badRequest(error: string) {
    return NextResponse.json({ error }, { status: 400 });
}

async function readStartBody(req: Request) {
    try {
        return { body: await req.json() as ServerTransferStartBody };
    } catch {
        return { response: badRequest('ข้อมูลที่ส่งมาไม่ถูกต้อง') };
    }
}

function resolveTransferDeadline(body: ServerTransferStartBody) {
    const deadline = new Date();

    if (body.deadlineHours !== undefined) {
        const hours = Number(body.deadlineHours);
        if (!Number.isFinite(hours) || hours < 1) {
            return { response: badRequest('deadlineHours ต้องมากกว่าหรือเท่ากับ 1') };
        }

        deadline.setTime(deadline.getTime() + Math.min(Math.floor(hours), 336) * 60 * 60 * 1000);
        return { deadline };
    }

    const days = Number(body.deadlineDays ?? 3);
    if (!Number.isFinite(days) || days < 1) {
        return { response: badRequest('deadlineDays ต้องมากกว่าหรือเท่ากับ 1') };
    }

    deadline.setDate(deadline.getDate() + Math.min(Math.floor(days), 14));
    return { deadline };
}

async function disableTransferAnnouncement(
    botToken: string,
    channelId: string,
    messageId: string,
    label: string,
    gangId: string,
    reason: string
) {
    try {
        const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                components: [{
                    type: 1,
                    components: [
                        { type: 2, style: 2, label, custom_id: 'transfer_unavailable', disabled: true },
                    ],
                }],
            }),
        });

        if (!response.ok) {
            logWarn('api.server_transfer.announcement_disable_failed', {
                gangId,
                channelId,
                messageId,
                reason,
                statusCode: response.status,
                responseBody: await readResponseText(response),
            });
        }
    } catch (error) {
        logWarn('api.server_transfer.announcement_disable_error', {
            gangId,
            channelId,
            messageId,
            reason,
            error,
        });
    }
}

async function requireServerTransferOwnerAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'OWNER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            return NextResponse.json(
                { error: error.status === 401 ? 'Unauthorized' : 'เฉพาะหัวหน้าแก๊งเท่านั้น' },
                { status: error.status === 401 ? 401 : 403 }
            );
        }

        throw error;
    }
}

async function enforceServerTransferMutationRateLimit(
    req: Request,
    gangId: string,
    actorDiscordId: string,
    action: keyof typeof SERVER_TRANSFER_RATE_LIMITS
) {
    return enforceRouteRateLimit(req, {
        scope: `api:server-transfer:${action}`,
        limit: SERVER_TRANSFER_RATE_LIMITS[action],
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('server-transfer', action, gangId, actorDiscordId),
    });
}

// ─── GET: Transfer status ───
export async function GET(req: Request, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const forbiddenResponse = await requireServerTransferOwnerAccess(params.gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
            columns: {
                transferStatus: true,
                transferDeadline: true,
                transferStartedAt: true,
            },
        });
        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        if (gang.transferStatus !== 'ACTIVE') {
            return NextResponse.json({ transferStatus: gang.transferStatus });
        }

        // Count member transfer statuses
        const allActive = await db.query.members.findMany({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true, transferStatus: true, gangRole: true },
        });

        const confirmed = allActive.filter(m => m.transferStatus === 'CONFIRMED' || m.gangRole === 'OWNER');
        const left = allActive.filter(m => m.transferStatus === 'LEFT');
        const pending = allActive.filter(m => (!m.transferStatus || m.transferStatus === 'PENDING') && m.gangRole !== 'OWNER');

        // Check if deadline passed
        const now = new Date();
        const deadlinePassed = gang.transferDeadline ? now > new Date(gang.transferDeadline) : false;

        return NextResponse.json({
            transferStatus: 'ACTIVE',
            deadline: gang.transferDeadline ? new Date(gang.transferDeadline).toISOString() : null,
            startedAt: gang.transferStartedAt ? new Date(gang.transferStartedAt).toISOString() : null,
            deadlinePassed,
            counts: {
                total: allActive.length,
                confirmed: confirmed.length,
                left: left.length,
                pending: pending.length,
            },
            members: allActive.map(m => ({
                id: m.id,
                name: m.name,
                transferStatus: m.transferStatus || 'PENDING',
                gangRole: m.gangRole,
            })),
        });

    } catch (error) {
        logError('api.server_transfer.status.failed', error, {
            gangId: params.gangId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── POST: Start transfer ───
export async function POST(req: Request, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    let postedTransferAnnouncement: {
        botToken: string;
        channelId: string;
        messageId: string;
    } | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const forbiddenResponse = await requireServerTransferOwnerAccess(params.gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceServerTransferMutationRateLimit(
            req,
            params.gangId,
            session.user.discordId,
            'start'
        );
        if (rateLimited) {
            return rateLimited;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
            with: { settings: true },
        });
        if (!gang) return NextResponse.json({ error: 'Gang not found' }, { status: 404 });

        // Prevent double transfer
        if (gang.transferStatus === 'ACTIVE') {
            return NextResponse.json({ error: 'มีการย้ายเซิร์ฟกำลังดำเนินการอยู่แล้ว' }, { status: 400 });
        }

        const { body, response: invalidBodyResponse } = await readStartBody(req);
        if (invalidBodyResponse) {
            return invalidBodyResponse;
        }

        const confirmationText = typeof body.confirmationText === 'string' ? body.confirmationText : '';
        if (confirmationText.trim() !== gang.name.trim()) {
            return NextResponse.json(
                { error: 'กรุณาพิมพ์ชื่อแก๊งให้ตรงก่อนเริ่มย้ายเซิร์ฟเวอร์' },
                { status: 400 }
            );
        }

        const { deadline, response: invalidDeadlineResponse } = resolveTransferDeadline(body);
        if (invalidDeadlineResponse) {
            return invalidDeadlineResponse;
        }

        const results: string[] = [];
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const channelId = gang.settings?.announcementChannelId;

        if (!botToken) {
            return NextResponse.json(
                { error: 'ยังไม่ได้ตั้งค่า DISCORD_BOT_TOKEN จึงเริ่มย้ายเซิร์ฟแบบ production ไม่ได้' },
                { status: 503 }
            );
        }

        if (!channelId) {
            return NextResponse.json(
                { error: 'กรุณาตั้งค่าห้องประกาศก่อนเริ่มย้ายเซิร์ฟ' },
                { status: 400 }
            );
        }

        const activeMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, discordId: true, name: true, gangRole: true },
        });

        const ownerMember = activeMembers.find(m => m.gangRole === 'OWNER');
        if (!ownerMember) {
            return NextResponse.json(
                { error: 'ไม่พบหัวหน้าแก๊งที่ active อยู่ในระบบ กรุณาแก้ข้อมูลสมาชิกก่อนเริ่มย้ายเซิร์ฟ' },
                { status: 400 }
            );
        }

        const pendingCount = activeMembers.filter(m => m.gangRole !== 'OWNER').length;
        if (pendingCount < 1) {
            return NextResponse.json(
                { error: 'ต้องมีสมาชิกอย่างน้อย 1 คนที่ต้องยืนยันก่อนเริ่มย้ายเซิร์ฟ' },
                { status: 400 }
            );
        }

        let transferMessageId: string | null = null;
        let transferChannelId: string | null = null;

        // Send Discord announcement before destructive work so members always have a way to respond.
        try {
            const deadlineStr = deadline.toLocaleDateString('th-TH', {
                timeZone: 'Asia/Bangkok',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
            const ownerName = ownerMember.name || gang.name;

            const embed = {
                title: '🔄 แก๊งย้ายเซิร์ฟเกม!',
                description:
                    `หัวหน้าแก๊ง **${gang.name}** ได้ตัดสินใจย้ายเซิร์ฟเกมแล้ว!\n` +
                    `กดปุ่มด้านล่างเพื่อยืนยันว่าจะ **ตามไปด้วย** หรือ **ออกจากแก๊ง** ก่อน deadline`,
                color: 0xFF8C00,
                fields: [
                    { name: `✅ ตามไป (1)`, value: `> ✅ ${ownerName} 👑`, inline: true },
                    { name: `❌ ออก (0)`, value: `> -`, inline: true },
                    { name: `⏳ รอยืนยัน`, value: `${pendingCount} คน`, inline: true },
                ],
                footer: { text: `สมาชิกทั้งหมดที่ต้องยืนยัน: ${pendingCount} คน • ⏰ Deadline: ${deadlineStr}` },
                timestamp: new Date().toISOString(),
            };

            const components = [{
                type: 1,
                components: [
                    { type: 2, style: 3, label: '✅ ตามไปด้วย', custom_id: `transfer_confirm_${params.gangId}` },
                    { type: 2, style: 4, label: '❌ ออกจากแก๊ง', custom_id: `transfer_leave_${params.gangId}` },
                ],
            }];

            const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                method: 'POST',
                headers: {
                    Authorization: `Bot ${botToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: '@everyone 📢 **แก๊งย้ายเซิร์ฟเกม!**',
                    embeds: [embed],
                    components,
                    allowed_mentions: { parse: ['everyone'] },
                }),
            });

            if (!res.ok) {
                const responseBody = await readResponseText(res);
                logWarn('api.server_transfer.start.discord_post_failed', {
                    gangId: params.gangId,
                    channelId,
                    statusCode: res.status,
                    responseBody,
                });
                return NextResponse.json(
                    { error: 'ส่งประกาศไป Discord ไม่สำเร็จ ระบบยังไม่ลบข้อมูล กรุณาตรวจสอบสิทธิ์บอทและห้องประกาศ' },
                    { status: 502 }
                );
            }

            const data = await res.json();
            const messageId = String(data.id);
            transferMessageId = messageId;
            transferChannelId = channelId;
            postedTransferAnnouncement = {
                botToken,
                channelId,
                messageId,
            };
            results.push('ส่งประกาศไป Discord แล้ว');
        } catch (e) {
            logError('api.server_transfer.start.discord_post_error', e, {
                gangId: params.gangId,
                channelId,
            });
            return NextResponse.json(
                { error: 'เชื่อมต่อ Discord ไม่สำเร็จ ระบบยังไม่ลบข้อมูล' },
                { status: 502 }
            );
        }

        await db.transaction(async (tx) => {
        // 1. Reset ALL data
        await tx.delete(transactions).where(eq(transactions.gangId, params.gangId));
        await tx.update(gangs)
            .set({ balance: 0, updatedAt: new Date() })
            .where(eq(gangs.id, params.gangId));
        await tx.update(members)
            .set({ balance: 0 })
            .where(eq(members.gangId, params.gangId));
        results.push('ล้างข้อมูลการเงิน + ยอดสมาชิกทั้งหมดแล้ว');

        const sessions = await tx.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, params.gangId),
            columns: { id: true },
        });
        if (sessions.length > 0) {
            for (const s of sessions) {
                await tx.delete(attendanceRecords).where(eq(attendanceRecords.sessionId, s.id));
            }
            await tx.delete(attendanceSessions).where(eq(attendanceSessions.gangId, params.gangId));
        }
        results.push('ล้างประวัติเช็คชื่อแล้ว');

        await tx.delete(leaveRequests).where(eq(leaveRequests.gangId, params.gangId));
        results.push('ล้างประวัติการลาแล้ว');

        // 2. Owner auto-confirmed, others PENDING
        for (const m of activeMembers) {
            await tx.update(members)
                .set({ transferStatus: m.gangRole === 'OWNER' ? 'CONFIRMED' : 'PENDING' })
                .where(eq(members.id, m.id));
        }

        // 3. Save transfer state to gang
        await tx.update(gangs)
            .set({
                transferStatus: 'ACTIVE',
                transferDeadline: deadline,
                transferStartedAt: new Date(),
                transferMessageId,
                transferChannelId,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, params.gangId));
        });
        postedTransferAnnouncement = null;

        return NextResponse.json({
            success: true,
            results,
            deadline: deadline.toISOString(),
            memberCount: activeMembers.length,
        });

    } catch (error) {
        const announcementToDisable = postedTransferAnnouncement as {
            botToken: string;
            channelId: string;
            messageId: string;
        } | null;
        if (announcementToDisable) {
            await disableTransferAnnouncement(
                announcementToDisable.botToken,
                announcementToDisable.channelId,
                announcementToDisable.messageId,
                '⚠️ เริ่มย้ายเซิร์ฟไม่สำเร็จ',
                params.gangId,
                'start_failed_after_discord_announcement'
            );
        }

        logError('api.server_transfer.start.failed', error, {
            gangId: params.gangId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── DELETE: Cancel transfer ───
export async function DELETE(req: Request, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const forbiddenResponse = await requireServerTransferOwnerAccess(params.gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceServerTransferMutationRateLimit(
            req,
            params.gangId,
            session.user.discordId,
            'cancel'
        );
        if (rateLimited) {
            return rateLimited;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
        });
        if (!gang || gang.transferStatus !== 'ACTIVE') {
            return NextResponse.json({ error: 'ไม่มีการย้ายเซิร์ฟที่กำลังดำเนินการ' }, { status: 400 });
        }

        // Disable Discord buttons
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken && gang.transferChannelId && gang.transferMessageId) {
            try {
                await fetch(`https://discord.com/api/v10/channels/${gang.transferChannelId}/messages/${gang.transferMessageId}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, style: 2, label: '🚫 ยกเลิกแล้ว', custom_id: 'transfer_cancelled', disabled: true },
                            ],
                        }],
                    }),
                });
            } catch (e) {
                logWarn('api.server_transfer.cancel.message_update_failed', {
                    gangId: params.gangId,
                    channelId: gang.transferChannelId,
                    messageId: gang.transferMessageId,
                    error: e,
                });
            }
        }

        // Reset gang transfer state
        await db.update(gangs)
            .set({
                transferStatus: 'CANCELLED',
                transferMessageId: null,
                transferChannelId: null,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, params.gangId));

        // Reset all member transferStatus
        await db.update(members)
            .set({ transferStatus: null })
            .where(eq(members.gangId, params.gangId));

        return NextResponse.json({ success: true, message: 'ยกเลิกการย้ายเซิร์ฟแล้ว' });

    } catch (error) {
        logError('api.server_transfer.cancel.failed', error, {
            gangId: params.gangId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

// ─── PATCH: Force complete (stop + deactivate non-confirmed) ───
export async function PATCH(req: Request, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const forbiddenResponse = await requireServerTransferOwnerAccess(params.gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceServerTransferMutationRateLimit(
            req,
            params.gangId,
            session.user.discordId,
            'complete'
        );
        if (rateLimited) {
            return rateLimited;
        }

        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, params.gangId),
        });
        if (!gang || gang.transferStatus !== 'ACTIVE') {
            return NextResponse.json({ error: 'ไม่มีการย้ายเซิร์ฟที่กำลังดำเนินการ' }, { status: 400 });
        }

        // Deactivate members who didn't confirm
        const pendingMembers = await db.query.members.findMany({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED'),
            ),
        });

        let deactivatedCount = 0;
        const membersToDeactivate: typeof pendingMembers = [];
        for (const m of pendingMembers) {
            if (m.transferStatus !== 'CONFIRMED' && m.gangRole !== 'OWNER') {
                await db.update(members)
                    .set({ isActive: false, transferStatus: 'LEFT' })
                    .where(eq(members.id, m.id));
                membersToDeactivate.push(m);
                deactivatedCount++;
            }
        }

        // Members who did not transfer will have their gang roles removed.
        const memberRole = await db.query.gangRoles.findFirst({
            where: and(
                eq(gangRoles.gangId, params.gangId),
                eq(gangRoles.permissionLevel, 'MEMBER')
            )
        });
        const discordRoleId = memberRole?.discordRoleId;
        const guildId = gang.discordGuildId;
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (botToken && discordRoleId && guildId) {
            for (const m of membersToDeactivate) {
                if (m.discordId) {
                    try {
                        const url = `https://discord.com/api/v10/guilds/${guildId}/members/${m.discordId}/roles/${discordRoleId}`;
                        await fetch(url, {
                            method: 'DELETE',
                            headers: { Authorization: `Bot ${botToken}` },
                        });
                        logInfo('api.server_transfer.complete.role_removed', {
                            gangId: params.gangId,
                            discordId: m.discordId,
                            roleId: discordRoleId,
                        });
                    } catch (e) {
                        logWarn('api.server_transfer.complete.role_remove_failed', {
                            gangId: params.gangId,
                            discordId: m.discordId,
                            roleId: discordRoleId,
                            error: e,
                        });
                    }
                }
            }
        }

        // Disable Discord buttons
        if (botToken && gang.transferChannelId && gang.transferMessageId) {
            try {
                await fetch(`https://discord.com/api/v10/channels/${gang.transferChannelId}/messages/${gang.transferMessageId}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        components: [{
                            type: 1,
                            components: [
                                { type: 2, style: 2, label: '✅ ย้ายเซิร์ฟเสร็จสิ้น', custom_id: 'transfer_done', disabled: true },
                            ],
                        }],
                    }),
                });
            } catch (e) {
                logWarn('api.server_transfer.complete.message_update_failed', {
                    gangId: params.gangId,
                    channelId: gang.transferChannelId,
                    messageId: gang.transferMessageId,
                    error: e,
                });
            }
        }

        // Mark transfer complete
        await db.update(gangs)
            .set({
                transferStatus: 'COMPLETED',
                transferMessageId: null,
                transferChannelId: null,
                updatedAt: new Date(),
            })
            .where(eq(gangs.id, params.gangId));

        // Clear member transferStatus
        await db.update(members)
            .set({ transferStatus: null })
            .where(eq(members.gangId, params.gangId));

        return NextResponse.json({
            success: true,
            message: 'ย้ายเซิร์ฟเสร็จสิ้น',
            deactivatedCount,
        });

    } catch (error) {
        logError('api.server_transfer.complete.failed', error, {
            gangId: params.gangId,
        });
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
