'use client';

import { useState, useMemo } from 'react';
import {
    Search,
    Users,
    UserCheck,
    UserX,
    Shield,
    Crown,
    Zap,
    Gem,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Globe,
    Wallet,
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
}

interface Stats {
    total: number;
    active: number;
    inactive: number;
    uniqueUsers: number;
    multiGang: number;
    roles: Record<string, number>;
}

const ITEMS_PER_PAGE = 30;

const ROLE_STYLES: Record<string, string> = {
    OWNER: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    ADMIN: 'bg-red-500/10 text-red-400 border-red-500/20',
    TREASURER: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    MEMBER: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
};

const TIER_STYLES: Record<string, string> = {
    FREE: 'text-gray-400',
    TRIAL: 'text-yellow-400',
    PRO: 'text-blue-400',
    PREMIUM: 'text-purple-400',
};

export function MemberSearch({ members, stats }: { members: MemberData[]; stats: Stats }) {
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

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
            return matchSearch && matchRole && matchStatus;
        });
    }, [members, search, roleFilter, statusFilter]);

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
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Users className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">ทั้งหมด</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.total.toLocaleString()}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Active</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.active.toLocaleString()}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Discord Users</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.uniqueUsers.toLocaleString()}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">หลายแก๊ง</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.multiGang}</div>
                    <div className="text-[9px] text-gray-600">คนที่อยู่มากกว่า 1 แก๊ง</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Crown className="w-3.5 h-3.5 text-purple-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">ตามบทบาท</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(stats.roles).map(([role, count]) => (
                            <span key={role} className={`text-[8px] font-bold px-1 py-0.5 rounded border ${ROLE_STYLES[role] || ROLE_STYLES.MEMBER}`}>
                                {role} {count}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, Discord ID, ชื่อแก๊ง..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                        />
                    </div>
                    <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none">
                        <option value="ALL">ทุกบทบาท</option>
                        <option value="OWNER">Owner</option>
                        <option value="ADMIN">Admin</option>
                        <option value="TREASURER">Treasurer</option>
                        <option value="MEMBER">Member</option>
                    </select>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none">
                        <option value="ALL">ทุกสถานะ</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                    </select>
                </div>
                <div className="mt-2 text-[10px] text-gray-600">
                    พบ {filtered.length.toLocaleString()} รายการ · หน้า {page}/{totalPages}
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full">
                    <thead className="bg-black/30 text-gray-500 text-[9px] uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-2.5 text-left">สมาชิก</th>
                            <th className="px-3 py-2.5 text-left">แก๊ง</th>
                            <th className="px-3 py-2.5 text-center">บทบาท</th>
                            <th className="px-3 py-2.5 text-center">สถานะ</th>
                            <th className="px-3 py-2.5 text-right">ยอดเงิน</th>
                            <th className="px-3 py-2.5 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paged.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-12 text-center">
                                    <Users className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                                    <p className="text-xs text-gray-600">ไม่พบสมาชิกที่ตรงกับการค้นหา</p>
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
                                            className="w-full grid grid-cols-[1fr_1fr_auto_auto_auto_auto] items-center gap-0 hover:bg-white/[0.02] transition-colors text-left"
                                        >
                                            <div className="px-4 py-2.5 flex items-center gap-2 min-w-0">
                                                {m.discordAvatar ? (
                                                    <img src={m.discordAvatar} alt="" className="w-7 h-7 rounded-full border border-white/10 shrink-0" />
                                                ) : (
                                                    <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                        <Users className="w-3 h-3 text-gray-600" />
                                                    </div>
                                                )}
                                                <div className="min-w-0">
                                                    <div className="text-xs font-medium text-white truncate">{m.name}</div>
                                                    <div className="text-[9px] text-gray-600 font-mono truncate">
                                                        {m.discordUsername || m.discordId || 'ไม่มี Discord'}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="px-3 py-2.5 min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    {m.gangLogo ? (
                                                        <img src={m.gangLogo} alt="" className="w-4 h-4 rounded shrink-0" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded bg-white/5 shrink-0" />
                                                    )}
                                                    <span className="text-[10px] text-gray-300 truncate">{m.gangName || 'Unknown'}</span>
                                                    <span className={`text-[8px] font-bold ${TIER_STYLES[m.gangTier || 'FREE']}`}>{m.gangTier}</span>
                                                </div>
                                            </div>
                                            <div className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-bold border ${ROLE_STYLES[m.gangRole] || ROLE_STYLES.MEMBER}`}>
                                                    {m.gangRole}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2.5 text-center">
                                                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-bold ${m.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                                    {m.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2.5 text-right">
                                                <span className={`text-xs font-bold tabular-nums ${m.balance < 0 ? 'text-red-400' : m.balance > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                                                    {m.balance !== 0 ? `${m.balance >= 0 ? '+' : ''}${m.balance.toLocaleString()}` : '—'}
                                                </span>
                                            </div>
                                            <div className="px-3 py-2.5">
                                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
                                            </div>
                                        </button>

                                        {/* Expanded detail */}
                                        {isExpanded && (
                                            <div className="px-4 py-3 bg-black/20 border-t border-white/5">
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                                    <div>
                                                        <span className="text-gray-600 block mb-0.5">Member ID</span>
                                                        <button onClick={() => copyId(m.id)} className="flex items-center gap-1 text-gray-400 hover:text-white font-mono transition-colors">
                                                            {m.id.slice(0, 16)}…
                                                            {copiedId === m.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600 block mb-0.5">Discord ID</span>
                                                        {m.discordId ? (
                                                            <button onClick={() => copyId(m.discordId!)} className="flex items-center gap-1 text-gray-400 hover:text-white font-mono transition-colors">
                                                                {m.discordId}
                                                                {copiedId === m.discordId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                            </button>
                                                        ) : (
                                                            <span className="text-gray-700">ไม่มี</span>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600 block mb-0.5">Gang ID</span>
                                                        <button onClick={() => copyId(m.gangId)} className="flex items-center gap-1 text-gray-400 hover:text-white font-mono transition-colors">
                                                            {m.gangId.slice(0, 12)}…
                                                            {copiedId === m.gangId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                        </button>
                                                    </div>
                                                    <div>
                                                        <span className="text-gray-600 block mb-0.5">เข้าร่วมเมื่อ</span>
                                                        <span className="text-gray-400">
                                                            {new Date(m.joinedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
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
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">
                        ← ก่อนหน้า
                    </button>
                    <span className="text-xs text-gray-500 tabular-nums">{page} / {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                        className="px-3 py-1.5 text-xs rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed">
                        ถัดไป →
                    </button>
                </div>
            )}
        </div>
    );
}
