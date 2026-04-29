import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, announcements, gangs, gangSettings } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { logError, logWarn } from '@/lib/logger';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

async function readResponseText(response: Response) {
    try {
        return await response.text();
    } catch (error) {
        return `[unavailable:${error instanceof Error ? error.message : 'read_failed'}]`;
    }
}

async function requireAnnouncementCreateAccess(gangId: string) {
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

function buildDiscordAnnouncementPayload(content: string, mentionEveryone: boolean) {
    const lines = content.split('\n');
    lines[0] = `# ${lines[0]}`;
    const formattedContent = lines.join('\n');

    return {
        content: mentionEveryone ? `@everyone\n${formattedContent}` : formattedContent,
        allowed_mentions: {
            parse: mentionEveryone ? ['everyone'] : [],
        },
    };
}

// GET - List all announcements for a gang
export async function GET(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;

        const allAnnouncements = await db.query.announcements.findMany({
            where: eq(announcements.gangId, gangId),
            orderBy: [desc(announcements.createdAt)],
        });

        return NextResponse.json(allAnnouncements);
    } catch (error) {
        logError('api.announcements.list.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new announcement and post to Discord
export async function POST(request: NextRequest, props: { params: Promise<{ gangId: string }> }) {
    const params = await props.params;
    const gangId = params.gangId;
    let actorDiscordId: string | null = null;

    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }
        actorDiscordId = session.user.discordId;
        const body = await request.json();
        const { content, mentionEveryone = false } = body as { content: string; mentionEveryone?: boolean };

        if (!content) {
            return NextResponse.json({ error: 'กรุณากรอกเนื้อหาประกาศ' }, { status: 400 });
        }

        // Check permissions (Admin or Owner)
        const forbiddenResponse = await requireAnnouncementCreateAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:announcements:create',
            limit: 20,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('announcements-create', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        // Get gang info
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: { settings: true },
        });

        if (!gang) {
            return NextResponse.json({ error: 'ไม่พบแก๊ง' }, { status: 404 });
        }

        let discordMessageId: string | null = null;
        let discordWarning: string | null = null;

        // Post to Discord announcement channel
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const channelId = gang.settings?.announcementChannelId;

        if (botToken && channelId) {
            try {
                const messagePayload = buildDiscordAnnouncementPayload(content, mentionEveryone);

                const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messagePayload),
                });

                if (res.ok) {
                    const data = await res.json();
                    discordMessageId = data.id;
                    if (mentionEveryone && data.mention_everyone !== true) {
                        discordWarning = 'mention_everyone_not_applied';
                        logWarn('api.announcements.discord_mention_everyone_not_applied', {
                            gangId,
                            actorDiscordId,
                            channelId,
                            discordMessageId,
                        });
                    }
                } else {
                    const responseBody = await readResponseText(res);
                    discordWarning = 'discord_post_failed';
                    logWarn('api.announcements.discord_post_failed', {
                        gangId,
                        actorDiscordId,
                        channelId,
                        mentionEveryone,
                        statusCode: res.status,
                        responseBody,
                    });
                }
            } catch (e) {
                discordWarning = 'discord_post_error';
                logWarn('api.announcements.discord_post_error', {
                    gangId,
                    actorDiscordId,
                    channelId,
                    mentionEveryone,
                    error: e,
                });
            }
        } else {
            discordWarning = 'discord_not_configured';
        }

        // Save to database
        const newAnnouncement = await db.insert(announcements).values({
            id: nanoid(),
            gangId,
            title: '', // No longer used, useHeading prepends # to first line instead
            content,
            authorId: session.user.discordId,
            authorName: session.user.name || 'Unknown',
            discordMessageId,
        }).returning();

        return NextResponse.json({
            success: true,
            announcement: newAnnouncement[0],
            discord: {
                posted: Boolean(discordMessageId),
                mentionEveryoneRequested: mentionEveryone,
                warning: discordWarning,
            },
        });
    } catch (error) {
        logError('api.announcements.create.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

