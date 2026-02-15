import { db, gangs, members, attendanceSessions, attendanceRecords, transactions, leaveRequests, auditLogs, gangRoles, gangSettings } from '@gang/database';
import { AttachmentBuilder, TextChannel } from 'discord.js';
import { client } from '../index';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours

export function startBackupScheduler() {
    console.log('💾 Backup scheduler started (Daily)');

    // Run interval
    setInterval(runBackup, BACKUP_INTERVAL_MS);
}

export async function runBackup() {
    const backupChannelId = process.env.BACKUP_CHANNEL_ID;
    if (!backupChannelId) {
        console.warn('⚠️ No BACKUP_CHANNEL_ID set. Skipping auto-backup.');
        return;
    }

    try {
        console.log('⏳ Starting Database Backup...');

        // Fetch all data
        const allData = {
            timestamp: new Date().toISOString(),
            gangs: await db.select().from(gangs),
            gangSettings: await db.select().from(gangSettings),
            gangRoles: await db.select().from(gangRoles),
            members: await db.select().from(members),
            attendanceSessions: await db.select().from(attendanceSessions),
            attendanceRecords: await db.select().from(attendanceRecords),
            leaveRequests: await db.select().from(leaveRequests),
            transactions: await db.select().from(transactions),
            auditLogs: await db.select().from(auditLogs),
        };

        const jsonString = JSON.stringify(allData, null, 2);
        const buffer = Buffer.from(jsonString, 'utf-8');
        const filename = `backup-${new Date().toISOString().split('T')[0]}.json`;

        const attachment = new AttachmentBuilder(buffer, { name: filename });

        const channel = await client.channels.fetch(backupChannelId);
        if (channel && channel.isTextBased()) {
            await (channel as TextChannel).send({
                content: `📦 **Database Backup** - ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`,
                files: [attachment]
            });
            console.log(`✅ Backup sent to Discord channel: ${filename}`);
        } else {
            console.error('❌ Backup channel not found or not text-based');
        }

    } catch (error) {
        console.error('❌ Backup failed:', error);
    }
}
