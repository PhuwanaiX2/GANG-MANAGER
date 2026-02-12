import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(import.meta.dirname, '../../.env') });

import { db, gangs, members } from './src/index.js';

async function checkData() {
    console.log('=== Checking Gangs ===');
    const allGangs = await db.query.gangs.findMany();
    console.log(`Found ${allGangs.length} gangs:`);
    allGangs.forEach(g => console.log(`  - ID: ${g.id}, Name: ${g.name}, GuildId: ${g.discordGuildId}`));

    console.log('\n=== Checking Members ===');
    const allMembers = await db.query.members.findMany({
        with: { gang: true }
    });
    console.log(`Found ${allMembers.length} members:`);
    allMembers.forEach(m => {
        const gangName = m.gang?.name || '❌ NULL GANG';
        console.log(`  - ${m.name} (Discord: ${m.discordId}) -> Gang: ${gangName} (gangId: ${m.gangId})`);
    });

    // Check orphaned members (members with no gang)
    const orphaned = allMembers.filter(m => !m.gang);
    if (orphaned.length > 0) {
        console.log('\n⚠️ ORPHANED MEMBERS (have gangId but gang doesn\'t exist):');
        orphaned.forEach(m => console.log(`  - ${m.name} (gangId: ${m.gangId})`));
    }

    process.exit(0);
}

checkData().catch(console.error);
