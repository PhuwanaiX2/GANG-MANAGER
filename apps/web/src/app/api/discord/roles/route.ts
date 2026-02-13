import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth'; // Adjust path if needed
import { db, gangs, members } from '@gang/database'; // Adjust path
import { eq, and } from 'drizzle-orm';
import { getDiscordRoles } from '@/lib/discord-api';

// GET /api/discord/roles?guildId=...
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
        const roles = await getDiscordRoles(guildId);
        return NextResponse.json(roles);
    } catch (error) {
        console.error('Internal API Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
