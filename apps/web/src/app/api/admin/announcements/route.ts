import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, systemAnnouncements } from '@gang/database';
import { eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';
import { isAdminDiscordId } from '@/lib/adminAuth';

async function isAdmin() {
    const session = await getServerSession(authOptions);
    return isAdminDiscordId(session?.user?.discordId) ? session : null;
}

export async function GET(request: NextRequest) {
    const session = await isAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:announcements:get',
        limit: 30,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-announcements-get', session.user.discordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const all = await db.query.systemAnnouncements.findMany({
        orderBy: desc(systemAnnouncements.createdAt),
    });

    return NextResponse.json(all);
}

export async function POST(request: NextRequest) {
    const session = await isAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:announcements:post',
        limit: 20,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-announcements-post', session.user.discordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const body = await request.json();
    const { title, content, type, expiresAt } = body;

    if (!title || !content) {
        return NextResponse.json({ error: 'Title and content required' }, { status: 400 });
    }

    const id = randomUUID();
    await db.insert(systemAnnouncements).values({
        id,
        title,
        content,
        type: type || 'INFO',
        isActive: true,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy: session.user.discordId,
        createdByName: session.user.name || 'Admin',
        createdAt: new Date(),
        updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, id });
}

export async function PATCH(request: NextRequest) {
    const session = await isAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:announcements:patch',
        limit: 20,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-announcements-patch', session.user.discordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const body = await request.json();
    const { id, isActive, title, content, type } = body;

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (title) updates.title = title;
    if (content) updates.content = content;
    if (type) updates.type = type;

    await db.update(systemAnnouncements).set(updates).where(eq(systemAnnouncements.id, id));

    return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
    const session = await isAdmin();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

    const rateLimited = await enforceRouteRateLimit(request, {
        scope: 'api:admin:announcements:delete',
        limit: 15,
        windowMs: 60 * 1000,
        subject: buildRateLimitSubject('admin-announcements-delete', session.user.discordId),
    });
    if (rateLimited) {
        return rateLimited;
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await db.delete(systemAnnouncements).where(eq(systemAnnouncements.id, id));

    return NextResponse.json({ success: true });
}
