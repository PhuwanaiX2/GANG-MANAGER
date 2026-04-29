import { randomUUID } from 'crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';
import {
    auditLogs,
    financeCollectionBatches,
    financeCollectionMembers,
    financeCollectionSettlements,
    gangs,
    members,
    transactions,
} from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any;

function uuid() {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    return randomUUID();
}

type CollectionRowLike = {
    amountDue: number;
    amountSettled: number;
    amountWaived?: number | null;
    amountCredited?: number | null;
};

function getCoveredAmount(row: CollectionRowLike) {
    return (Number(row.amountSettled) || 0)
        + (Number(row.amountWaived) || 0)
        + (Number(row.amountCredited) || 0);
}

function getOutstandingAmount(row: CollectionRowLike) {
    return Math.max(0, (Number(row.amountDue) || 0) - getCoveredAmount(row));
}

function getCollectionStatus(row: CollectionRowLike) {
    const covered = getCoveredAmount(row);
    const waived = Number(row.amountWaived) || 0;

    if (covered >= (Number(row.amountDue) || 0)) {
        return waived > 0 ? 'WAIVED' : 'SETTLED';
    }

    if (covered > 0) {
        return 'PARTIAL';
    }

    return 'OPEN';
}

async function syncBatchStatuses(tx: any, batchIds: string[]) {
    const uniqueBatchIds = batchIds.filter((batchId, index, arr) => Boolean(batchId) && arr.indexOf(batchId) === index);
    if (uniqueBatchIds.length === 0) return;

    for (const batchId of uniqueBatchIds) {
        const rows = await tx.query.financeCollectionMembers.findMany({
            where: eq(financeCollectionMembers.batchId, batchId),
            columns: {
                amountDue: true,
                amountSettled: true,
                amountWaived: true,
                amountCredited: true,
            },
        });

        if (rows.length === 0) continue;

        const hasOpen = rows.some((row: any) => getOutstandingAmount(row) > 0);
        await tx.update(financeCollectionBatches)
            .set({
                status: hasOpen ? 'OPEN' : 'CLOSED',
                updatedAt: new Date(),
            })
            .where(eq(financeCollectionBatches.id, batchId));
    }
}

export async function getOutstandingLoanDebt(tx: any, gangId: string, memberId: string) {
    const [loanRow, repaymentRow] = await Promise.all([
        tx.select({ sum: sql<number>`COALESCE(sum(${transactions.amount}), 0)` })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, memberId),
                eq(transactions.type, 'LOAN'),
                eq(transactions.status, 'APPROVED')
            )),
        tx.select({ sum: sql<number>`COALESCE(sum(${transactions.amount}), 0)` })
            .from(transactions)
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, memberId),
                eq(transactions.type, 'REPAYMENT'),
                eq(transactions.status, 'APPROVED')
            )),
    ]);

    const totalLoan = Number(loanRow[0]?.sum || 0);
    const totalRepayment = Number(repaymentRow[0]?.sum || 0);
    return Math.max(0, totalLoan - totalRepayment);
}

