
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '../../apps/web/.env') });

import { db, members } from './src';
import { eq } from 'drizzle-orm';

async function main() {
    const targetName = 'Jiww Gegey'; // Based on screenshot
    console.log(`Updating role for ${targetName}...`);

    const member = await db.query.members.findFirst({
        where: (members, { eq }) => eq(members.name, targetName)
    });

    if (!member) {
        console.log('Member not found!');
        return;
    }

    await db.update(members)
        .set({ gangRole: 'OWNER' })
        .where(eq(members.id, member.id));

    console.log(`✅ Updated ${member.name} to OWNER`);
}

main().catch(console.error);
