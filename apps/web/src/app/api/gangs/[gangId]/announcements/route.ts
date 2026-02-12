import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, announcements, gangs, gangSettings } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getGangPermissions } from '@/lib/permissions';

// GET - List all announcements for a gang
export async function GET(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId } = params;

        const allAnnouncements = await db.query.announcements.findMany({
            where: eq(announcements.gangId, gangId),
            orderBy: [desc(announcements.createdAt)],
        });

        return NextResponse.json(allAnnouncements);
    } catch (error) {
        console.error('Error fetching announcements:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create a new announcement and post to Discord
export async function POST(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId } = params;
        const body = await request.json();
        const { content, mentionEveryone = false } = body as { content: string; mentionEveryone?: boolean };

        if (!content) {
            return NextResponse.json({ error: 'กรุณากรอกเนื้อหาประกาศ' }, { status: 400 });
        }

        // Check permissions (Admin or Owner)
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner) {
            return NextResponse.json({ error: 'ไม่มีสิทธิ์ดำเนินการ' }, { status: 403 });
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

        // Post to Discord announcement channel
        const botToken = process.env.DISCORD_BOT_TOKEN;
        const channelId = gang.settings?.announcementChannelId;

        if (botToken && channelId) {
            try {
                // Build message content - always prepend # to first line for bigger text
                const lines = content.split('\n');
                lines[0] = `# ${lines[0]}`;
                let messageContent = lines.join('\n') + ' @everyone';

                const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bot ${botToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ content: messageContent }),
                });

                if (res.ok) {
                    const data = await res.json();
                    discordMessageId = data.id;
                } else {
                    console.error('Failed to post to Discord:', await res.text());
                }
            } catch (e) {
                console.error('Discord API error:', e);
            }
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

        return NextResponse.json({ success: true, announcement: newAnnouncement[0] });
    } catch (error) {
        console.error('Error creating announcement:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

