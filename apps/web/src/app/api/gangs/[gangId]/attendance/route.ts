import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, attendanceSessions, gangSettings, gangs, auditLogs } from '@gang/database';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getGangPermissions } from '@/lib/permissions';
import { isFeatureEnabled } from '@/lib/tierGuard';

// GET - List all attendance sessions
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

        const sessions = await db.query.attendanceSessions.findMany({
            where: eq(attendanceSessions.gangId, gangId),
            orderBy: (s, { desc }) => desc(s.sessionDate),
            with: {
                records: true,
            },
        });

        return NextResponse.json(sessions);
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// POST - Create new attendance session and send to Discord
export async function POST(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Global feature flag check
        if (!await isFeatureEnabled('attendance')) {
            return NextResponse.json({ error: 'ฟีเจอร์นี้ถูกปิดใช้งานชั่วคราวโดยผู้ดูแลระบบ' }, { status: 503 });
        }

        const { gangId } = params;
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
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isAdmin && !permissions.isOwner && !permissions.isAttendanceOfficer) {
            return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
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
            sessionDate: new Date(sessionDate),
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            lateThreshold: gang.settings?.lateThresholdMinutes ?? 15,
            latePenalty: gang.settings?.defaultLatePenalty ?? 0,
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
                sessionDate: new Date(sessionDate),
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                lateThreshold: gang.settings?.lateThresholdMinutes ?? 15,
                latePenalty: gang.settings?.defaultLatePenalty ?? 0,
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
        console.error('Error creating session:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
