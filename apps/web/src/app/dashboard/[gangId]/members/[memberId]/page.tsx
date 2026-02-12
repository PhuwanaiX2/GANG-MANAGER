import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members, attendanceRecords, leaveRequests, transactions, attendanceSessions } from '@gang/database';
import { eq, and, desc } from 'drizzle-orm';
import { DashboardLayout } from '@/components/DashboardLayout';
import { MemberActivityClient } from './MemberActivityClient';

interface Props {
    params: { gangId: string; memberId: string };
}

export default async function MemberDetailPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId, memberId } = params;

    // Get gang
    const gang = await db.query.gangs.findFirst({
        where: eq(gangs.id, gangId),
    });

    if (!gang) redirect('/dashboard');

    // Get member with all related data
    const member = await db.query.members.findFirst({
        where: and(
            eq(members.id, memberId),
            eq(members.gangId, gangId)
        ),
    });

    if (!member) redirect(`/dashboard/${gangId}/members`);

    // Get attendance records with session info
    const memberAttendance = await db.query.attendanceRecords.findMany({
        where: eq(attendanceRecords.memberId, memberId),
        with: {
            session: true,
        },
        orderBy: desc(attendanceRecords.createdAt),
    });

    // Get leave requests
    const memberLeaves = await db.query.leaveRequests.findMany({
        where: eq(leaveRequests.memberId, memberId),
        orderBy: desc(leaveRequests.requestedAt),
    });

    // Get transactions
    const memberTransactions = await db.query.transactions.findMany({
        where: eq(transactions.memberId, memberId),
        orderBy: desc(transactions.createdAt),
    });

    return (
        <DashboardLayout session={session} gangId={gangId} gangName={gang.name}>
            <MemberActivityClient
                member={member}
                attendance={memberAttendance}
                leaves={memberLeaves}
                transactions={memberTransactions}
                gangId={gangId}
            />
        </DashboardLayout>
    );
}
