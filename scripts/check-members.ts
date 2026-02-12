
import { db, members } from '@gang/database';
import { eq } from 'drizzle-orm';

async function main() {
    const gangId = 'L4Xntq7zKGrtPSkRtbYW5'; // From previous context
    console.log(`Checking members for gang: ${gangId}`);

    const memberList = await db.query.members.findMany({
        where: eq(members.gangId, gangId),
        columns: {
            id: true,
            name: true,
            discordId: true,
            status: true,
            gangRole: true
        }
    });

    console.table(memberList);
}

main().catch(console.error);
