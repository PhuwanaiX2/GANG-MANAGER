import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, leaveRequests } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { DashboardLayout } from '@/components/DashboardLayout';
import { getGangPermissions } from '@/lib/permissions';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

interface Props {
    children: React.ReactNode;
    params: { gangId: string };
}

export default async function Layout({ children, params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    const [gang, permissions, pendingLeaves] = await Promise.all([
        db.query.gangs.findFirst({
            where: eq(gangs.id, gangId),
            columns: { id: true, name: true, subscriptionTier: true, logoUrl: true }
        }),
        getGangPermissions(gangId, session.user.discordId),
        // Fetch pending leaves count for sidebar badge
        db.select({ count: sql<number>`count(*)` })
            .from(leaveRequests)
            .where(and(eq(leaveRequests.gangId, gangId), eq(leaveRequests.status, 'PENDING')))
    ]);

    if (!gang) redirect('/dashboard');

    // Access Control: Must be at least a MEMBER or OWNER
    if (!permissions.isMember && !permissions.isOwner) {
        redirect('/dashboard');
    }

    return (
        <DashboardLayout
            session={session}
            gangId={gangId}
            gangName={gang.name}
            gangLogoUrl={gang.logoUrl}
            permissions={permissions}
            pendingLeaveCount={pendingLeaves[0]?.count || 0}
            isSystemAdmin={ADMIN_IDS.includes(session.user.discordId)}
        >
            {children}
        </DashboardLayout>
    );
}
