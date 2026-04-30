export const dynamic = 'force-dynamic';

import { db, gangs, members } from '@gang/database';
import { eq, sql, desc } from 'drizzle-orm';
import { GangTable } from '../AdminClient';
import { getSubscriptionTierBadgeClass, getSubscriptionTierLabel } from '@/lib/subscriptionTier';
import Link from 'next/link';
import { Crown, Gem, Users, AlertTriangle, Clock } from 'lucide-react';

export default async function AdminGangsPage({
    searchParams,
}: {
    searchParams?: Promise<{
        search?: string;
        tier?: string;
        status?: string;
        attention?: string;
    }>;
}) {
    const resolvedSearchParams = await searchParams;
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

    const tierCounts = { FREE: 0, TRIAL: 0, PREMIUM: 0 } as Record<string, number>;
    activeGangs.forEach(g => { tierCounts[g.subscriptionTier] = (tierCounts[g.subscriptionTier] || 0) + 1; });

    const initialSearch = typeof resolvedSearchParams?.search === 'string' ? resolvedSearchParams.search : '';
    const initialTierFilter = ['ALL', 'FREE', 'TRIAL', 'PREMIUM'].includes(resolvedSearchParams?.tier || '') ? resolvedSearchParams!.tier! : 'ALL';
    const initialStatusFilter = ['ALL', 'ACTIVE', 'INACTIVE'].includes(resolvedSearchParams?.status || '') ? resolvedSearchParams!.status! : 'ALL';
    const initialAttentionFilter = ['ALL', 'TRIAL', 'EXPIRING', 'EXPIRED'].includes(resolvedSearchParams?.attention || '') ? resolvedSearchParams!.attention! : 'ALL';

    const supportShortcuts = [
        { href: '/admin/gangs?tier=TRIAL&attention=TRIAL', label: 'Trial', count: tierCounts.TRIAL, tone: 'border-border-accent bg-accent-subtle text-accent-bright' },
        { href: '/admin/gangs?attention=EXPIRING', label: 'ใกล้หมดอายุ', count: expiringSoon.length, tone: 'border-status-warning bg-status-warning-subtle text-fg-warning' },
        { href: '/admin/gangs?attention=EXPIRED', label: 'หมดอายุแล้ว', count: expiredGangs.length, tone: 'border-status-danger bg-status-danger-subtle text-fg-danger' },
        { href: '/admin/gangs?status=INACTIVE', label: 'Inactive', count: inactiveGangs.length, tone: 'border-border-subtle bg-bg-muted text-fg-secondary' },
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-black tracking-tight">จัดการแก๊ง</h1>
                <p className="text-fg-tertiary text-sm mt-1">เปลี่ยนแพลน, เพิ่มวันหมดอายุ, และเข้าจัดการเคส support จากหน้าเดียว</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    {supportShortcuts.map(shortcut => (
                        <Link key={shortcut.href} href={shortcut.href} className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1 text-[10px] font-bold transition-colors hover:brightness-110 ${shortcut.tone}`}>
                            {shortcut.label}
                            <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{shortcut.count}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Crown className="w-4 h-4 text-fg-info" />
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase">แก๊งทั้งหมด</span>
                    </div>
                    <div className="text-2xl font-black text-fg-primary tabular-nums">{allGangs.length}</div>
                    <div className="text-[10px] text-fg-tertiary mt-1">{activeGangs.length} active • {inactiveGangs.length} inactive • {totalMembers} สมาชิกรวม</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-2">
                        <Gem className="w-4 h-4 text-accent-bright" />
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase">แพลน</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                        {Object.entries(tierCounts).filter(([, c]) => c > 0).map(([tier, count]) => (
                            <span key={tier} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSubscriptionTierBadgeClass(tier)}`}>{getSubscriptionTierLabel(tier)} {count}</span>
                        ))}
                    </div>
                </div>
                <div className={`bg-bg-subtle border rounded-token-xl p-4 shadow-token-sm ${expiredGangs.length > 0 || expiringSoon.length > 0 ? 'border-status-warning' : 'border-border-subtle'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-fg-warning" />
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase">หมดอายุ</span>
                    </div>
                    <div className="text-2xl font-black text-fg-primary tabular-nums">{expiredGangs.length}</div>
                    <div className="text-[10px] text-fg-tertiary mt-1">
                        {expiringSoon.length > 0 && <span className="text-fg-warning">{expiringSoon.length} จะหมดใน 7 วัน</span>}
                        {expiringSoon.length === 0 && permanentGangs.length > 0 && <span className="text-fg-success">{permanentGangs.length} ถาวร</span>}
                        {expiringSoon.length === 0 && permanentGangs.length === 0 && 'ไม่มีแก๊งหมดอายุ'}
                    </div>
                </div>
                <div className={`bg-bg-subtle border rounded-token-xl p-4 shadow-token-sm ${inactiveGangs.length > 0 ? 'border-status-danger' : 'border-border-subtle'}`}>
                    <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-fg-danger" />
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase">Inactive</span>
                    </div>
                    <div className="text-2xl font-black text-fg-primary tabular-nums">{inactiveGangs.length}</div>
                    <div className="text-[10px] text-fg-tertiary mt-1">แก๊งที่ถูกปิด</div>
                </div>
            </div>

            {/* Expiring Soon Table */}
            {expiringSoon.length > 0 && (
                <div className="bg-bg-subtle border border-status-warning rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-4 border-b border-status-warning flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-fg-warning" />
                        <h3 className="text-sm font-bold text-fg-warning">จะหมดอายุใน 7 วัน ({expiringSoon.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-bg-muted text-fg-secondary text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 text-left">แก๊ง</th>
                                    <th className="px-4 py-2 text-center">แพลน</th>
                                    <th className="px-4 py-2 text-center">เหลือ</th>
                                    <th className="px-4 py-2 text-center">หมดอายุ</th>
                                    <th className="px-4 py-2 text-right">สมาชิก</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {expiringSoon.map(g => {
                                    const diff = Math.ceil((new Date(g.subscriptionExpiresAt!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    return (
                                        <tr key={g.id} className="hover:bg-bg-muted">
                                            <td className="px-4 py-2.5">
                                                <div className="text-xs font-medium text-fg-primary">{g.name}</div>
                                                <div className="text-[8px] text-fg-tertiary font-mono">{g.id}</div>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-token-full text-[9px] font-bold border ${getSubscriptionTierBadgeClass(g.subscriptionTier)}`}>{getSubscriptionTierLabel(g.subscriptionTier)}</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`text-xs font-bold tabular-nums ${diff <= 2 ? 'text-fg-danger' : 'text-fg-warning'}`}>{diff} วัน</span>
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-[10px] text-fg-secondary">
                                                {new Date(g.subscriptionExpiresAt!).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' })}
                                            </td>
                                            <td className="px-4 py-2.5 text-right text-xs text-fg-secondary tabular-nums">{memberCountMap.get(g.id) || 0}</td>
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
                <div className="bg-bg-subtle border border-status-danger rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-4 border-b border-status-danger flex items-center gap-2">
                        <Clock className="w-4 h-4 text-fg-danger" />
                        <h3 className="text-sm font-bold text-fg-danger">หมดอายุแล้ว ({expiredGangs.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-bg-muted text-fg-secondary text-[10px] uppercase tracking-wider">
                                <tr>
                                    <th className="px-4 py-2 text-left">แก๊ง</th>
                                    <th className="px-4 py-2 text-center">แพลน</th>
                                    <th className="px-4 py-2 text-center">หมดอายุเมื่อ</th>
                                    <th className="px-4 py-2 text-right">สมาชิก</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {expiredGangs.map(g => (
                                    <tr key={g.id} className="hover:bg-bg-muted">
                                        <td className="px-4 py-2.5">
                                            <div className="text-xs font-medium text-fg-primary">{g.name}</div>
                                            <div className="text-[8px] text-fg-tertiary font-mono">{g.id}</div>
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-token-full text-[9px] font-bold border ${getSubscriptionTierBadgeClass(g.subscriptionTier)}`}>{getSubscriptionTierLabel(g.subscriptionTier)}</span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center text-[10px] text-fg-danger font-bold">
                                            {new Date(g.subscriptionExpiresAt!).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-xs text-fg-secondary tabular-nums">{memberCountMap.get(g.id) || 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            <GangTable
                gangs={JSON.parse(JSON.stringify(allGangs))}
                memberCountMap={Object.fromEntries(memberCountMap)}
                initialSearch={initialSearch}
                initialTierFilter={initialTierFilter}
                initialStatusFilter={initialStatusFilter}
                initialAttentionFilter={initialAttentionFilter}
            />
        </div>
    );
}
