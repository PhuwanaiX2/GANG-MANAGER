export const dynamic = 'force-dynamic';

import { db, members, gangs } from '@gang/database';
import { eq, sql, desc } from 'drizzle-orm';
import { MemberSearch } from './MemberSearch';
import Link from 'next/link';

export default async function AdminMembersPage({
    searchParams,
}: {
    searchParams?: Promise<{
        search?: string;
        role?: string;
        status?: string;
        support?: string;
    }>;
}) {
    const resolvedSearchParams = await searchParams;
    // Get all members with their gang info
    const allMembers = await db.select({
        id: members.id,
        name: members.name,
        discordId: members.discordId,
        discordUsername: members.discordUsername,
        discordAvatar: members.discordAvatar,
        isActive: members.isActive,
        gangRole: members.gangRole,
        balance: members.balance,
        status: members.status,
        joinedAt: members.joinedAt,
        gangId: members.gangId,
        gangName: gangs.name,
        gangTier: gangs.subscriptionTier,
        gangLogo: gangs.logoUrl,
        gangActive: gangs.isActive,
    })
    .from(members)
    .leftJoin(gangs, eq(members.gangId, gangs.id))
    .orderBy(desc(members.createdAt))
    .limit(5000);

    // Stats
    const totalActive = allMembers.filter(m => m.isActive).length;
    const totalInactive = allMembers.filter(m => !m.isActive).length;
    const uniqueDiscordIds = new Set(allMembers.filter(m => m.discordId).map(m => m.discordId)).size;
    const discordUsageMap = (() => {
        const discordMap = new Map<string, number>();
        allMembers.filter(m => m.discordId && m.isActive).forEach(m => {
            discordMap.set(m.discordId!, (discordMap.get(m.discordId!) || 0) + 1);
        });
        return discordMap;
    })();
    const multiGangUsers = Array.from(discordUsageMap.values()).filter(c => c > 1).length;
    const pendingCount = allMembers.filter(m => m.status === 'PENDING').length;
    const noDiscordCount = allMembers.filter(m => !m.discordId).length;
    const inactiveGangMemberCount = allMembers.filter(m => m.gangActive === false).length;

    const roleBreakdown = allMembers.filter(m => m.isActive).reduce((acc, m) => {
        acc[m.gangRole] = (acc[m.gangRole] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const initialSearch = typeof resolvedSearchParams?.search === 'string' ? resolvedSearchParams.search : '';
    const initialRoleFilter = ['ALL', 'OWNER', 'ADMIN', 'TREASURER', 'MEMBER'].includes(resolvedSearchParams?.role || '') ? resolvedSearchParams!.role! : 'ALL';
    const initialStatusFilter = ['ALL', 'ACTIVE', 'INACTIVE'].includes(resolvedSearchParams?.status || '') ? resolvedSearchParams!.status! : 'ALL';
    const initialSupportFilter = ['ALL', 'MULTI_GANG', 'NO_DISCORD', 'PENDING', 'INACTIVE_GANG'].includes(resolvedSearchParams?.support || '') ? resolvedSearchParams!.support! : 'ALL';

    const supportQueues = [
        { href: '/admin/members?support=MULTI_GANG', label: 'หลายแก๊ง', count: multiGangUsers, tone: 'border-status-warning bg-status-warning-subtle text-fg-warning' },
        { href: '/admin/members?support=NO_DISCORD', label: 'ไม่มี Discord', count: noDiscordCount, tone: 'border-border-subtle bg-bg-muted text-fg-secondary' },
        { href: '/admin/members?support=PENDING', label: 'Pending', count: pendingCount, tone: 'border-status-warning bg-status-warning-subtle text-fg-warning' },
        { href: '/admin/members?support=INACTIVE_GANG', label: 'แก๊งถูกปิด', count: inactiveGangMemberCount, tone: 'border-status-danger bg-status-danger-subtle text-fg-danger' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ค้นหาสมาชิก</h1>
                <p className="text-fg-tertiary text-sm mt-1">ค้นหาสมาชิกทั้งระบบ ข้ามแก๊ง — สำหรับ support & ตรวจสอบ</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {supportQueues.map(queue => (
                        <Link key={queue.href} href={queue.href} className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1 text-[10px] font-bold transition-colors hover:brightness-110 ${queue.tone}`}>
                            {queue.label}
                            <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{queue.count}</span>
                        </Link>
                    ))}
                </div>
            </div>

            <MemberSearch
                members={JSON.parse(JSON.stringify(allMembers.map(member => ({
                    ...member,
                    identityGangCount: member.discordId ? (discordUsageMap.get(member.discordId) || 0) : 0,
                }))))}
                stats={{
                    total: allMembers.length,
                    active: totalActive,
                    inactive: totalInactive,
                    uniqueUsers: uniqueDiscordIds,
                    multiGang: multiGangUsers,
                    pending: pendingCount,
                    noDiscord: noDiscordCount,
                    inactiveGangMembers: inactiveGangMemberCount,
                    roles: roleBreakdown,
                }}
                initialSearch={initialSearch}
                initialRoleFilter={initialRoleFilter}
                initialStatusFilter={initialStatusFilter}
                initialSupportFilter={initialSupportFilter}
            />
        </div>
    );
}
