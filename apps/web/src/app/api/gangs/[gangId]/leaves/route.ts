import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { db, gangs, members, leaveRequests, createLeaveRequest, CreateLeaveRequestError, buildLeaveRequestDiscordEmbed } from '@gang/database';
import { and, eq } from 'drizzle-orm';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { logError, logWarn } from '@/lib/logger';

const createLeaveSchema = z.discriminatedUnion('type', [
    z.object({
        type: z.literal('FULL'),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reason: z.string().max(500).optional(),
    }),
    z.object({
        type: z.literal('LATE'),
        lateDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        lateTime: z.string().regex(/^\d{2}:\d{2}$/),
        reason: z.string().max(500).optional(),
    }),
]);

function toBangkokDayStart(dateText: string) {
    return new Date(`${dateText}T00:00:00+07:00`);
}

function toBangkokDayEnd(dateText: string) {
    return new Date(`${dateText}T23:59:59.999+07:00`);
}

function toBangkokDateTime(dateText: string, timeText: string) {
    return new Date(`${dateText}T${timeText}:00+07:00`);
}

export async function POST(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        if (!(await isFeatureEnabled('leave'))) {
            return NextResponse.json({ error: 'ฟีเจอร์นี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ' }, { status: 503 });
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:leaves:create',
            limit: 20,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('leaves-create', params.gangId, session.user.discordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const member = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, params.gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
        });

        if (!member) {
            return NextResponse.json({ error: 'ไม่พบสมาชิกในแก๊งนี้' }, { status: 404 });
        }

        const body = await request.json();
        const payload = createLeaveSchema.parse(body);

        const leaveInput = payload.type === 'FULL'
            ? {
                type: 'FULL' as const,
                startDate: toBangkokDayStart(payload.startDate),
                endDate: toBangkokDayEnd(payload.endDate),
                reason: payload.reason,
            }
            : {
                type: 'LATE' as const,
                startDate: toBangkokDateTime(payload.lateDate, payload.lateTime),
                endDate: toBangkokDateTime(payload.lateDate, payload.lateTime),
                reason: payload.reason,
            };

        const { createdRequest } = await createLeaveRequest(db, {
            gangId: params.gangId,
            memberId: member.id,
            type: leaveInput.type,
            startDate: leaveInput.startDate,
            endDate: leaveInput.endDate,
            reason: leaveInput.reason,
            actorDiscordId: session.user.discordId,
            actorName: session.user.name || member.name,
        });

        try {
            const gang = await db.query.gangs.findFirst({
                where: eq(gangs.id, params.gangId),
                with: {
                    settings: true,
                },
            });

            const requestsChannelId = gang?.settings?.requestsChannelId;
            if (requestsChannelId && process.env.DISCORD_BOT_TOKEN) {
                const requestEmbed = buildLeaveRequestDiscordEmbed({
                    type: createdRequest.type,
                    startDate: createdRequest.startDate,
                    endDate: createdRequest.endDate,
                    reason: createdRequest.reason,
                    memberName: member.name,
                    memberDiscordId: member.discordId,
                    thumbnailUrl: member.discordAvatar,
                    requestedAt: createdRequest.requestedAt,
                });

                const discordResponse = await fetch(`https://discord.com/api/v10/channels/${requestsChannelId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bot ${process.env.DISCORD_BOT_TOKEN}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        content: '@here มีใบลาใหม่',
                        embeds: [requestEmbed],
                        components: [{
                            type: 1,
                            components: [
                                {
                                    type: 2,
                                    style: 3,
                                    label: '✅ อนุมัติ',
                                    custom_id: `leave_approve_${createdRequest.id}`,
                                },
                                {
                                    type: 2,
                                    style: 4,
                                    label: '❌ ปฏิเสธ',
                                    custom_id: `leave_reject_${createdRequest.id}`,
                                },
                            ],
                        }],
                    }),
                });

                if (discordResponse.ok) {
                    const discordMessage = await discordResponse.json().catch(() => null);

                    if (discordMessage?.id) {
                        await db.update(leaveRequests)
                            .set({
                                requestsChannelId,
                                requestsMessageId: discordMessage.id,
                            })
                            .where(and(
                                eq(leaveRequests.id, createdRequest.id),
                                eq(leaveRequests.gangId, params.gangId)
                            ));
                    }
                }
            }
        } catch (notificationError) {
            logWarn('api.leaves.create.notification_failed', {
                gangId: params.gangId,
                memberId: member.id,
                requestId: createdRequest.id,
                error: notificationError,
            });
        }

        return NextResponse.json({ success: true, request: createdRequest }, { status: 201 });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return NextResponse.json({ error: error.issues[0]?.message || 'ข้อมูลไม่ถูกต้อง' }, { status: 400 });
        }

        if (error instanceof CreateLeaveRequestError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }

        logError('api.leaves.create.failed', error, {
            gangId: params.gangId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
