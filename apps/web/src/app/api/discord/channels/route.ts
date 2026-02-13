import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getDiscordChannels } from '@/lib/discord-api';

// GET /api/discord/channels?guildId=...
export async function GET(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const guildId = searchParams.get('guildId');

    if (!guildId) {
        return NextResponse.json({ error: 'Missing guildId' }, { status: 400 });
    }

    try {
        const channels = await getDiscordChannels(guildId);
        return NextResponse.json(channels);
    } catch (error) {
        console.error('Internal API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
