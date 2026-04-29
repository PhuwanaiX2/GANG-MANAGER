import { createClient, type Client } from '@libsql/client';
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql';
import { eq, and } from 'drizzle-orm';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
    auditLogs,
    financeCollectionBatches,
    financeCollectionMembers,
    financeCollectionSettlements,
    gangs,
    members,
    transactions,
} from '@gang/database';
import * as schema from '@gang/database';
import { createCollectionBatch, waiveCollectionDebt, FinanceService } from '@gang/database';

type TestDb = LibSQLDatabase<typeof schema>;

async function createFinanceSchema(client: Client) {
    const statements = [
        `CREATE TABLE gangs (
            id TEXT PRIMARY KEY,
            discord_guild_id TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            logo_url TEXT,
            subscription_tier TEXT NOT NULL DEFAULT 'FREE',
            subscription_expires_at INTEGER,
            transfer_status TEXT NOT NULL DEFAULT 'NONE',
            transfer_deadline INTEGER,
            transfer_started_at INTEGER,
            transfer_message_id TEXT,
            transfer_channel_id TEXT,
            dissolved_at INTEGER,
            dissolved_by TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            balance INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`,
        `CREATE TABLE members (
            id TEXT PRIMARY KEY,
            gang_id TEXT NOT NULL,
            discord_id TEXT,
            name TEXT NOT NULL,
            discord_username TEXT,
            discord_avatar TEXT,
            is_active INTEGER NOT NULL DEFAULT 1,
            status TEXT NOT NULL DEFAULT 'APPROVED',
            gang_role TEXT NOT NULL DEFAULT 'MEMBER',
            balance INTEGER NOT NULL DEFAULT 0,
            transfer_status TEXT,
            joined_at INTEGER NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`,
        `CREATE TABLE transactions (
            id TEXT PRIMARY KEY,
            gang_id TEXT NOT NULL,
            type TEXT NOT NULL,
            amount INTEGER NOT NULL,
            category TEXT,
            description TEXT NOT NULL,
            member_id TEXT,
            batch_id TEXT,
            settled_at INTEGER,
            settled_by_transaction_id TEXT,
            status TEXT NOT NULL DEFAULT 'APPROVED',
            approved_by_id TEXT,
            approved_at INTEGER,
            balance_before INTEGER NOT NULL,
            balance_after INTEGER NOT NULL,
            created_by_id TEXT NOT NULL,
            created_at INTEGER NOT NULL
        )`,
        `CREATE TABLE audit_logs (
            id TEXT PRIMARY KEY,
            gang_id TEXT NOT NULL,
            actor_id TEXT NOT NULL,
            actor_name TEXT NOT NULL,
            action TEXT NOT NULL,
            target_type TEXT,
            target_id TEXT,
            old_value TEXT,
            new_value TEXT,
            details TEXT,
            created_at INTEGER NOT NULL
        )`,
        `CREATE TABLE finance_collection_batches (
            id TEXT PRIMARY KEY,
            gang_id TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            amount_per_member INTEGER NOT NULL,
            total_members INTEGER NOT NULL DEFAULT 0,
            total_amount_due INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'OPEN',
            created_by_id TEXT NOT NULL,
            created_by_name TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`,
        `CREATE TABLE finance_collection_members (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            gang_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            amount_due INTEGER NOT NULL,
            amount_credited INTEGER NOT NULL DEFAULT 0,
            amount_settled INTEGER NOT NULL DEFAULT 0,
            amount_waived INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'OPEN',
            settled_at INTEGER,
            waived_at INTEGER,
            last_settlement_transaction_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )`,
        `CREATE TABLE finance_collection_settlements (
            id TEXT PRIMARY KEY,
            batch_id TEXT NOT NULL,
            collection_member_id TEXT NOT NULL,
            member_id TEXT NOT NULL,
            transaction_id TEXT NOT NULL,
            amount INTEGER NOT NULL,
            source TEXT NOT NULL DEFAULT 'DEPOSIT',
            created_at INTEGER NOT NULL
        )`,
    ];

    for (const statement of statements) {
        await client.execute(statement);
    }
}

async function seedGangAndMember(db: TestDb, options?: { gangBalance?: number; memberBalance?: number }) {
    const now = new Date();

    await db.insert(gangs).values({
        id: 'gang-1',
        discordGuildId: 'guild-1',
        name: 'Finance Test Gang',
        balance: options?.gangBalance ?? 1_000,
        createdAt: now,
        updatedAt: now,
    });

    await db.insert(members).values({
        id: 'member-1',
        gangId: 'gang-1',
        discordId: 'discord-1',
        name: 'Member One',
        balance: options?.memberBalance ?? 0,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
    });
}

function actor() {
    return {
        actorId: 'actor-1',
        actorName: 'Treasurer',
    };
}

async function createCollection(db: TestDb, amountPerMember: number) {
    return createCollectionBatch(db, {
        gangId: 'gang-1',
        title: 'Monthly due',
        description: 'Monthly due',
        amountPerMember,
        memberIds: ['member-1'],
        ...actor(),
    });
}

