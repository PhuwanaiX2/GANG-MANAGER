'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';
import {
    Search,
    Users,
    UserCheck,
    Shield,
    Crown,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Globe,
    AlertTriangle,
    ArrowRight,
} from 'lucide-react';

interface MemberData {
    id: string;
    name: string;
    discordId: string | null;
    discordUsername: string | null;
    discordAvatar: string | null;
    isActive: boolean;
    gangRole: string;
    balance: number;
    status: string;
    joinedAt: string;
    gangId: string;
    gangName: string | null;
    gangTier: string | null;
    gangLogo: string | null;
    gangActive: boolean | null;
    identityGangCount: number;
}

interface Stats {
    total: number;
    active: number;
    inactive: number;
    uniqueUsers: number;
    multiGang: number;
    pending: number;
    noDiscord: number;
    inactiveGangMembers: number;
    roles: Record<string, number>;
}

const ITEMS_PER_PAGE = 30;

const ROLE_STYLES: Record<string, string> = {
    OWNER: 'bg-status-warning-subtle text-fg-warning border-status-warning',
    ADMIN: 'bg-status-danger-subtle text-fg-danger border-status-danger',
    TREASURER: 'bg-status-success-subtle text-fg-success border-status-success',
    MEMBER: 'bg-bg-muted text-fg-secondary border-border-subtle',
};

const TIER_STYLES: Record<string, string> = {
    FREE: 'text-fg-secondary',
    PREMIUM: 'text-accent-bright',
};

