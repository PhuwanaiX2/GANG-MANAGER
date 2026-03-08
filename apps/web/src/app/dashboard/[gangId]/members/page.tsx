export const dynamic = 'force-dynamic';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db, gangs, members } from '@gang/database';
import { eq, and } from 'drizzle-orm';
import { MembersTable } from '@/components/MembersTable';
import { Users, ShieldCheck } from 'lucide-react';

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
        <div className="animate-fade-in space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white font-heading mb-2">สมาชิกในระบบ</h1>
                    <div className="flex items-center gap-3 text-sm text-zinc-400">
                        <div className="flex items-center gap-1.5">
                            <Users className="w-4 h-4 text-zinc-500" />
                            <span>ทั้งหมด {allMembers.length} คน</span>
                        </div>
                        <div className="w-1 h-1 bg-zinc-600 rounded-full" />
                        <div className="flex items-center gap-1.5">
                            <ShieldCheck className="w-4 h-4 text-emerald-500" />
                            <span className="text-zinc-300">ประจำการ {activeMembers} คน</span>
                        </div>
                    </div>
                </div>
            </div>

            <MembersTable members={allMembers} gangId={gangId} />
        </div>
    );
}
