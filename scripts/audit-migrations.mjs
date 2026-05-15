import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const migrationsDir = join(process.cwd(), 'packages', 'database', 'drizzle');
const metaDir = join(migrationsDir, 'meta');
const journalPath = join(metaDir, '_journal.json');

function readJson(filePath) {
    return JSON.parse(readFileSync(filePath, 'utf8'));
}

function snapshotNameForIndex(index) {
    return `${String(index).padStart(4, '0')}_snapshot.json`;
}

function fail(message) {
    throw new Error(message);
}

function main() {
    const journal = readJson(journalPath);
    const entries = journal.entries || [];
    const journalTags = new Set(entries.map((entry) => entry.tag));
    const errors = [];

    for (const entry of entries) {
        const sqlPath = join(migrationsDir, `${entry.tag}.sql`);
        const snapshotPath = join(metaDir, snapshotNameForIndex(entry.idx));

        if (!existsSync(sqlPath)) {
            errors.push(`Missing SQL migration for journal tag ${entry.tag}`);
        }

        if (!existsSync(snapshotPath)) {
            errors.push(`Missing snapshot ${snapshotNameForIndex(entry.idx)} for journal tag ${entry.tag}`);
        }
    }

    const sqlFiles = readdirSync(migrationsDir)
        .filter((file) => /^\d{4}_.+\.sql$/.test(file))
        .map((file) => file.replace(/\.sql$/, ''));

    for (const sqlTag of sqlFiles) {
        if (!journalTags.has(sqlTag)) {
            errors.push(`SQL migration ${sqlTag}.sql is not registered in _journal.json`);
        }
    }

    let previousSnapshot = null;
    for (const entry of entries) {
        const snapshotPath = join(metaDir, snapshotNameForIndex(entry.idx));
        if (!existsSync(snapshotPath)) {
            continue;
        }

        const snapshot = readJson(snapshotPath);
        if (entry.idx === 0) {
            if (snapshot.prevId !== '00000000-0000-0000-0000-000000000000') {
                errors.push(`${snapshotNameForIndex(entry.idx)} has unexpected initial prevId ${snapshot.prevId}`);
            }
        } else if (previousSnapshot && snapshot.prevId !== previousSnapshot.id) {
            errors.push(`${snapshotNameForIndex(entry.idx)} prevId ${snapshot.prevId} does not match previous snapshot id ${previousSnapshot.id}`);
        }

        previousSnapshot = snapshot;
    }

    if (errors.length > 0) {
        fail(`Migration audit failed:\n- ${errors.join('\n- ')}`);
    }

    console.log(`Migration audit passed: ${entries.length} journal entries, ${sqlFiles.length} SQL files, ${entries.length} snapshots.`);
}

main();
