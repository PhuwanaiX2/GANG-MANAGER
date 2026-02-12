import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
// import { DashboardLayout } from '@/components/DashboardLayout';
import { MembersTable } from '@/components/MembersTable';
import { Users } from 'lucide-react';

interface Props {
    params: { gangId: string };
}

export default async function MembersPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session) redirect('/');

    const { gangId } = params;

    // Parallelize data fetching
    const [allMembers, currentUserMember] = await Promise.all([
        db.query.members.findMany({
            where: eq(members.gangId, gangId),
            orderBy: (members, { asc }) => [asc(members.name)],
        }),
        // Security check: Is current user a member?
        db.query.members.findFirst({
            where: and(
                eq(members.gangId, gangId),
                eq(members.discordId, session.user.discordId)
            ),
        })
    ]);

    if (!currentUserMember) {
        redirect('/dashboard');
    }

    const activeMembers = allMembers.filter(m => m.isActive).length;

    return (
        <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-2">สมาชิก</h1>
                    <div className="flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4" />
                            <span>ทั้งหมด {allMembers.length} คน</span>
                        </div>
                        <div className="w-1 h-1 bg-gray-600 rounded-full" />
                        <span className="text-green-400">ใช้งานอยู่ {activeMembers} คน</span>
                    </div>
                </div>

            </div>

            <MembersTable members={allMembers} gangId={gangId} />
        </>
    );
}
