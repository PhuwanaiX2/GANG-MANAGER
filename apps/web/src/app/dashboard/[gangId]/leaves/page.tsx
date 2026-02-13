import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, leaveRequests, members } from '@gang/database';
import { eq, desc, and, sql } from 'drizzle-orm';
import { LeaveRequestList } from './LeaveRequestList';

import { getGangPermissions } from '@/lib/permissions';
import { CalendarDays } from 'lucide-react';

interface Props {
    params: { gangId: string };
}

export default async function LeavesPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Check Permissions (ADMIN or OWNER)
    const permissions = await getGangPermissions(gangId, session.user.discordId);
    if (!permissions.isOwner && !permissions.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <CalendarDays className="w-8 h-8 text-red-500" />
                </div>
                <h1 className="text-2xl font-bold text-white mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                <p className="text-gray-400 max-w-md">
                    เฉพาะหัวหน้าแก๊ง (Owner) หรือ รองหัวหน้า (Admin) เท่านั้น
                </p>
            </div>
        );
    }

    // Get data in parallel
    const requests = await db.query.leaveRequests.findMany({
        where: eq(leaveRequests.gangId, gangId),
        orderBy: (lr, { desc }) => desc(lr.requestedAt),
        with: {
            member: true,
        },
    });

    // Manually fetch reviewers because there might not be a direct relation in schema yet or it's complex
    // distinct reviewedByIds
    const reviewerIds = Array.from(new Set(requests.map(r => r.reviewedById).filter(Boolean))) as string[];

    const reviewers = reviewerIds.length > 0 ? await db.query.members.findMany({
        where: sql`id IN ${reviewerIds}`,
        columns: { id: true, name: true, discordUsername: true }
    }) : [];

    const reviewerMap = new Map(reviewers.map(r => [r.id, r]));

    const enrichedRequests = requests.map(r => ({
        ...r,
        reviewer: r.reviewedById ? reviewerMap.get(r.reviewedById) : null
    }));

    return (
        <>
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-white mb-2">รายการลา / แจ้งเข้าช้า</h1>
                <p className="text-gray-400">อนุมัติหรือปฏิเสธคำขอลาหยุดของสมาชิก</p>
            </div>

            <LeaveRequestList requests={enrichedRequests} gangId={gangId} />
        </>
    );
}