async function createTransaction(db: TestDb, type: 'LOAN' | 'REPAYMENT' | 'DEPOSIT', amount: number) {
    return FinanceService.createTransaction(db, {
        gangId: 'gang-1',
        memberId: 'member-1',
        type,
        amount,
        description: `${type} test`,
        ...actor(),
    });
}

async function getMember(db: TestDb) {
    return db.query.members.findFirst({
        where: eq(members.id, 'member-1'),
        columns: { balance: true },
    });
}

async function getGang(db: TestDb) {
    return db.query.gangs.findFirst({
        where: eq(gangs.id, 'gang-1'),
        columns: { balance: true },
    });
}

async function getCollectionMember(db: TestDb) {
    return db.query.financeCollectionMembers.findFirst({
        where: eq(financeCollectionMembers.memberId, 'member-1'),
        columns: {
            amountDue: true,
            amountCredited: true,
            amountSettled: true,
            amountWaived: true,
            status: true,
            settledAt: true,
            waivedAt: true,
            lastSettlementTransactionId: true,
        },
    });
}

async function getCollectionBatch(db: TestDb, batchId: string) {
    return db.query.financeCollectionBatches.findFirst({
        where: eq(financeCollectionBatches.id, batchId),
        columns: { status: true },
    });
}

async function getTransactionsByType(db: TestDb, type: string) {
    return db.select().from(transactions).where(eq(transactions.type, type));
}

async function getTransactionById(db: TestDb, id: string) {
    return db.query.transactions.findFirst({
        where: eq(transactions.id, id),
        columns: {
            type: true,
            description: true,
            category: true,
            status: true,
        },
    });
}

async function getSettlements(db: TestDb) {
    return db.select().from(financeCollectionSettlements);
}

