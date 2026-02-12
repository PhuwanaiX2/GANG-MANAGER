// Debug timezone/dates for the most recent sessions
import { db, attendanceSessions } from '@gang/database';
import { eq, desc } from 'drizzle-orm';

const GANG_ID = 'L4Xntq7zKGrtPSkRtbYW5';

async function debug() {
    const sessions = await db.query.attendanceSessions.findMany({
        where: eq(attendanceSessions.gangId, GANG_ID),
        orderBy: desc(attendanceSessions.createdAt),
        limit: 5,
    });

    for (const s of sessions) {
        console.log(`\nSession: ${s.sessionName} (${s.id})`);
        console.log(`  Status: ${s.status}`);
        console.log(`  sessionDate (raw): ${s.sessionDate}`);
        console.log(`  sessionDate (type): ${typeof s.sessionDate}`);
        console.log(`  sessionDate (ISO): ${s.sessionDate instanceof Date ? s.sessionDate.toISOString() : s.sessionDate}`);
        console.log(`  startTime (raw): ${s.startTime}`);
        console.log(`  startTime (type): ${typeof s.startTime}`);
        console.log(`  startTime (ISO): ${s.startTime instanceof Date ? s.startTime.toISOString() : s.startTime}`);
        console.log(`  endTime (raw): ${s.endTime}`);
        console.log(`  endTime (type): ${typeof s.endTime}`);
        console.log(`  endTime (ISO): ${s.endTime instanceof Date ? s.endTime.toISOString() : s.endTime}`);
        console.log(`  createdAt (raw): ${s.createdAt}`);
        console.log(`  absentPenalty: ${s.absentPenalty}`);

        // Compare with "now"
        const now = new Date();
        const start = new Date(s.startTime);
        const end = new Date(s.endTime);
        console.log(`  --- Comparison ---`);
        console.log(`  now (UTC): ${now.toISOString()}`);
        console.log(`  now (local): ${now.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
        console.log(`  startTime <= now: ${start <= now}`);
        console.log(`  endTime <= now: ${end <= now}`);
    }
}

debug().catch(console.error);
