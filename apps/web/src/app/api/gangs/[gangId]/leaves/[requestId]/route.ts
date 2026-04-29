import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import {
    db,
    gangs,
    reviewLeaveRequest,
    LeaveReviewError,
    buildLeaveReviewDiscordEmbed,
} from '@gang/database';
import { authOptions } from '@/lib/auth';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { logError, logWarn } from '@/lib/logger';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

type RouteParams = {
    params: Promise<{
        gangId: string;
        requestId: string;
    }>;
};

type DiscordApiResponseLike = {
    ok: boolean;
    status?: number;
    text?: () => Promise<string>;
    json?: () => Promise<unknown>;
};

function isDiscordApiResponseLike(value: unknown): value is DiscordApiResponseLike {
    return value !== null && typeof value === 'object' && 'ok' in value;
}

async function readDiscordErrorBody(response: DiscordApiResponseLike) {
    try {
        if (typeof response.text === 'function') {
            const body = await response.text();
            return body || undefined;
        }
    } catch {
        return undefined;
    }

    return undefined;
}

async function requireLeaveReviewAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'ADMIN' });
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

export async function PATCH(request: NextRequest, props: RouteParams) {
    const params = await props.params;
    const { gangId, requestId } = params;
    let actorDiscordId = 'unknown';

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        actorDiscordId = session.user.discordId;

        if (!(await isFeatureEnabled('leave'))) {
            return NextResponse.json({ error: 'ฟีเจอร์นี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ' }, { status: 503 });
        }

        const body = await request.json();
        const { status, startDate, endDate } = body;

        const forbiddenResponse = await requireLeaveReviewAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return NextResponse.json({ error: 'สถานะไม่ถูกต้อง' }, { status: 400 });
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:leaves:review',
            limit: 40,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('leaves-review', gangId, requestId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const { leaveRequest, updatedRequest } = await reviewLeaveRequest(db, {
            gangId,
            requestId,
            status,
            reviewerDiscordId: session.user.discordId,
            reviewerName: session.user.name || session.user.discordId,
            startDate,
            endDate,
        });

        const reviewerName = session.user.name || session.user.discordId;
        const reviewEmbed = buildLeaveReviewDiscordEmbed({
            type: leaveRequest.type,
            startDate: updatedRequest.startDate,
            endDate: updatedRequest.endDate,
            reason: updatedRequest.reason,
            memberName: leaveRequest.member?.name || 'Unknown',
            reviewerName,
            status,
        });

        if (updatedRequest) {
            const discordToken = process.env.DISCORD_BOT_TOKEN;

            try {
                if (leaveRequest.requestsChannelId && leaveRequest.requestsMessageId && discordToken) {
                    const messageUpdateResponse = await fetch(
                        `https://discord.com/api/v10/channels/${leaveRequest.requestsChannelId}/messages/${leaveRequest.requestsMessageId}`,
                        {
                            method: 'PATCH',
                            headers: {
                                Authorization: `Bot ${discordToken}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                embeds: [reviewEmbed],
                                components: [],
                            }),
                        }
                    );

                    if (isDiscordApiResponseLike(messageUpdateResponse) && !messageUpdateResponse.ok) {
                        logWarn('api.leaves.review.message_update_failed', {
                            gangId,
                            requestId,
                            actorDiscordId,
                            statusCode: messageUpdateResponse.status,
                            responseBody: await readDiscordErrorBody(messageUpdateResponse),
                        });
                    }
                }

                const gang = await db.query.gangs.findFirst({
                    where: eq(gangs.id, gangId),
                    with: {
                        settings: true,
                    },
                });

                const logChannelId = gang?.settings?.logChannelId;
                if (logChannelId && discordToken) {
                    const logResponse = await fetch(`https://discord.com/api/v10/channels/${logChannelId}/messages`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bot ${discordToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ embeds: [reviewEmbed] }),
                    });

                    if (isDiscordApiResponseLike(logResponse) && !logResponse.ok) {
                        logWarn('api.leaves.review.audit_log_failed', {
                            gangId,
                            requestId,
                            actorDiscordId,
                            statusCode: logResponse.status,
                            responseBody: await readDiscordErrorBody(logResponse),
                        });
                    }
                }
            } catch (notificationError) {
                logWarn('api.leaves.review.notification_exception', {
                    gangId,
                    requestId,
                    actorDiscordId,
                    error: notificationError,
                });
            }

            if (leaveRequest.member?.discordId && discordToken) {
                try {
                    const dmChannelResponse = await fetch('https://discord.com/api/v10/users/@me/channels', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bot ${discordToken}`,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ recipient_id: leaveRequest.member.discordId }),
                    });

                    if (!isDiscordApiResponseLike(dmChannelResponse)) {
                        logWarn('api.leaves.review.dm_channel_invalid_response', {
                            gangId,
                            requestId,
                            requesterDiscordId: leaveRequest.member.discordId,
                            actorDiscordId,
                        });
                    } else if (!dmChannelResponse.ok) {
                        logWarn('api.leaves.review.dm_channel_failed', {
                            gangId,
                            requestId,
                            requesterDiscordId: leaveRequest.member.discordId,
                            actorDiscordId,
                            statusCode: dmChannelResponse.status,
                            responseBody: await readDiscordErrorBody(dmChannelResponse),
                        });
                    } else {
                        const dmChannel = await dmChannelResponse.json() as { id?: string };
                        if (!dmChannel?.id) {
                            logWarn('api.leaves.review.dm_channel_missing_id', {
                                gangId,
                                requestId,
                                requesterDiscordId: leaveRequest.member.discordId,
                                actorDiscordId,
                            });
                        } else {
                            const dmText = status === 'APPROVED'
                                ? '✅ รายการลาของคุณได้รับอนุมัติแล้วครับ'
                                : '❌ รายการลาของคุณถูกปฏิเสธครับ';

                            const dmMessageResponse = await fetch(
                                `https://discord.com/api/v10/channels/${dmChannel.id}/messages`,
                                {
                                    method: 'POST',
                                    headers: {
                                        Authorization: `Bot ${discordToken}`,
                                        'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({ content: dmText }),
                                }
                            );

                            if (isDiscordApiResponseLike(dmMessageResponse) && !dmMessageResponse.ok) {
                                logWarn('api.leaves.review.dm_send_failed', {
                                    gangId,
                                    requestId,
                                    requesterDiscordId: leaveRequest.member.discordId,
                                    actorDiscordId,
                                    statusCode: dmMessageResponse.status,
                                    responseBody: await readDiscordErrorBody(dmMessageResponse),
                                });
                            }
                        }
                    }
                } catch (dmError) {
                    logWarn('api.leaves.review.dm_exception', {
                        gangId,
                        requestId,
                        requesterDiscordId: leaveRequest.member.discordId,
                        actorDiscordId,
                        error: dmError,
                    });
                }
            }
        }

        return NextResponse.json({ success: true, request: updatedRequest });
    } catch (error) {
        if (error instanceof LeaveReviewError) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }

        logError('api.leaves.review.failed', error, {
            gangId,
            requestId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
