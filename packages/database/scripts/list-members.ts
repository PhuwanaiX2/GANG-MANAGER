
import { db, members } from './src';
import { eq } from 'drizzle-orm';

async function main() {
    console.log('Fetching members...');
    const allMembers = await db.query.members.findMany();
    console.log('Found members:', allMembers.map(m => `${m.name} (${m.discordId}) - ${m.gangRole}`));
}

main().catch(console.error);
