
import { db, transactions, members } from '@gang/database';
import { desc, eq } from 'drizzle-orm';

async function main() {
    const gangId = 'L4Xntq7zKGrtPSkRtbYW5';
    console.log(`Checking latest transaction for gang: ${gangId}`);

    const latestTx = await db.query.transactions.findFirst({
        where: eq(transactions.gangId, gangId),
        orderBy: desc(transactions.createdAt),
        with: {
            createdBy: true,
            member: true
        }
    });

    if (!latestTx) {
        console.log('No transactions found.');
        return;
    }

    console.log('Latest Transaction:');
    console.log(`ID: ${latestTx.id}`);
    console.log(`Type: ${latestTx.type}`);
    console.log(`Amount: ${latestTx.amount}`);
    console.log(`CreatedById (Raw): ${latestTx.createdById}`);
    console.log(`CreatedBy (Joined):`, latestTx.createdBy);
    console.log(`Timestamp: ${latestTx.createdAt}`);
}

main().catch(console.error);
