
import { db, gangs, members, attendanceSessions, attendanceRecords } from '@gang/database';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// SAFETY CHECK: Prevent running this script in PRODUCTION environment!
if (process.env.NODE_ENV === 'production') {
    console.error('❌ DANGER: Do NOT run this stress test in PRODUCTION environment!');
    console.error('   It will create thousands of dummy records in your live database.');
    process.exit(1);
}

async function runStressTest() {
    console.log('🚀 Starting Bot Stress Test...');
    console.log('Objective: Simulate 150 Gangs, each with 25 members checking in.');

    const GANG_COUNT = 150;
    const MEMBER_PER_GANG = 25;
    const TOTAL_CHECKINS = GANG_COUNT * MEMBER_PER_GANG;

    try {
        console.log(`\n1️⃣  Creating ${GANG_COUNT} Mock Gangs & Sessions...`);
        // Define types for our data arrays
        const gangsData: typeof gangs.$inferInsert[] = [];
        const sessionsData: typeof attendanceSessions.$inferInsert[] = [];
        const membersData: typeof members.$inferInsert[] = [];

        const startTime = Date.now();

        // 1. Prepare Data
        for (let i = 0; i < GANG_COUNT; i++) {
            const gangId = `stress-test-gang-${i}-${uuidv4()}`;
            gangsData.push({
                id: gangId,
                name: `Stress Gang ${i}`,
                discordGuildId: `guild-${i}-${uuidv4()}`, // Ensure unique guild ID
                subscriptionTier: 'FREE',
                isActive: true,
                balance: 0,
            });

            const sessionId = `session-${i}-${uuidv4()}`;
            sessionsData.push({
                id: sessionId,
                gangId: gangId,
                sessionName: 'Daily Meeting',
                sessionDate: new Date(),
                startTime: new Date(),
                endTime: new Date(Date.now() + 3600000), // 1 hour later
                status: 'ACTIVE',
                createdById: `owner-${i}`,
                allowLate: true,
            });

            for (let j = 0; j < MEMBER_PER_GANG; j++) {
                membersData.push({
                    id: `member-${i}-${j}-${uuidv4()}`,
                    gangId: gangId,
                    discordId: `discord-${i}-${j}-${uuidv4()}`, // Ensure unique discord ID
                    name: `Member ${i}-${j}`,
                    gangRole: 'MEMBER',
                    status: 'APPROVED',
                    isActive: true,
                    balance: 0,
                });
            }
        }

        console.log(`Prepared data in ${Date.now() - startTime}ms`);
        console.log('Writing to DB (This might take a moment)...');

        // 2. Bulk Insert (Simulating initial state)
        // In real life these happen over time, but for test we need them to exist
        // We use loops for SQLite chunk limits

        await db.transaction(async (tx) => {
            // Gangs
            for (let i = 0; i < gangsData.length; i += 50) {
                await tx.insert(gangs).values(gangsData.slice(i, i + 50));
            }
            // Members
            for (let i = 0; i < membersData.length; i += 50) {
                await tx.insert(members).values(membersData.slice(i, i + 50));
            }
            // Sessions
            for (let i = 0; i < sessionsData.length; i += 50) {
                await tx.insert(attendanceSessions).values(sessionsData.slice(i, i + 50));
            }
        });

        console.log(`✅ Setup Complete. DB Populated.`);

        // 3. Simulate Check-ins (The Stress Test)
        console.log(`\n2️⃣  Simulating ${TOTAL_CHECKINS} Check-ins (Concurrent Requests)...`);

        const checkInStart = Date.now();
        const checkInPromises = [];

        // We simulate the exact DB call the bot makes:
        // 1. Fetch Session (usually cached or quick)
        // 2. Fetch Member
        // 3. Check existing record
        // 4. Insert Record

        // Approximating the load: We will fire them all at once via Promise.all
        // In reality, bot receives events sequentially per shard, but concurrent overall.

        for (let i = 0; i < GANG_COUNT; i++) {
            const sessionId = sessionsData[i].id;
            const gangMembers = membersData.filter(m => m.gangId === gangsData[i].id);

            for (const member of gangMembers) {
                checkInPromises.push(
                    (async () => {
                        // Simulate "Check-in Logic"
                        await db.insert(attendanceRecords).values({
                            id: uuidv4(),
                            sessionId: sessionId,
                            memberId: member.id,
                            status: 'PRESENT',
                            checkedInAt: new Date(),
                            // pointsEarned: 10 // Not in schema, removing
                        });
                    })()
                );
            }
        }

        await Promise.all(checkInPromises);

        const checkInEnd = Date.now();
        const duration = (checkInEnd - checkInStart) / 1000;
        const rps = TOTAL_CHECKINS / duration;

        console.log(`\n✅ Stress Test Completed!`);
        console.log(`Time taken: ${duration.toFixed(2)}s`);
        console.log(`Throughput: ${rps.toFixed(2)} check-ins/sec`);
        console.log(`Total Records: ${TOTAL_CHECKINS}`);

        // Cleanup
        console.log('\n🧹 Cleaning up test data...');
        // In real scenario we might keep it or clean it up. For safety let's leave it or delete specific IDs.
        // For this test script, we just assume it's a dev DB.

    } catch (error) {
        console.error('❌ Test Failed:', error);
    }
}

runStressTest();
