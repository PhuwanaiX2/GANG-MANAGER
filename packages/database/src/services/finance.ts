import { eq, and, sql } from 'drizzle-orm';
import { gangs, members, transactions, auditLogs, gangRoles } from '../schema';
import { LibSQLDatabase } from 'drizzle-orm/libsql';
import * as schema from '../schema';

type DbType = LibSQLDatabase<typeof schema> | any; // allow transaction type

export interface CreateTransactionDTO {
    gangId: string;
    type: 'INCOME' | 'EXPENSE' | 'LOAN' | 'REPAYMENT';
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
        if ((type === 'LOAN' || type === 'REPAYMENT') && !memberId) {
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
            if (type === 'EXPENSE' || type === 'LOAN') {
                if (gang.balance < amount) {
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
            }

            // 4. Update Gang Balance (OCC)
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

            const newGangBalance = gang.balance + balanceChange;

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
            const transactionId = crypto.randomUUID();
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
                id: crypto.randomUUID(),
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
    }
};