describe('finance ledger invariants', () => {
    let client: Client;
    let db: TestDb;
    let testDir: string;

    beforeEach(async () => {
        testDir = mkdtempSync(join(tmpdir(), 'finance-ledger-'));
        const dbPath = join(testDir, 'test.db').replace(/\\/g, '/');
        client = createClient({ url: `file:${dbPath}` });
        db = drizzle(client, { schema });
        await createFinanceSchema(client);
    });

    afterEach(() => {
        client.close();
        try {
            rmSync(testDir, { recursive: true, force: true });
        } catch {
            // Windows can hold the SQLite file briefly after client.close(); temp cleanup is best-effort.
        }
    });

    it('rejects REPAYMENT when the member only has collection debt', async () => {
        await seedGangAndMember(db);
        await createCollection(db, 100);

        await expect(createTransaction(db, 'REPAYMENT', 100)).rejects.toThrow();

        await expect(getTransactionsByType(db, 'REPAYMENT')).resolves.toHaveLength(0);
        await expect(getSettlements(db)).resolves.toHaveLength(0);
        await expect(getMember(db)).resolves.toMatchObject({ balance: -100 });
        await expect(getGang(db)).resolves.toMatchObject({ balance: 1_000 });
        await expect(getCollectionMember(db)).resolves.toMatchObject({
            amountDue: 100,
            amountSettled: 0,
            status: 'OPEN',
        });
    });

    it('settles collection debt through DEPOSIT, including partial then closed states', async () => {
        await seedGangAndMember(db);
        const collection = await createCollection(db, 100);

        const partial = await createTransaction(db, 'DEPOSIT', 60);

        await expect(getMember(db)).resolves.toMatchObject({ balance: -40 });
        await expect(getGang(db)).resolves.toMatchObject({ balance: 1_060 });
        await expect(getCollectionMember(db)).resolves.toMatchObject({
            amountSettled: 60,
            status: 'PARTIAL',
            lastSettlementTransactionId: partial.transactionId,
        });
        await expect(getCollectionBatch(db, collection.batchId)).resolves.toMatchObject({ status: 'OPEN' });

        const closed = await createTransaction(db, 'DEPOSIT', 40);
        const [gangFee] = await getTransactionsByType(db, 'GANG_FEE');

        await expect(getMember(db)).resolves.toMatchObject({ balance: 0 });
        await expect(getGang(db)).resolves.toMatchObject({ balance: 1_100 });
        await expect(getCollectionMember(db)).resolves.toMatchObject({
            amountSettled: 100,
            status: 'SETTLED',
            lastSettlementTransactionId: closed.transactionId,
        });
        await expect(getCollectionBatch(db, collection.batchId)).resolves.toMatchObject({ status: 'CLOSED' });
        expect(gangFee.settledByTransactionId).toBe(closed.transactionId);
        const settlements = await getSettlements(db);
        expect(settlements).toHaveLength(2);
        expect(settlements.map((settlement) => settlement.source)).toEqual(['DEPOSIT', 'DEPOSIT']);
    });

    it('keeps REPAYMENT scoped to loan debt and does not settle collection debt', async () => {
        await seedGangAndMember(db);
        await createCollection(db, 100);

        await createTransaction(db, 'LOAN', 200);
        await createTransaction(db, 'REPAYMENT', 200);

        await expect(getMember(db)).resolves.toMatchObject({ balance: -100 });
        await expect(getGang(db)).resolves.toMatchObject({ balance: 1_000 });
        await expect(getCollectionMember(db)).resolves.toMatchObject({
            amountSettled: 0,
            status: 'OPEN',
            lastSettlementTransactionId: null,
        });
        await expect(getSettlements(db)).resolves.toHaveLength(0);
    });

    it('uses existing positive member balance as pre-credit when creating a collection batch', async () => {
        await seedGangAndMember(db, { memberBalance: 150 });
        const collection = await createCollection(db, 100);
        const [gangFee] = await getTransactionsByType(db, 'GANG_FEE');

        await expect(getMember(db)).resolves.toMatchObject({ balance: 50 });
        await expect(getCollectionMember(db)).resolves.toMatchObject({
            amountDue: 100,
            amountCredited: 100,
            amountSettled: 0,
            status: 'SETTLED',
        });
        await expect(getCollectionBatch(db, collection.batchId)).resolves.toMatchObject({ status: 'CLOSED' });
        expect(gangFee.settledAt).toBeInstanceOf(Date);
        await expect(getSettlements(db)).resolves.toMatchObject([
            {
                amount: 100,
                source: 'PRE_CREDIT',
                transactionId: gangFee.id,
            },
        ]);
    });

    it('waives only the remaining collection debt after partial deposit settlement', async () => {
        await seedGangAndMember(db);
        const collection = await createCollection(db, 100);

        await createTransaction(db, 'DEPOSIT', 40);
        await waiveCollectionDebt(db, {
            gangId: 'gang-1',
            memberId: 'member-1',
            batchId: collection.batchId,
            ...actor(),
        });

        await expect(getMember(db)).resolves.toMatchObject({ balance: 0 });
        await expect(getGang(db)).resolves.toMatchObject({ balance: 1_040 });
        await expect(getCollectionMember(db)).resolves.toMatchObject({
            amountSettled: 40,
            amountWaived: 60,
            status: 'WAIVED',
        });
        await expect(getCollectionBatch(db, collection.batchId)).resolves.toMatchObject({ status: 'CLOSED' });

        const [gangFee] = await getTransactionsByType(db, 'GANG_FEE');
        expect(gangFee.settledAt).toBeInstanceOf(Date);
        await expect(getSettlements(db)).resolves.toMatchObject([{ source: 'DEPOSIT' }]);
    });

    it('writes audit rows for each approved finance mutation', async () => {
        await seedGangAndMember(db);
        await createCollection(db, 100);
        await createTransaction(db, 'DEPOSIT', 100);

        const logs = await db.select().from(auditLogs);
        expect(logs.map((log) => log.action)).toEqual([
            'FINANCE_COLLECTION_CREATE',
            'FINANCE_CREATE',
        ]);
    });

    it('categorizes approved deposit and repayment transactions explicitly', async () => {
        await seedGangAndMember(db, { gangBalance: 1_000 });
        await createTransaction(db, 'LOAN', 100);
        await createTransaction(db, 'REPAYMENT', 100);
        await createTransaction(db, 'DEPOSIT', 50);

        const rows = await db.select({
            type: transactions.type,
            category: transactions.category,
        }).from(transactions).where(and(
            eq(transactions.gangId, 'gang-1'),
            eq(transactions.memberId, 'member-1')
        ));

        expect(rows).toEqual([
            { type: 'LOAN', category: null },
            { type: 'REPAYMENT', category: 'LOAN_REPAYMENT' },
            { type: 'DEPOSIT', category: 'CASH_IN' },
        ]);
    });

    it('standardizes pending approval descriptions with separate ledger wording', async () => {
        await seedGangAndMember(db, { gangBalance: 1_000 });
        await createTransaction(db, 'LOAN', 100);

        const now = new Date();
        await db.insert(transactions).values([
            {
                id: 'pending-repay',
                gangId: 'gang-1',
                type: 'REPAYMENT',
                amount: 100,
                description: 'old generic repay copy',
                memberId: 'member-1',
                status: 'PENDING',
                balanceBefore: 900,
                balanceAfter: 1_000,
                createdById: 'member-1',
                createdAt: now,
            },
            {
                id: 'pending-deposit',
                gangId: 'gang-1',
                type: 'DEPOSIT',
                amount: 50,
                description: 'old generic deposit copy',
                memberId: 'member-1',
                status: 'PENDING',
                balanceBefore: 1_000,
                balanceAfter: 1_050,
                createdById: 'member-1',
                createdAt: now,
            },
        ]);

        await FinanceService.approveTransaction(db, {
            transactionId: 'pending-repay',
            ...actor(),
        });
        await FinanceService.approveTransaction(db, {
            transactionId: 'pending-deposit',
            ...actor(),
        });

        await expect(getTransactionById(db, 'pending-repay')).resolves.toMatchObject({
            status: 'APPROVED',
            category: 'LOAN_REPAYMENT',
            description: 'ชำระหนี้ยืมเข้ากองกลาง',
        });
        await expect(getTransactionById(db, 'pending-deposit')).resolves.toMatchObject({
            status: 'APPROVED',
            category: 'CASH_IN',
            description: 'ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต',
        });
    });
});
