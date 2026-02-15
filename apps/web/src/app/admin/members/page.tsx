export const dynamic = 'force-dynamic';

import { db, members, gangs } from '@gang/database';
import { eq, sql, desc } from 'drizzle-orm';
import { MemberSearch } from './MemberSearch';

export default async function AdminMembersPage() {
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
    const multiGangUsers = (() => {
        const discordMap = new Map<string, number>();
        allMembers.filter(m => m.discordId && m.isActive).forEach(m => {
            discordMap.set(m.discordId!, (discordMap.get(m.discordId!) || 0) + 1);
        });
        return Array.from(discordMap.values()).filter(c => c > 1).length;
    })();

    const roleBreakdown = allMembers.filter(m => m.isActive).reduce((acc, m) => {
        acc[m.gangRole] = (acc[m.gangRole] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">ค้นหาสมาชิก</h1>
                <p className="text-gray-500 text-sm mt-1">ค้นหาสมาชิกทั้งระบบ ข้ามแก๊ง — สำหรับ support & ตรวจสอบ</p>
            </div>

            <MemberSearch
                members={JSON.parse(JSON.stringify(allMembers))}
                stats={{
                    total: allMembers.length,
                    active: totalActive,
                    inactive: totalInactive,
                    uniqueUsers: uniqueDiscordIds,
                    multiGang: multiGangUsers,
                    roles: roleBreakdown,
                }}
            />
        </div>
    );
}
