import { eq, and, sql, ne, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { gangs, members, transactions, auditLogs, gangRoles } from '../schema';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any; // allow transaction type

function uuid() {
    const g: any = globalThis as any;
    if (g?.crypto?.randomUUID) return g.crypto.randomUUID();
    return randomUUID();
}

export interface CreateTransactionDTO {
    gangId: string;
    type: 'INCOME' | 'EXPENSE' | 'LOAN' | 'REPAYMENT' | 'DEPOSIT' | 'GANG_FEE';
    amount: number;
    description: string;
    memberId?: string | null;
    actorId: string;
    actorName: string;
}

export const FinanceService = {
    async createTransaction(db: DbType, data: CreateTransactionDTO) {
        const { gangId, type, amount, description, memberId, actorId, actorName } = data;

        // Validation (Basic constraints)
        if (amount <= 0 || amount > 100000000) {
            throw new Error('จำนวนเงินไม่ถูกต้อง (ต้อง > 0 และ <= 100,000,000)');
        }
        if ((type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT' || type === 'GANG_FEE') && !memberId) {
            throw new Error('กรุณาระบุสมาชิก');
        }

        // Logic
        return await db.transaction(async (tx: any) => {
            // 1. Get current gang balance (OCC)
            const gang = await tx.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { balance: true }
            });

            if (!gang) throw new Error('ไม่พบแก๊งนี้ในระบบ');

            // 2. Validate Funds
            const currentBalance = gang.balance || 0;
            if (type === 'EXPENSE' || type === 'LOAN') {
                if (currentBalance < amount) {
                    throw new Error('เงินกองกลางไม่พอ');
                }
            }

            // Validate Member Logic
            let memberRecord = null;
            if (memberId) {
                memberRecord = await tx.query.members.findFirst({
                    where: eq(members.id, memberId),
                    columns: { balance: true }
                });
                if (!memberRecord) throw new Error('ไม่พบสมาชิกนี้ในระบบ');

                if (type === 'REPAYMENT') {
                    if (memberRecord.balance >= 0) {
                        throw new Error('สมาชิกไม่มีหนี้ค้างชำระ');
                    }
                    if (memberRecord.balance + amount > 0) {
                        throw new Error(`ยอดคืนเกินจำนวนหนี้ (สูงสุด: ${Math.abs(memberRecord.balance).toLocaleString()})`);
                    }
                }
            }

            // 3. Calculate Balance Changes
            let balanceChange = 0;
            let memberBalanceChange = 0;

            if (type === 'INCOME') {
                balanceChange = amount;
            } else if (type === 'EXPENSE') {
                balanceChange = -amount;
            } else if (type === 'LOAN') {
                balanceChange = -amount;
                memberBalanceChange = -amount;
            } else if (type === 'REPAYMENT') {
                balanceChange = amount;
                memberBalanceChange = amount;
            } else if (type === 'DEPOSIT') {
                balanceChange = amount;
                memberBalanceChange = amount;
            } else if (type === 'GANG_FEE') {
                balanceChange = 0;
                memberBalanceChange = -amount;
            }

            // 4. Update Gang Balance (OCC)
            let newGangBalance = gang.balance + balanceChange;
            if (balanceChange !== 0) {
                const result = await tx.update(gangs)
                    .set({ balance: sql`balance + ${balanceChange}` })
                    .where(and(
                        eq(gangs.id, gangId),
                        eq(gangs.balance, gang.balance)
                    ))
                    .returning({ updatedId: gangs.id });

                if (result.length === 0) {
                    throw new Error('Concurrency Conflict: Balance was updated by another transaction. Please try again.');
                }
            } else {
                newGangBalance = gang.balance;
            }

            // 5. Update Member Balance (OCC)
            if (memberId && memberRecord) {
                const memberResult = await tx.update(members)
                    .set({ balance: sql`balance + ${memberBalanceChange}` })
                    .where(and(
                        eq(members.id, memberId),
                        eq(members.balance, memberRecord.balance)
                    ))
                    .returning({ updatedId: members.id });

                if (memberResult.length === 0) {
                    throw new Error('Concurrency Conflict: Member balance was updated by another transaction.');
                }
            }

            // 6. Create Records
            const transactionId = uuid();
            await tx.insert(transactions).values({
                id: transactionId,
                gangId,
                type,
                amount,
                description,
                memberId: memberId || null,
                status: 'APPROVED',
                approvedById: actorId,
                approvedAt: new Date(),
                createdById: actorId,
                createdAt: new Date(),
                balanceBefore: gang.balance,
                balanceAfter: newGangBalance,
            });

            // 7. Audit Log
            await tx.insert(auditLogs).values({
                id: uuid(),
                gangId,
                actorId,
                actorName,
                action: 'FINANCE_CREATE',
                targetId: transactionId,
                details: JSON.stringify({ type, amount, description, memberId }),
                createdAt: new Date(),
            });

            return { transactionId, newGangBalance };
        });
    },

    async approveTransaction(db: DbType, data: { transactionId: string; actorId: string; actorName: string }) {
        const { transactionId, actorId, actorName } = data;

        return await db.transaction(async (tx: any) => {
            // 1. Get Transaction
            const transaction = await tx.query.transactions.findFirst({
                where: eq(transactions.id, transactionId),
            });

            if (!transaction) throw new Error('ไม่พบรายการนี้ในระบบ');
            if (transaction.status !== 'PENDING') throw new Error('รายการนี้ไม่อยู่ในสถานะรออนุมัติ');

            const { gangId, amount, type, memberId } = transaction;

            const standardizedDescription =
                type === 'LOAN'
                    ? 'เบิก/ยืมเงิน'
                    : type === 'REPAYMENT'
                        ? 'คืนเงิน'
                        : type === 'DEPOSIT'
                            ? 'ฝากเงิน/สำรองจ่าย'
                            : transaction.description;

            // 2. Get Gang Balance
            const gang = await tx.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { balance: true }
            });
            if (!gang) throw new Error('ไม่พบแก๊งนี้ในระบบ');

            // 3. Validate Funds
            const currentBalance = gang.balance || 0;
            if (type === 'EXPENSE' || type === 'LOAN') {
                if (currentBalance < amount) {
                    throw new Error('เงินกองกลางไม่พอ');
                }
            }

            // Validate Member
            let memberRecord = null;
            if (memberId) {
                memberRecord = await tx.query.members.findFirst({
                    where: eq(members.id, memberId),
                    columns: { balance: true }
                });
                if (!memberRecord) throw new Error('ไม่พบสมาชิกนี้ในระบบ');

                if (type === 'REPAYMENT') {
                    if (memberRecord.balance >= 0) {
                        throw new Error('สมาชิกไม่มีหนี้ค้างชำระ');
                    }
                    if (memberRecord.balance + amount > 0) {
                        throw new Error(`ยอดคืนเกินจำนวนหนี้ (สูงสุด: ${Math.abs(memberRecord.balance).toLocaleString()})`);
                    }
                }
            }

            // 4. Calculate Balance Changes
            let balanceChange = 0;
            let memberBalanceChange = 0;

            if (type === 'INCOME') {
                balanceChange = amount;
            } else if (type === 'EXPENSE') {
                balanceChange = -amount;
            } else if (type === 'LOAN') {
                balanceChange = -amount;
                memberBalanceChange = -amount;
            } else if (type === 'REPAYMENT') {
                balanceChange = amount;
                memberBalanceChange = amount;
            } else if (type === 'DEPOSIT') {
                balanceChange = amount;
                memberBalanceChange = amount;
            } else if (type === 'GANG_FEE') {
                balanceChange = 0;
                memberBalanceChange = -amount;
            }

            // 5. Update Gang Balance (OCC)
            let newGangBalance = gang.balance + balanceChange;
            if (balanceChange !== 0) {
                const result = await tx.update(gangs)
                    .set({ balance: sql`balance + ${balanceChange}` })
                    .where(and(
                        eq(gangs.id, gangId),
                        eq(gangs.balance, gang.balance)
                    ))
                    .returning({ updatedId: gangs.id });

                if (result.length === 0) {
                    throw new Error('Concurrency Conflict: Balance was updated by another transaction.');
                }
            } else {
                newGangBalance = gang.balance;
            }

            // 6. Update Member Balance (OCC)
            if (memberId && memberRecord) {
                const memberResult = await tx.update(members)
                    .set({ balance: sql`balance + ${memberBalanceChange}` })
                    .where(and(
                        eq(members.id, memberId),
                        eq(members.balance, memberRecord.balance)
                    ))
                    .returning({ updatedId: members.id });

                if (memberResult.length === 0) {
                    throw new Error('Concurrency Conflict: Member balance was updated by another transaction.');
                }
            }

            // 7. Update Transaction Status
            await tx.update(transactions)
                .set({
                    status: 'APPROVED',
                    approvedById: actorId,
                    approvedAt: new Date(),
                    description: standardizedDescription,
                    balanceBefore: gang.balance,
                    balanceAfter: newGangBalance,
                })
                .where(eq(transactions.id, transactionId));

            // 8. Audit Log
            await tx.insert(auditLogs).values({
                id: uuid(),
                gangId,
                actorId,
                actorName,
                action: 'FINANCE_APPROVE',
                targetId: transactionId,
                details: JSON.stringify({ type, amount, memberId, newGangBalance }),
                createdAt: new Date(),
            });

            return { transactionId, newGangBalance };
        });
    }
};
