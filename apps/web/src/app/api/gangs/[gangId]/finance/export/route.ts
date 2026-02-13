import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getGangPermissions } from '@/lib/permissions';
import { checkTierAccess } from '@/lib/tierGuard';
import { db, transactions, gangs } from '@gang/database';
import { eq, and, desc, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    { params }: { params: { gangId: string } }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.discordId) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { gangId } = params;

        // Permission: TREASURER or OWNER only
        const permissions = await getGangPermissions(gangId, session.user.discordId);
        if (!permissions.isOwner && !permissions.isTreasurer) {
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Tier Check: Export CSV requires PRO+
        const tierCheck = await checkTierAccess(gangId, 'exportCSV');
        if (!tierCheck.allowed) {
            return new NextResponse(`Forbidden: ${tierCheck.message}`, { status: 403 });
        }

        // Fetch all approved transactions
        const allTransactions = await db.query.transactions.findMany({
            where: and(
                eq(transactions.gangId, gangId),
                sql`${transactions.status} != 'REJECTED'`
            ),
            orderBy: desc(transactions.createdAt),
            with: { member: true, createdBy: true },
        });

        // Get gang name for filename
        const gang = await db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { name: true }
        });

        // Build CSV
        const headers = ['ID', 'Date', 'Type', 'Description', 'Amount', 'Status', 'Member', 'CreatedBy', 'BalanceBefore', 'BalanceAfter'];
        const rows = allTransactions.map(t => [
            t.id,
            new Date(t.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            t.type,
            `"${(t.description || '').replace(/"/g, '""')}"`,
            t.amount,
            t.status,
            (t as any).member?.name || '-',
            (t as any).createdBy?.name || 'System',
            t.balanceBefore,
            t.balanceAfter,
        ]);

        // Add BOM for Thai character support in Excel
        const BOM = '\uFEFF';
        const csvContent = BOM + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

        const filename = `${gang?.name || 'gang'}_transactions_${new Date().toISOString().split('T')[0]}.csv`;

        return new NextResponse(csvContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });

    } catch (error) {
        console.error('Export CSV Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
