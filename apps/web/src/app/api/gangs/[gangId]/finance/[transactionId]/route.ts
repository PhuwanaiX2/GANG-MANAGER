import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, transactions, gangs, members, auditLogs } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { eq, sql, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export async function PATCH(
    request: NextRequest,
    { params }: { params: { gangId: string; transactionId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId, transactionId } = params;
        const permissions = await getGangPermissions(gangId, session.user.discordId);

        if (!permissions.isTreasurer && !permissions.isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const body = await request.json();
        const { action } = body; // 'APPROVE' | 'REJECT'

        if (!['APPROVE', 'REJECT'].includes(action)) {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        const transaction = await db.query.transactions.findFirst({
            where: eq(transactions.id, transactionId),
        });

        if (!transaction) {
            return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }

        if (transaction.status !== 'PENDING') {
            return NextResponse.json({ error: 'Transaction is not pending' }, { status: 400 });
        }

        if (action === 'REJECT') {
            await db.update(transactions)
                .set({
                    status: 'REJECTED',
                    approvedById: session.user.discordId,
                    approvedAt: new Date(),
                })
                .where(eq(transactions.id, transactionId));

            // Audit Log
            await db.insert(auditLogs).values({
                id: randomUUID(),
                gangId,
                actorId: session.user.discordId,
                actorName: session.user.name || 'Unknown',
                action: 'FINANCE_REJECT',
                targetId: transactionId,
                details: JSON.stringify({ reason: 'Manual Rejection' }),
                createdAt: new Date(),
            });

            return NextResponse.json({ success: true, status: 'REJECTED' });
        }

        // APPROVE LOGIC
        await db.transaction(async (tx) => {
            // 1. Get current gang balance (lock involved?) SQLite doesn't strictly lock row but transaction helps
            const gang = await tx.query.gangs.findFirst({
                where: eq(gangs.id, gangId),
                columns: { balance: true }
            });
            if (!gang) throw new Error('Gang not found');

            const amount = transaction.amount;
            const type = transaction.type;

            // 2. Validate Funds (Read-Check)
            // Note: In a high-concurrency environment, the balance might change after this check but before the update.
            // However, since we use atomic update (balance - amount), we can integrity check the result or rely on the fact that
            // for "LOAN", we are okay if it dips slightly negative momentarily, OR we can add a WHERE clause to the update.
            // For sqlite, let's keep it simple: atomic update is the key.
            if (type === 'LOAN' && gang.balance < amount) {
                throw new Error('เงินกองกลางไม่พอ');
            }

            // Validate Member Funds for REPAYMENT
            if (type === 'REPAYMENT' && transaction.memberId) {
                const member = await tx.query.members.findFirst({
                    where: eq(members.id, transaction.memberId),
                    columns: { balance: true }
                });
                if (!member) throw new Error('ไม่พบสมาชิก');

                // Repayment of debt means member balance is negative.
                // We want to ensure they don't pay more than they owe?
                // Logic: debt is negative balance. repay means balance + amount.
                // if balance + amount > 0, they are overpaying.
                if (member.balance + amount > 0) {
                    // check again with atomic view if possible, but reading here is standard for validation.
                    throw new Error(`ยอดคืนเกินจำนวนหนี้`);
                }
            }

            // 3. Define Balance Changes
            let balanceChange = 0;
            let memberBalanceChange = 0;

            if (type === 'LOAN') {
                balanceChange = -amount;
                memberBalanceChange = amount; // Member GETS money
            } else if (type === 'REPAYMENT') {
                balanceChange = amount;
                memberBalanceChange = -amount; // Member PAYS money
            }

            // 4. Update Gang Balance (Atomic)
            // Using sql template for atomic update
            const [updatedGang] = await tx.update(gangs)
                .set({
                    balance: sql`balance + ${balanceChange}`,
                    updatedAt: new Date()
                })
                .where(eq(gangs.id, gangId))
                .returning({ balance: gangs.balance });

            if (!updatedGang) throw new Error('เกิดข้อผิดพลาดในการอัปเดตยอดเงินกองกลาง');


            // 5. Update Member Balance (Atomic) with Overpayment Protection
            if (transaction.memberId) {
                // For REPAYMENT, we must ensure the new balance does not exceed 0 (Overpayment)
                // This must be done ATOMICALLY in the WHERE clause, not just a pre-check.
                const whereClause = type === 'REPAYMENT'
                    ? and(
                        eq(members.id, transaction.memberId),
                        sql`balance + ${memberBalanceChange} <= 0.01` // Allow slight float margin or strict 0. Using 0.01 for safety against float artifacts, or strict 0 if integer based. Let's use strict 0 but memberBalanceChange is +amount.
                        // Actually, sqlite real. Let's use strict <= 0.
                        // sql`balance + ${memberBalanceChange} <= 0`
                    )
                    : eq(members.id, transaction.memberId);

                const [updatedMember] = await tx.update(members)
                    .set({
                        balance: sql`balance + ${memberBalanceChange}`,
                        updatedAt: new Date()
                    })
                    .where(whereClause)
                    .returning({ id: members.id, balance: members.balance });

                if (!updatedMember) {
                    if (type === 'REPAYMENT') {
                        throw new Error('เกิดข้อผิดพลาด: ยอดคืนเกินจำนวนหนี้ หรือมีการทำรายการซ้อนกัน');
                    } else {
                        throw new Error('เกิดข้อผิดพลาดในการอัปเดตยอดเงินสมาชิก');
                    }
                }
            }

            // 6. Update Transaction Status (Atomic Check)
            // CRITICAL: Ensure we only update if it is STILL 'PENDING'
            const [updatedTransaction] = await tx.update(transactions)
                .set({
                    status: 'APPROVED',
                    balanceBefore: gang.balance, // Approximate (snapshot from start of tx)
                    balanceAfter: updatedGang.balance, // Accurate (from atomic return)
                    approvedById: session.user.discordId,
                    approvedAt: new Date(),
                })
                .where(and(
                    eq(transactions.id, transactionId),
                    eq(transactions.status, 'PENDING') // Prevents double-approval
                ))
                .returning({ id: transactions.id });

            if (!updatedTransaction) {
                // If no row returned, it means it wasn't PENDING anymore (Race Condition caught!)
                throw new Error('รายการนี้ถูกดำเนินการไปแล้ว');
            }

            // 7. Audit Log
            await tx.insert(auditLogs).values({
                id: randomUUID(),
                gangId,
                actorId: session.user.discordId,
                actorName: session.user.name || 'Unknown',
                action: 'FINANCE_APPROVE',
                targetId: transactionId,
                details: JSON.stringify({
                    type,
                    amount,
                    memberId: transaction.memberId,
                    balanceAfter: updatedGang.balance,
                }),
                createdAt: new Date(),
            });
        });

        return NextResponse.json({ success: true, status: 'APPROVED' });

    } catch (error: any) {
        console.error('Transaction Action Error:', error);
        if (error.message === 'เงินกองกลางไม่พอ' ||
            error.message === 'ไม่พบสมาชิก' ||
            error.message.includes('ยอดคืนเกินจำนวนหนี้') ||
            error.message.includes('เกิดข้อผิดพลาด') ||
            error.message === 'รายการนี้ถูกดำเนินการไปแล้ว') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