export function MemberSearch({
    members,
    stats,
    initialSearch = '',
    initialRoleFilter = 'ALL',
    initialStatusFilter = 'ALL',
    initialSupportFilter = 'ALL',
}: {
    members: MemberData[];
    stats: Stats;
    initialSearch?: string;
    initialRoleFilter?: string;
    initialStatusFilter?: string;
    initialSupportFilter?: string;
}) {
    const [search, setSearch] = useState(initialSearch);
    const [roleFilter, setRoleFilter] = useState<string>(initialRoleFilter);
    const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
    const [supportFilter, setSupportFilter] = useState<string>(initialSupportFilter);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        setSearch(initialSearch);
        setRoleFilter(initialRoleFilter);
        setStatusFilter(initialStatusFilter);
        setSupportFilter(initialSupportFilter);
        setPage(1);
        setExpandedId(null);
    }, [initialSearch, initialRoleFilter, initialStatusFilter, initialSupportFilter]);

    const filtered = useMemo(() => {
        return members.filter(m => {
            const q = search.toLowerCase();
            const matchSearch = !search ||
                m.name.toLowerCase().includes(q) ||
                (m.discordId && m.discordId.includes(search)) ||
                (m.discordUsername && m.discordUsername.toLowerCase().includes(q)) ||
                m.id.includes(search) ||
                (m.gangName && m.gangName.toLowerCase().includes(q));
            const matchRole = roleFilter === 'ALL' || m.gangRole === roleFilter;
            const matchStatus = statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && m.isActive) ||
                (statusFilter === 'INACTIVE' && !m.isActive);
            const matchSupport = supportFilter === 'ALL'
                || (supportFilter === 'MULTI_GANG' && m.identityGangCount > 1)
                || (supportFilter === 'NO_DISCORD' && !m.discordId)
                || (supportFilter === 'PENDING' && m.status === 'PENDING')
                || (supportFilter === 'INACTIVE_GANG' && m.gangActive === false);
            return matchSearch && matchRole && matchStatus && matchSupport;
        });
    }, [members, search, roleFilter, statusFilter, supportFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const copyId = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-fg-info" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">ทั้งหมด</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.total.toLocaleString()}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-3.5 h-3.5 text-fg-success" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">Active</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.active.toLocaleString()}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-3.5 h-3.5 text-fg-info" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">Discord Users</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.uniqueUsers.toLocaleString()}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-fg-warning" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">หลายแก๊ง</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.multiGang}</div>
                    <div className="text-[9px] text-fg-tertiary">คนที่อยู่มากกว่า 1 แก๊ง</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-fg-warning" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">Pending</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.pending}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-3.5 h-3.5 text-fg-secondary" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">No Discord</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.noDiscord}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-fg-danger" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">Inactive Gang</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.inactiveGangMembers}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Crown className="w-3.5 h-3.5 text-accent-bright" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">ตามบทบาท</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(stats.roles).map(([role, count]) => (
                            <span key={role} className={`text-[8px] font-bold px-1 py-0.5 rounded-token-sm border ${ROLE_STYLES[role] || ROLE_STYLES.MEMBER}`}>
                                {role} {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-tertiary" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, Discord ID, ชื่อแก๊ง..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border"
                        />
                    </div>
                    <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border">
                        <option value="ALL">ทุกบทบาท</option>
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="TREASURER">Treasurer</option>
                        <option value="MEMBER">Member</option>
                    </select>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border">
                        <option value="ALL">ทุกสถานะ</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                    <select value={supportFilter} onChange={e => { setSupportFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border">
                        <option value="ALL">ทุกเคส support</option>
                        <option value="MULTI_GANG">หลายแก๊ง</option>
                        <option value="NO_DISCORD">ไม่มี Discord</option>
                        <option value="PENDING">Pending</option>
                        <option value="INACTIVE_GANG">แก๊งถูกปิด</option>
                    </select>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-fg-tertiary">
                    <span>พบ {filtered.length.toLocaleString()} รายการ</span>
                    <span>·</span>
                    <span>หน้า {page}/{totalPages}</span>
                    {(search || roleFilter !== 'ALL' || statusFilter !== 'ALL' || supportFilter !== 'ALL') && (
                        <button
                            onClick={() => {
                                setSearch('');
                                setRoleFilter('ALL');
                                setStatusFilter('ALL');
                                setSupportFilter('ALL');
                                setPage(1);
                            }}
                            className="ml-auto text-fg-info hover:text-fg-primary"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <table className="w-full">
                    <thead className="bg-bg-muted text-fg-tertiary text-[9px] uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-2.5 text-left">สมาชิก</th>
                            <th className="px-3 py-2.5 text-left">แก๊ง</th>
                            <th className="px-3 py-2.5 text-center">บทบาท</th>
                            <th className="px-3 py-2.5 text-center">สถานะ</th>
                            <th className="px-3 py-2.5 text-right">ยอดเงิน</th>
                            <th className="px-3 py-2.5 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center">
                                    <Users className="w-8 h-8 text-fg-tertiary mx-auto mb-2" />
                                    <p className="text-xs text-fg-tertiary">ไม่พบสมาชิกที่ตรงกับการค้นหา</p>
                                </td>
                            </tr>
                        )}
                        {paged.map(m => {
                            const isExpanded = expandedId === m.id;
                            return (
                                <tr key={m.id} className="group">
                                    <td colSpan={6} className="p-0">
                                        {/* Main row */}
                                        <button
                                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                                            className="w-full grid grid-cols-[1fr_1fr_auto_auto_auto_auto] items-center gap-0 hover:bg-bg-muted transition-colors text-left"
                                        >
                                            <div className="px-4 py-2.5 flex items-center gap-2 min-w-0">
                                                {m.discordAvatar ? (
                                                    <img src={m.discordAvatar} alt="" className="w-7 h-7 rounded-token-full border border-border-subtle shrink-0" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-token-full bg-bg-muted border border-border-subtle flex items-center justify-center shrink-0">
                                                        <Users className="w-3 h-3 text-fg-tertiary" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-fg-primary truncate">{m.name}</div>
                                                    <div className="flex items-center gap-1.5 flex-wrap text-[9px] text-fg-tertiary font-mono truncate">
                                                        <span>{m.discordUsername || m.discordId || 'ไม่มี Discord'}</span>
                                                        {m.identityGangCount > 1 && (
                                                            <span className="rounded-token-full border border-status-warning bg-status-warning-subtle px-1.5 py-0.5 text-[8px] font-bold text-fg-warning">
                                                                {m.identityGangCount} gangs
                                                            </span>
                                                        )}
                                                        {!m.discordId && (
                                                            <span className="rounded-token-full border border-border-subtle bg-bg-muted px-1.5 py-0.5 text-[8px] font-bold text-fg-secondary">
                                                                NO DISCORD
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-3 py-2.5 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    {m.gangLogo ? (
                                                        <img src={m.gangLogo} alt="" className="w-4 h-4 rounded-token-sm shrink-0" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-token-sm bg-bg-muted shrink-0" />
                                                    )}
                                                    <span className="text-[10px] text-fg-secondary truncate">{m.gangName || 'Unknown'}</span>
                                                    <span className={`text-[8px] font-bold ${TIER_STYLES[normalizeSubscriptionTierValue(m.gangTier || 'FREE')]}`}>{normalizeSubscriptionTierValue(m.gangTier || 'FREE')}</span>
                                                    {m.gangActive === false && (
                                                        <span className="rounded-token-full border border-status-danger bg-status-danger-subtle px-1.5 py-0.5 text-[8px] font-bold text-fg-danger">
                                                            INACTIVE GANG
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold border ${ROLE_STYLES[m.gangRole] || ROLE_STYLES.MEMBER}`}>
                                                    {m.gangRole}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-token-full text-[8px] font-bold ${m.status === 'PENDING' ? 'bg-status-warning-subtle text-fg-warning' : m.isActive ? 'bg-status-success-subtle text-fg-success' : 'bg-status-danger-subtle text-fg-danger'}`}>
                                                    {m.status === 'PENDING' ? 'Pending' : m.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2.5 text-right">
                                                <span className={`text-xs font-bold tabular-nums ${m.balance < 0 ? 'text-fg-danger' : m.balance > 0 ? 'text-fg-success' : 'text-fg-tertiary'}`}>
                                                    {m.balance !== 0 ? `${m.balance >= 0 ? '+' : ''}${m.balance.toLocaleString()}` : '—'}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2.5">
                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-fg-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-fg-tertiary" />}
                                            </div>
                                        </button>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className="px-4 py-3 bg-bg-muted border-t border-border-subtle">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                                    <div>
                                                        <span className="text-fg-tertiary block mb-0.5">Member ID</span>
                                                        <button onClick={() => copyId(m.id)} className="flex items-center gap-1 text-fg-secondary hover:text-fg-primary font-mono transition-colors">
                                                            {m.id.slice(0, 16)}…
                                                            {copiedId === m.id ? <Check className="w-3 h-3 text-fg-success" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <span className="text-fg-tertiary block mb-0.5">Discord ID</span>
                                                        {m.discordId ? (
                                                            <button onClick={() => copyId(m.discordId!)} className="flex items-center gap-1 text-fg-secondary hover:text-fg-primary font-mono transition-colors">
                                                                {m.discordId}
                                                                {copiedId === m.discordId ? <Check className="w-3 h-3 text-fg-success" /> : <Copy className="w-3 h-3" />}
                                                            </button>
                                                        ) : (
                                                            <span className="text-fg-tertiary">ไม่มี</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-fg-tertiary block mb-0.5">Gang ID</span>
                                                        <button onClick={() => copyId(m.gangId)} className="flex items-center gap-1 text-fg-secondary hover:text-fg-primary font-mono transition-colors">
                                                            {m.gangId.slice(0, 12)}…
                                                            {copiedId === m.gangId ? <Check className="w-3 h-3 text-fg-success" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <span className="text-fg-tertiary block mb-0.5">เข้าร่วมเมื่อ</span>
                                                        <span className="text-fg-secondary">
                                                            {new Date(m.joinedAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px]">
                                                    <Link
                                                        href={`/admin/gangs?search=${encodeURIComponent(m.gangId)}`}
                                                        className="inline-flex items-center gap-1 rounded-token-lg border border-status-info bg-status-info-subtle px-2.5 py-1 font-bold text-fg-info hover:brightness-110"
                                                    >
                                                        เปิดเคสแก๊ง
                                                        <ArrowRight className="w-3 h-3" />
                                                    </Link>
                                                    <Link
                                                        href={`/admin/logs?search=${encodeURIComponent(m.discordId || m.id)}`}
                                                        className="inline-flex items-center gap-1 rounded-token-lg border border-status-info bg-status-info-subtle px-2.5 py-1 font-bold text-fg-info hover:brightness-110"
                                                    >
                                                        ดู logs ที่เกี่ยวข้อง
                                                        <ArrowRight className="w-3 h-3" />
                                                    </Link>
                                                </div>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                        className="px-3 py-1.5 text-xs rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-secondary hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed shadow-token-sm">
                        ← ก่อนหน้า
                    </button>
                    <span className="text-xs text-fg-tertiary tabular-nums">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-3 py-1.5 text-xs rounded-token-lg bg-bg-subtle border border-border-subtle text-fg-secondary hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed shadow-token-sm">
                        ถัดไป →
                    </button>
                </div>
            )}
        </div>
    );
}