export async function allocateDepositToCollections(
    tx: any,
    data: {
        gangId: string;
        memberId: string;
        amount: number;
        transactionId: string;
    }
) {
    const { gangId, memberId, amount, transactionId } = data;

    let remaining = Number(amount) || 0;
    if (remaining <= 0) return { appliedAmount: 0, batchIds: [] as string[] };

    const openRows = await tx.query.financeCollectionMembers.findMany({
        where: and(
            eq(financeCollectionMembers.gangId, gangId),
            eq(financeCollectionMembers.memberId, memberId),
            inArray(financeCollectionMembers.status, ['OPEN', 'PARTIAL'])
        ),
        orderBy: asc(financeCollectionMembers.createdAt),
        columns: {
            id: true,
            batchId: true,
            amountDue: true,
            amountSettled: true,
            amountWaived: true,
            amountCredited: true,
        },
    });

    const touchedBatchIds: string[] = [];

    for (const row of openRows) {
        if (remaining <= 0) break;

        const outstanding = getOutstandingAmount(row);
        if (outstanding <= 0) continue;

        const applied = Math.min(outstanding, remaining);
        const nextAmountSettled = (Number(row.amountSettled) || 0) + applied;
        const nextStatus = getCollectionStatus({
            amountDue: Number(row.amountDue) || 0,
            amountSettled: nextAmountSettled,
            amountWaived: Number(row.amountWaived) || 0,
            amountCredited: Number(row.amountCredited) || 0,
        });
        const now = new Date();

        await tx.update(financeCollectionMembers)
            .set({
                amountSettled: nextAmountSettled,
                status: nextStatus,
                settledAt: nextStatus === 'SETTLED' ? now : null,
                lastSettlementTransactionId: transactionId,
                updatedAt: now,
            })
            .where(eq(financeCollectionMembers.id, row.id));

        if (nextStatus === 'SETTLED') {
            await tx.update(transactions)
                .set({
                    settledAt: now,
                    settledByTransactionId: transactionId,
                })
                .where(and(
                    eq(transactions.gangId, gangId),
                    eq(transactions.memberId, memberId),
                    eq(transactions.batchId, row.batchId),
                    eq(transactions.type, 'GANG_FEE')
                ));
        }

        await tx.insert(financeCollectionSettlements).values({
            id: uuid(),
            batchId: row.batchId,
            collectionMemberId: row.id,
            memberId,
            transactionId,
            amount: applied,
            source: 'DEPOSIT',
            createdAt: now,
        });

        touchedBatchIds.push(row.batchId);
        remaining -= applied;
    }

    if (touchedBatchIds.length > 0) {
        await syncBatchStatuses(tx, touchedBatchIds);
    }

    return {
        appliedAmount: (Number(amount) || 0) - remaining,
        batchIds: touchedBatchIds,
    };
}

export async function createCollectionBatch(
    db: DbType,
    data: {
        gangId: string;
        title: string;
        description: string;
        amountPerMember: number;
        memberIds: string[];
        actorId: string;
        actorName: string;
    }
) {
    const { gangId, title, description, amountPerMember, memberIds, actorId, actorName } = data;

    if (amountPerMember <= 0 || amountPerMember > 100000000) {
        throw new Error('จำนวนเงินไม่ถูกต้อง (ต้อง > 0 และ <= 100,000,000)');
    }
    if (!memberIds || memberIds.length === 0) {
        throw new Error('กรุณาระบุสมาชิก');
    }

    return await db.transaction(async (tx: any) => {
        const gang = await tx.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { id: true, balance: true },
        });
        if (!gang) throw new Error('ไม่พบแก๊งนี้ในระบบ');

        const targetMembers = await tx.query.members.findMany({
            where: and(
                eq(members.gangId, gangId),
                inArray(members.id, memberIds)
            ),
            columns: {
                id: true,
                balance: true,
            },
        });

        if (targetMembers.length === 0) {
            throw new Error('ไม่พบสมาชิกที่เลือก');
        }

        const batchId = uuid();
        const totalMembers = targetMembers.length;
        const totalAmountDue = totalMembers * amountPerMember;
        const now = new Date();

        await tx.insert(financeCollectionBatches).values({
            id: batchId,
            gangId,
            title,
            description,
            amountPerMember,
            totalMembers,
            totalAmountDue,
            status: 'OPEN',
            createdById: actorId,
            createdByName: actorName,
            createdAt: now,
            updatedAt: now,
        });

        for (const member of targetMembers) {
            const currentBalance = Number(member.balance) || 0;
            const credited = Math.min(Math.max(currentBalance, 0), amountPerMember);
            const collectionMemberId = uuid();
            const nextStatus = getCollectionStatus({
                amountDue: amountPerMember,
                amountSettled: 0,
                amountWaived: 0,
                amountCredited: credited,
            });

            const memberResult = await tx.update(members)
                .set({ balance: sql`balance - ${amountPerMember}` })
                .where(and(
                    eq(members.id, member.id),
                    eq(members.balance, member.balance)
                ))
                .returning({ updatedId: members.id });

            if (memberResult.length === 0) {
                throw new Error('Concurrency Conflict: Member balance was updated by another transaction.');
            }

            const transactionId = uuid();
            await tx.insert(transactions).values({
                id: transactionId,
                gangId,
                type: 'GANG_FEE',
                amount: amountPerMember,
                category: 'COLLECTION_DUE',
                description,
                memberId: member.id,
                batchId,
                settledAt: nextStatus === 'SETTLED' ? now : null,
                status: 'APPROVED',
                approvedById: actorId,
                approvedAt: now,
                createdById: actorId,
                createdAt: now,
                balanceBefore: gang.balance,
                balanceAfter: gang.balance,
            });

            await tx.insert(financeCollectionMembers).values({
                id: collectionMemberId,
                batchId,
                gangId,
                memberId: member.id,
                amountDue: amountPerMember,
                amountSettled: 0,
                amountWaived: 0,
                amountCredited: credited,
                status: nextStatus,
                settledAt: nextStatus === 'SETTLED' ? now : null,
                waivedAt: null,
                lastSettlementTransactionId: null,
                createdAt: now,
                updatedAt: now,
            });

            if (credited > 0) {
                await tx.insert(financeCollectionSettlements).values({
                    id: uuid(),
                    batchId,
                    collectionMemberId,
                    memberId: member.id,
                    transactionId,
                    amount: credited,
                    source: 'PRE_CREDIT',
                    createdAt: now,
                });
            }
        }

        await syncBatchStatuses(tx, [batchId]);

        await tx.insert(auditLogs).values({
            id: uuid(),
            gangId,
            actorId,
            actorName,
            action: 'FINANCE_COLLECTION_CREATE',
            targetId: batchId,
            details: JSON.stringify({
                title,
                description,
                amountPerMember,
                totalMembers,
                totalAmountDue,
                memberIds,
            }),
            createdAt: now,
        });

        return { batchId, count: totalMembers, totalAmountDue };
    });
}

