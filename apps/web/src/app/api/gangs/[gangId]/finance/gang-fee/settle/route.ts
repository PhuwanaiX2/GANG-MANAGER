import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db, FinanceService, members } from '@gang/database';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

const Schema = z.object({
    memberId: z.string().min(1),
    batchId: z.string().min(1),
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
        if (!permissions.isTreasurer && !permissions.isOwner) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const tierCheck = await checkTierAccess(gangId, 'gangFee');
        if (!tierCheck.allowed) {
            return NextResponse.json({ error: tierCheck.message, upgrade: true }, { status: 403 });
        }

        const body = await request.json();
        const parsed = Schema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid data', details: parsed.error }, { status: 400 });
        }

        const { memberId, batchId } = parsed.data;

        const actorMember = await db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId),
                eq(members.isActive, true),
                eq(members.status, 'APPROVED')
            ),
            columns: { id: true, name: true },
        });

        if (!actorMember?.id) {
            return NextResponse.json({ error: 'Approver member record not found' }, { status: 400 });
        }

        const result = await FinanceService.settleGangFeeBatch(db, {
            gangId,
            memberId,
            batchId,
            actorId: actorMember.id,
            actorName: actorMember.name || session.user.name || 'Unknown',
        });

        return NextResponse.json({ success: true, ...result });
    } catch (error: any) {
        console.error('Gang Fee Settle API Error:', error);
        if (error.message?.includes('ไม่พบหนี้เก็บเงินแก๊งที่ยังค้างอยู่')) {
            return NextResponse.json({ error: error.message }, { status: 404 });
        }
        if (error.message?.includes('จำนวนเงินไม่ถูกต้อง') || error.message?.includes('กรุณาระบุสมาชิก')) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error.message?.includes('Concurrency Conflict')) {
            return NextResponse.json({ error: 'Transaction failed due to concurrent update. Please retry.' }, { status: 409 });
        }
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
