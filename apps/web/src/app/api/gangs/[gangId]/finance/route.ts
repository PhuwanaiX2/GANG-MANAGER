import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, FinanceService, members } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';

const TransactionSchema = z.object({
    type: z.enum(['INCOME', 'EXPENSE', 'LOAN', 'REPAYMENT', 'DEPOSIT']),
    amount: z.number().positive().max(100000000), // Max 100M to prevent overflow/abuse
    description: z.string().optional(),
    memberId: z.string().optional(), // Required for LOAN/REPAYMENT/DEPOSIT
});

export async function POST(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { gangId } = params;
        const permissions = await getGangPermissions(gangId, session.user.discordId);

        // Permission Check: Only TREASURER or OWNER can manage finance
        if (!permissions.isTreasurer && !permissions.isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Tier Check: Finance requires PRO+ (TRIAL also allowed for backward compat)
        const tierCheck = await checkTierAccess(gangId, 'finance');
        if (!tierCheck.allowed) {
            return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
        }

        const body = await request.json();
        const validation = TransactionSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json({ error: 'Invalid data', details: validation.error }, { status: 400 });
        }

        const { type, amount, description, memberId } = validation.data;

        if ((type === 'LOAN' || type === 'REPAYMENT' || type === 'DEPOSIT') && !memberId) {
            return NextResponse.json({ error: 'กรุณาระบุสมาชิก' }, { status: 400 });
        }

        if ((type === 'INCOME' || type === 'EXPENSE') && (!description || description.trim().length === 0)) {
            return NextResponse.json({ error: 'กรุณาระบุรายละเอียด' }, { status: 400 });
        }

        const standardizedDescription =
            type === 'LOAN'
                ? 'เบิก/ยืมเงิน'
                : type === 'REPAYMENT'
                    ? 'คืนเงิน'
                    : type === 'DEPOSIT'
                        ? 'ฝากเงิน/สำรองจ่าย'
                        : (description || '').trim();

        // Fetch the actor's member record to get their internal ID
        const actorMember = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
            columns: { id: true }
        });

        // Use shared service
        // Only use the explicitly provided memberId — gang-level transactions (INCOME/EXPENSE without a member)
        // should NOT be attributed to the actor, so they don't appear in the actor's personal history
        const finalMemberId = memberId || undefined;

        await FinanceService.createTransaction(db, {
            gangId,
            type,
            amount,
            description: standardizedDescription,
            memberId: finalMemberId,
            actorId: actorMember?.id || session.user.discordId, // Fallback to Discord ID if member not found (though should be caught by permissions)
            actorName: session.user.name || 'Unknown',
        });

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('Finance API Error:', error);
        if (error.message === 'เงินกองกลางไม่พอ' ||
            error.message === 'สมาชิกไม่มีหนี้ค้างชำระ' ||
            error.message.includes('ยอดคืนเกินจำนวนหนี้') ||
            error.message.includes('จำนวนเงินไม่ถูกต้อง') ||
            error.message.includes('กรุณาระบุสมาชิก') ||
            error.message === 'ไม่พบแก๊งนี้ในระบบ' ||
            error.message === 'ไม่พบสมาชิกนี้ในระบบ') {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message.includes('Concurrency Conflict')) {
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
