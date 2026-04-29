export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { db, leaveRequests } from '@gang/database';
import { eq, and, sql } from 'drizzle-orm';
import { DashboardLayout } from '@/components/DashboardLayout';
import { getGangPermissionFlags, isGangAccessError, requireGangAccess } from '@/lib/gangAccess';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

interface Props {
    children: React.ReactNode;
    params: Promise<{ gangId: string }>;
}

async function getLayoutAccess(gangId: string) {
    try {
        return await requireGangAccess({ gangId });
    } catch (error) {
        if (isGangAccessError(error)) {
            redirect(error.status === 401 ? '/' : '/dashboard');
        }

        throw error;
    }
}

export default async function Layout(props: Props) {
    const params = await props.params;

    const {
        children
    } = props;

    const { gangId } = params;
    const access = await getLayoutAccess(gangId);
    const { gang, member, session } = access;

    if (!session) redirect('/');

    const permissions = getGangPermissionFlags(member.gangRole);

    const [pendingLeaves] = await Promise.all([
        // Fetch pending leaves count for sidebar badge
        db.select({ count: sql<number>`count(*)` })
            .from(leaveRequests)
            .where(and(eq(leaveRequests.gangId, gangId), eq(leaveRequests.status, 'PENDING')))
    ]);

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
