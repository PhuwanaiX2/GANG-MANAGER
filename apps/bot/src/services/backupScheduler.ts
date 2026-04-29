import { db, gangs, members, attendanceSessions, attendanceRecords, transactions, leaveRequests, auditLogs, gangRoles, gangSettings } from '@gang/database';
import { AttachmentBuilder, TextChannel } from 'discord.js';
import { client } from '../index';
import { logError, logInfo, logWarn } from '../utils/logger';

const BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 Hours
let backupSchedulerStarted = false;

export function startBackupScheduler() {
    if (backupSchedulerStarted) {
        return;
    }

    backupSchedulerStarted = true;
    logInfo('bot.backup_scheduler.started', { intervalMs: BACKUP_INTERVAL_MS });

    // Run interval
    setInterval(runBackup, BACKUP_INTERVAL_MS);
}

export async function runBackup() {
    const backupChannelId = process.env.BACKUP_CHANNEL_ID;
    if (!backupChannelId) {
        logWarn('bot.backup_scheduler.channel_not_configured');
        return;
    }

    try {
        logInfo('bot.backup_scheduler.started_backup');

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
        if (!channel || !channel.isTextBased()) {
            logWarn('bot.backup_scheduler.channel_unavailable', { backupChannelId });
            return;
        }

        // Safety check: warn if backup channel is publicly visible
        if ('permissionsFor' in channel) {
            const everyonePerms = (channel as TextChannel).permissionsFor(channel.guild.roles.everyone);
            if (everyonePerms?.has('ViewChannel')) {
                logWarn('bot.backup_scheduler.public_channel_detected', { backupChannelId });
            }
        }

        const recordCount = `G:${allData.gangs.length} M:${allData.members.length} T:${allData.transactions.length} A:${allData.auditLogs.length}`;
        await (channel as TextChannel).send({
            content: `📦 **Database Backup** - ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })} (${recordCount})`,
            files: [attachment]
        });
        logInfo('bot.backup_scheduler.sent', { filename, recordCount });

    } catch (error) {
        logError('bot.backup_scheduler.failed', error);
    }
}
