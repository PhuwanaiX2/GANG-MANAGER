import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, attendanceSessions, gangSettings, gangs, auditLogs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { isGangAccessError, requireGangAccess } from '@/lib/gangAccess';
import { isFeatureEnabled } from '@/lib/tierGuard';
import { logError } from '@/lib/logger';
import { buildRateLimitSubject, enforceRouteRateLimit } from '@/lib/apiRateLimit';

async function requireAttendanceCreateAccess(gangId: string) {
    try {
        await requireGangAccess({ gangId, minimumRole: 'ATTENDANCE_OFFICER' });
        return null;
    } catch (error) {
        if (isGangAccessError(error)) {
            if (error.status === 401) {
                return new NextResponse('Unauthorized', { status: 401 });
            }

            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
        }

        throw error;
    }
}

function parseDateInput(value: unknown) {
    if (typeof value !== 'string' && !(value instanceof Date)) {
        return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// GET - List all attendance sessions
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

        const sessions = await db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: (s, { desc }) => desc(s.sessionDate),
            with: {
                records: true,
            },
        });

        return NextResponse.json(sessions);
    } catch (error) {
        logError('api.attendance.list.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create new attendance session and send to Discord
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

        // Global feature flag check
        if (!(await isFeatureEnabled('attendance'))) {
            return NextResponse.json({ error: 'ฟีเจอร์นี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ' }, { status: 503 });
        }

        const body = await request.json();
        const {
            sessionName,
            sessionDate,
            startTime,
            endTime,
            absentPenalty,
        } = body;

        if (!sessionName || !sessionDate || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Check permissions (Admin or Owner or Attendance Officer)
        const forbiddenResponse = await requireAttendanceCreateAccess(gangId);
        if (forbiddenResponse) {
            return forbiddenResponse;
        }

        const rateLimited = await enforceRouteRateLimit(request, {
            scope: 'api:attendance:create',
            limit: 20,
            windowMs: 60 * 1000,
            subject: buildRateLimitSubject('attendance-create', gangId, actorDiscordId),
        });
        if (rateLimited) {
            return rateLimited;
        }

        const parsedSessionDate = parseDateInput(sessionDate);
        const parsedStartTime = parseDateInput(startTime);
        const parsedEndTime = parseDateInput(endTime);

        if (!parsedSessionDate || !parsedStartTime || !parsedEndTime) {
            return NextResponse.json({ error: 'Invalid session date or time' }, { status: 400 });
        }

        if (parsedEndTime.getTime() <= parsedStartTime.getTime()) {
            return NextResponse.json({ error: 'End time must be after start time' }, { status: 400 });
        }

        // Get gang settings for channel ID
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            with: { settings: true },
        });

        if (!gang) {
            return NextResponse.json({ error: 'Gang not found' }, { status: 404 });
        }

        // Create session in database (SCHEDULED - not active yet)
        const sessionId = nanoid();
        const newSession = await db.insert(attendanceSessions).values({
            id: sessionId,
            gangId,
            sessionName,
            sessionDate: parsedSessionDate,
            startTime: parsedStartTime,
            endTime: parsedEndTime,
            absentPenalty: absentPenalty ?? gang.settings?.defaultAbsentPenalty ?? 0,
            status: 'SCHEDULED', // Not active until manually started
            createdById: session.user.discordId,
        }).returning();

        await db.insert(auditLogs).values({
            id: nanoid(),
            gangId,
            actorId: session.user.discordId,
            actorName: session.user.name || 'Unknown',
            action: 'ATTENDANCE_CREATE',
            targetType: 'ATTENDANCE_SESSION',
            targetId: sessionId,
            oldValue: JSON.stringify(null),
            newValue: JSON.stringify({
                sessionName,
                sessionDate: parsedSessionDate,
                startTime: parsedStartTime,
                endTime: parsedEndTime,
                absentPenalty: absentPenalty ?? gang.settings?.defaultAbsentPenalty ?? 0,
                status: 'SCHEDULED',
            }),
            details: JSON.stringify({
                sessionId,
                sessionName,
            }),
        });

        // Session created - Discord message will be sent when manually started
        return NextResponse.json({
            success: true,
            session: newSession[0],
        });
    } catch (error) {
        logError('api.attendance.create.failed', error, {
            gangId,
            actorDiscordId,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