export async function waiveCollectionDebt(
    db: DbType,
    data: {
        gangId: string;
        memberId: string;
        batchId: string;
        actorId: string;
        actorName: string;
    }
) {
    const { gangId, memberId, batchId, actorId, actorName } = data;

    return await db.transaction(async (tx: any) => {
        const due = await tx.query.financeCollectionMembers.findFirst({
            where: and(
                eq(financeCollectionMembers.gangId, gangId),
                eq(financeCollectionMembers.memberId, memberId),
                eq(financeCollectionMembers.batchId, batchId)
            ),
            columns: {
                id: true,
                amountDue: true,
                amountSettled: true,
                amountWaived: true,
                amountCredited: true,
                status: true,
            },
        });

        if (!due) {
            throw new Error('ไม่พบหนี้เก็บเงินแก๊งที่ยังค้างอยู่');
        }

        const outstanding = getOutstandingAmount(due);
        if (outstanding <= 0) {
            throw new Error('ไม่พบหนี้เก็บเงินแก๊งที่ยังค้างอยู่');
        }

        const memberRecord = await tx.query.members.findFirst({
            where: eq(members.id, memberId),
            columns: { balance: true },
        });
        if (!memberRecord) {
            throw new Error('ไม่พบสมาชิกนี้ในระบบ');
        }

        const memberResult = await tx.update(members)
            .set({ balance: sql`balance + ${outstanding}` })
            .where(and(
                eq(members.id, memberId),
                eq(members.balance, memberRecord.balance)
            ))
            .returning({ updatedId: members.id });

        if (memberResult.length === 0) {
            throw new Error('Concurrency Conflict: Member balance was updated by another transaction.');
        }

        const now = new Date();
        const nextAmountWaived = (Number(due.amountWaived) || 0) + outstanding;

        await tx.update(financeCollectionMembers)
            .set({
                amountWaived: nextAmountWaived,
                status: 'WAIVED',
                waivedAt: now,
                updatedAt: now,
            })
            .where(eq(financeCollectionMembers.id, due.id));

        await tx.update(transactions)
            .set({ settledAt: now })
            .where(and(
                eq(transactions.gangId, gangId),
                eq(transactions.memberId, memberId),
                eq(transactions.batchId, batchId),
                eq(transactions.type, 'GANG_FEE'),
                sql`${transactions.settledAt} IS NULL`
            ));

        await syncBatchStatuses(tx, [batchId]);

        await tx.insert(auditLogs).values({
            id: uuid(),
            gangId,
            actorId,
            actorName,
            action: 'GANG_FEE_WAIVE',
            targetId: due.id,
            details: JSON.stringify({ batchId, memberId, amount: outstanding }),
            createdAt: now,
        });

        return { waived: true, amount: outstanding };
    });
}
