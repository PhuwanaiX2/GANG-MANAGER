export const dynamic = 'force-dynamic';

import { db, gangs, members } from '@gang/database';
import { eq, sql, desc } from 'drizzle-orm';
import { GangTable } from '../AdminClient';
import { Crown, Zap, Gem, Users, AlertTriangle, Clock } from 'lucide-react';

export default async function AdminGangsPage() {
    const [allGangs, gangMemberCounts] = await Promise.all([
        db.query.gangs.findMany({
            orderBy: desc(gangs.createdAt),
            columns: { id: true, name: true, subscriptionTier: true, subscriptionExpiresAt: true, createdAt: true, discordGuildId: true, logoUrl: true, isActive: true },
        }),
        db.select({
            gangId: members.gangId,
            count: sql<number>`count(*)`,
        }).from(members).where(eq(members.isActive, true)).groupBy(members.gangId),
    ]);

    const memberCountMap = new Map(gangMemberCounts.map(g => [g.gangId, g.count]));
    const totalMembers = gangMemberCounts.reduce((sum, g) => sum + g.count, 0);

    // Stats
    const activeGangs = allGangs.filter(g => g.isActive);
    const inactiveGangs = allGangs.filter(g => !g.isActive);
    const now = new Date();
    const expiredGangs = activeGangs.filter(g => g.subscriptionExpiresAt && new Date(g.subscriptionExpiresAt) < now);
    const expiringSoon = activeGangs.filter(g => {
        if (!g.subscriptionExpiresAt) return false;
        const d = new Date(g.subscriptionExpiresAt);
        const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff > 0 && diff <= 7;
    });
    const permanentGangs = activeGangs.filter(g => !g.subscriptionExpiresAt && g.subscriptionTier !== 'FREE');

    const tierCounts = { FREE: 0, TRIAL: 0, PRO: 0, PREMIUM: 0 } as Record<string, number>;
    activeGangs.forEach(g => { tierCounts[g.subscriptionTier] = (tierCounts[g.subscriptionTier] || 0) + 1; });

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">จัดการแก๊ง</h1>
                <p className="text-gray-500 text-sm mt-1">เปลี่ยนแพลน, เพิ่มวันหมดอายุ, ดูข้อมูลแก๊งทั้งหมด</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-blue-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase">แก๊งทั้งหมด</span>
                    </div>
                    <div className="text-2xl font-black text-white tabular-nums">{activeGangs.length}</div>
                    <div className="text-[10px] text-gray-600 mt-1">{totalMembers} สมาชิกรวม</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Gem className="w-4 h-4 text-purple-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase">แพลน</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                        {Object.entries(tierCounts).filter(([, c]) => c > 0).map(([tier, count]) => (
                            <span key={tier} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                tier === 'PRO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                tier === 'PREMIUM' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                tier === 'TRIAL' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                'bg-gray-500/10 text-gray-400 border-gray-500/20'
                            }`}>{tier} {count}</span>
                        ))}
                    </div>
                </div>
                <div className={`bg-[#111] border rounded-xl p-4 ${expiredGangs.length > 0 || expiringSoon.length > 0 ? 'border-yellow-500/20' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-yellow-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase">หมดอายุ</span>
                    </div>
                    <div className="text-2xl font-black text-white tabular-nums">{expiredGangs.length}</div>
                    <div className="text-[10px] text-gray-600 mt-1">
                        {expiringSoon.length > 0 && <span className="text-yellow-400">{expiringSoon.length} จะหมดใน 7 วัน</span>}
                        {expiringSoon.length === 0 && permanentGangs.length > 0 && <span className="text-emerald-400">{permanentGangs.length} ถาวร</span>}
                        {expiringSoon.length === 0 && permanentGangs.length === 0 && 'ไม่มีแก๊งหมดอายุ'}
                    </div>
                </div>
                <div className={`bg-[#111] border rounded-xl p-4 ${inactiveGangs.length > 0 ? 'border-red-500/20' : 'border-white/5'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Inactive</span>
                    </div>
                    <div className="text-2xl font-black text-white tabular-nums">{inactiveGangs.length}</div>
                    <div className="text-[10px] text-gray-600 mt-1">แก๊งที่ถูกปิด</div>
                </div>
            </div>

            {/* Expiring Soon Table */}
            {expiringSoon.length > 0 && (
                <div className="bg-[#111] border border-yellow-500/20 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-yellow-500/10 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                        <h3 className="text-sm font-bold text-yellow-400">จะหมดอายุใน 7 วัน ({expiringSoon.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-black/30 text-gray-400 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 text-left">แก๊ง</th>
                                    <th className="px-4 py-2 text-center">แพลน</th>
                                    <th className="px-4 py-2 text-center">เหลือ</th>
                                    <th className="px-4 py-2 text-center">หมดอายุ</th>
                                    <th className="px-4 py-2 text-right">สมาชิก</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {expiringSoon.map(g => {
                                    const diff = Math.ceil((new Date(g.subscriptionExpiresAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <tr key={g.id} className="hover:bg-white/[0.02]">
                                            <td className="px-4 py-2.5">
                                                <div className="text-xs font-medium text-white">{g.name}</div>
                                                <div className="text-[8px] text-gray-600 font-mono">{g.id}</div>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                                    g.subscriptionTier === 'PRO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                    g.subscriptionTier === 'PREMIUM' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                    'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                                }`}>{g.subscriptionTier}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`text-xs font-bold tabular-nums ${diff <= 2 ? 'text-red-400' : 'text-yellow-400'}`}>{diff} วัน</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-[10px] text-gray-400">
                                                {new Date(g.subscriptionExpiresAt!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-xs text-gray-300 tabular-nums">{memberCountMap.get(g.id) || 0}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Expired Table */}
            {expiredGangs.length > 0 && (
                <div className="bg-[#111] border border-red-500/20 rounded-2xl overflow-hidden">
                    <div className="p-4 border-b border-red-500/10 flex items-center gap-2">
                        <Clock className="w-4 h-4 text-red-400" />
                        <h3 className="text-sm font-bold text-red-400">หมดอายุแล้ว ({expiredGangs.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-black/30 text-gray-400 text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 text-left">แก๊ง</th>
                                    <th className="px-4 py-2 text-center">แพลน</th>
                                    <th className="px-4 py-2 text-center">หมดอายุเมื่อ</th>
                                    <th className="px-4 py-2 text-right">สมาชิก</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {expiredGangs.map(g => (
                                    <tr key={g.id} className="hover:bg-white/[0.02]">
                                        <td className="px-4 py-2.5">
                                            <div className="text-xs font-medium text-white">{g.name}</div>
                                            <div className="text-[8px] text-gray-600 font-mono">{g.id}</div>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                                                g.subscriptionTier === 'PRO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                g.subscriptionTier === 'PREMIUM' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                'bg-gray-500/10 text-gray-400 border-gray-500/20'
                                            }`}>{g.subscriptionTier}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-[10px] text-red-400 font-bold">
                                            {new Date(g.subscriptionExpiresAt!).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-gray-300 tabular-nums">{memberCountMap.get(g.id) || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <GangTable
                gangs={JSON.parse(JSON.stringify(activeGangs))}
                memberCountMap={Object.fromEntries(memberCountMap)}
            />
        </div>
    );
}
