'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Key, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Copy,
    Crown, Zap, Gem, ChevronDown, ChevronUp, Search, Info,
    Calendar, ChevronLeft, ChevronRight, Settings, CheckSquare, Square,
    Download, Database, AlertTriangle, Server, Users, FileText, Shield, Loader2,
    BarChart3, Clock, UserX, ScrollText, Power, Wrench
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

interface License {
    id: string;
    key: string;
    tier: string;
    durationDays: number;
    isActive: boolean;
    maxMembers: number;
    expiresAt: string | null;
    createdAt: string;
}

// ==================== LICENSE MANAGEMENT ====================
export function LicenseManager({ initialLicenses }: { initialLicenses: License[] }) {
    const router = useRouter();
    const [licenses, setLicenses] = useState(initialLicenses);
    const [creating, setCreating] = useState(false);
    const [tier, setTier] = useState<'PRO' | 'PREMIUM'>('PRO');
    const [createCount, setCreateCount] = useState(1);
    const [deleting, setDeleting] = useState(false);
    const [durationDays, setDurationDays] = useState(30);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmCreate, setConfirmCreate] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
    const [searchKey, setSearchKey] = useState('');

    const activeCount = licenses.filter(l => l.isActive).length;
    const inactiveCount = licenses.filter(l => !l.isActive).length;

    const filteredLicenses = useMemo(() => {
        return licenses.filter(l => {
            if (filterStatus === 'active' && !l.isActive) return false;
            if (filterStatus === 'inactive' && l.isActive) return false;
            if (searchKey && !l.key.toLowerCase().includes(searchKey.toLowerCase())) return false;
            return true;
        });
    }, [licenses, filterStatus, searchKey]);

    const handleBulkCreate = async () => {
        setCreating(true);
        setConfirmCreate(false);
        const count = Math.min(Math.max(createCount, 1), 50);
        let created = 0;
        try {
            for (let i = 0; i < count; i++) {
                const res = await fetch('/api/admin/licenses', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ tier, durationDays }),
                });
                if (!res.ok) throw new Error();
                const newLicense = await res.json();
                setLicenses(prev => [newLicense, ...prev]);
                created++;
            }
            toast.success(`สร้าง ${created} License สำเร็จ`);
        } catch {
            toast.error(`สร้างได้ ${created}/${count}`);
        } finally {
            setCreating(false);
        }
    };

    const handleToggle = async (id: string, currentActive: boolean) => {
        try {
            const res = await fetch(`/api/admin/licenses/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isActive: !currentActive }),
            });
            if (!res.ok) throw new Error();
            setLicenses(prev => prev.map(l => l.id === id ? { ...l, isActive: !currentActive } : l));
            toast.success(currentActive ? 'ปิดใช้งาน License แล้ว' : 'เปิดใช้งาน License แล้ว');
        } catch {
            toast.error('อัปเดตไม่สำเร็จ');
        }
    };

    const handleBulkDelete = async () => {
        setDeleting(true);
        setConfirmBulkDelete(false);
        const ids = Array.from(selected);
        let deleted = 0;
        for (const id of ids) {
            try {
                const res = await fetch(`/api/admin/licenses/${id}`, { method: 'DELETE' });
                if (res.ok) { deleted++; setLicenses(prev => prev.filter(l => l.id !== id)); }
            } catch { /* skip */ }
        }
        setSelected(new Set());
        toast.success(`ลบ ${deleted}/${ids.length} License สำเร็จ`);
        setDeleting(false);
    };

    const copyKey = (key: string) => {
        navigator.clipboard.writeText(key);
        toast.success('คัดลอก License Key แล้ว');
    };

    const toggleSelect = (id: string) => {
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const ids = filteredLicenses.map(l => l.id);
        if (ids.every(id => selected.has(id))) setSelected(new Set());
        else setSelected(new Set(ids));
    };

    return (
        <div className="space-y-4">
            {/* Stats Row */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                    <div className="text-2xl font-black text-white tabular-nums">{licenses.length}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">ทั้งหมด</div>
                </div>
                <div className="bg-[#111] border border-emerald-500/10 rounded-xl p-4">
                    <div className="text-2xl font-black text-emerald-400 tabular-nums">{activeCount}</div>
                    <div className="text-[10px] text-emerald-400/60 font-bold uppercase tracking-wider mt-1">พร้อมใช้</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-4">
                    <div className="text-2xl font-black text-gray-500 tabular-nums">{inactiveCount}</div>
                    <div className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mt-1">ใช้แล้ว/ปิด</div>
                </div>
            </div>

            {/* Create Form */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white mb-4">สร้าง License Key</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">แพลน</label>
                            <select value={tier} onChange={e => setTier(e.target.value as 'PRO' | 'PREMIUM')}
                                className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-white/20 transition-colors">
                                <option value="PRO">PRO</option>
                                <option value="PREMIUM">PREMIUM</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">อายุ (วัน)</label>
                            <input type="number" min={1} max={365} value={durationDays} onChange={e => setDurationDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                                className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-white/20 text-center tabular-nums transition-colors" />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase tracking-wider block mb-1.5">จำนวน</label>
                            <input type="number" min={1} max={50} value={createCount} onChange={e => setCreateCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                                className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-white/20 text-center tabular-nums transition-colors" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => setConfirmCreate(true)} disabled={creating}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                                {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                สร้าง {createCount > 1 ? `${createCount} Keys` : 'Key'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter & Search */}
                <div className="px-5 py-3 border-b border-white/5 flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ค้นหา Key..."
                            value={searchKey} onChange={e => setSearchKey(e.target.value)}
                            className="w-full bg-black/40 border border-white/10 text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:border-white/20 transition-colors" />
                    </div>
                    <div className="flex items-center gap-1 bg-black/20 rounded-lg p-0.5">
                        {(['all', 'active', 'inactive'] as const).map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-colors ${filterStatus === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                                {s === 'all' ? 'ทั้งหมด' : s === 'active' ? 'พร้อมใช้' : 'ปิดแล้ว'}
                            </button>
                        ))}
                    </div>
                    {selected.size > 0 && (
                        <button onClick={() => setConfirmBulkDelete(true)} disabled={deleting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-500 text-white text-[10px] font-bold rounded-lg disabled:opacity-50 transition-colors">
                            <Trash2 className="w-3 h-3" />
                            ลบ {selected.size} รายการ
                        </button>
                    )}
                </div>

                {/* License list */}
                {filteredLicenses.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{licenses.length === 0 ? 'ยังไม่มี License — สร้างด้านบน' : 'ไม่พบ License ที่ตรงกัน'}</p>
                    </div>
                ) : (
                    <>
                        <div className="px-5 py-2 border-b border-white/5 flex items-center gap-2">
                            <button onClick={toggleSelectAll} className="text-gray-500 hover:text-white transition-colors">
                                {filteredLicenses.every(l => selected.has(l.id)) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                            </button>
                            <span className="text-[10px] text-gray-500">{selected.size > 0 ? `เลือก ${selected.size} รายการ` : `${filteredLicenses.length} รายการ`}</span>
                        </div>
                        <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                            {filteredLicenses.map(l => (
                                <div key={l.id} className={`flex items-center gap-3 px-5 py-3 hover:bg-white/[0.02] transition-colors ${selected.has(l.id) ? 'bg-blue-500/5' : ''}`}>
                                    <button onClick={() => toggleSelect(l.id)} className="text-gray-500 hover:text-white shrink-0">
                                        {selected.has(l.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                                    </button>
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${l.tier === 'PRO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                        {l.tier === 'PRO' ? <Zap className="w-3 h-3" /> : <Gem className="w-3 h-3" />} {l.tier}
                                    </span>
                                    <span className="text-[10px] text-gray-500 shrink-0 tabular-nums">{l.durationDays || 30}d</span>
                                    <code className="text-xs text-gray-300 font-mono bg-black/30 px-2.5 py-1 rounded-md truncate flex-1 min-w-0">{l.key}</code>
                                    <button onClick={() => copyKey(l.key)} className="text-gray-500 hover:text-white transition-colors shrink-0" title="คัดลอก">
                                        <Copy className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-[10px] text-gray-600 shrink-0 hidden sm:inline tabular-nums">
                                        {new Date(l.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                    </span>
                                    <span className={`shrink-0 w-2 h-2 rounded-full ${l.isActive ? 'bg-emerald-400' : 'bg-gray-600'}`} title={l.isActive ? 'Active' : 'Inactive'} />
                                    <button onClick={() => handleToggle(l.id, l.isActive)} className="shrink-0 transition-transform hover:scale-110" title={l.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                                        {l.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmCreate}
                title="ยืนยันสร้าง License"
                description={`สร้าง ${createCount} License Key (${tier} / ${durationDays} วัน) ใช่ไหม?`}
                confirmText={`สร้าง ${createCount} Key`}
                cancelText="ยกเลิก"
                variant="info"
                onConfirm={handleBulkCreate}
                onClose={() => setConfirmCreate(false)}
            />

            <ConfirmModal
                isOpen={confirmBulkDelete}
                title="ลบ License หลายรายการ"
                description={`ต้องการลบ ${selected.size} License ที่เลือกใช่ไหม? การกระทำนี้ย้อนกลับไม่ได้`}
                confirmText={`ลบ ${selected.size} รายการ`}
                cancelText="ยกเลิก"
                variant="danger"
                onConfirm={handleBulkDelete}
                onClose={() => setConfirmBulkDelete(false)}
            />
        </div>
    );
}

// ==================== GANG TABLE + PLAN MANAGEMENT (MERGED) ====================
interface GangData {
    id: string;
    name: string;
    subscriptionTier: string;
    subscriptionExpiresAt: string | null;
    createdAt: string;
    discordGuildId: string;
    logoUrl: string | null;
}

interface GangTableProps {
    gangs: GangData[];
    memberCountMap: Record<string, number>;
}

const ITEMS_PER_PAGE = 20;

const TIER_STYLES: Record<string, string> = {
    FREE: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    TRIAL: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    PRO: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    PREMIUM: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
    FREE: <Crown className="w-3.5 h-3.5 text-gray-400" />,
    TRIAL: <Crown className="w-3.5 h-3.5 text-yellow-400" />,
    PRO: <Zap className="w-3.5 h-3.5 text-blue-400" />,
    PREMIUM: <Gem className="w-3.5 h-3.5 text-purple-400" />,
};

export function GangTable({ gangs: initialGangs, memberCountMap }: GangTableProps) {
    const router = useRouter();
    const [gangs, setGangs] = useState<GangData[]>(initialGangs);
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [confirmAction, setConfirmAction] = useState<{ gangId: string; gangName: string; action: string; data: Record<string, any> } | null>(null);

    // Sync with server props when they change
    useEffect(() => { setGangs(initialGangs); }, [initialGangs]);

    const filtered = useMemo(() => {
        return gangs.filter(g => {
            const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.discordGuildId.includes(search) || g.id.includes(search);
            const matchTier = tierFilter === 'ALL' || g.subscriptionTier === tierFilter;
            return matchSearch && matchTier;
        });
    }, [gangs, search, tierFilter]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const isUpdating = (id: string) => updatingIds.has(id);

    const updateGang = async (gangId: string, data: Record<string, any>) => {
        if (isUpdating(gangId)) return; // Prevent double-click
        setUpdatingIds(prev => new Set(prev).add(gangId));
        try {
            const res = await fetch(`/api/admin/gangs/${gangId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error();
            // Update local state immediately so next action uses fresh data
            setGangs(prev => prev.map(g => {
                if (g.id !== gangId) return g;
                return {
                    ...g,
                    ...(data.subscriptionTier ? { subscriptionTier: data.subscriptionTier } : {}),
                    ...(data.subscriptionExpiresAt !== undefined ? { subscriptionExpiresAt: data.subscriptionExpiresAt } : {}),
                };
            }));
            toast.success('อัปเดตสำเร็จ');
            router.refresh();
        } catch {
            toast.error('อัปเดตไม่สำเร็จ');
        } finally {
            setUpdatingIds(prev => { const n = new Set(prev); n.delete(gangId); return n; });
            setConfirmAction(null);
        }
    };

    const requestUpdate = (gangId: string, gangName: string, action: string, data: Record<string, any>) => {
        if (isUpdating(gangId)) return;
        setConfirmAction({ gangId, gangName, action, data });
    };

    const addDays = (gangId: string, gangName: string, days: number) => {
        if (isUpdating(gangId)) return;
        // Use current local state (not stale props)
        const gang = gangs.find(g => g.id === gangId);
        const currentExpiry = gang?.subscriptionExpiresAt;
        const base = currentExpiry && new Date(currentExpiry) > new Date() ? new Date(currentExpiry) : new Date();
        base.setDate(base.getDate() + days);
        requestUpdate(gangId, gangName, `เพิ่ม ${days} วัน`, { subscriptionExpiresAt: base.toISOString() });
    };

    const formatExpiry = (exp: string | null) => {
        if (!exp) return null;
        const d = new Date(exp);
        const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return {
            date: d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }),
            diff,
            expired: diff <= 0,
            expiringSoon: diff > 0 && diff <= 7,
        };
    };

    const copyId = (id: string) => {
        navigator.clipboard.writeText(id);
        toast.success('คัดลอก ID แล้ว');
    };

    return (
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            {/* Header + Search */}
            <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="font-bold text-lg text-white flex items-center gap-2">
                        <Settings className="w-5 h-5 text-blue-400" />
                        แก๊งทั้งหมด
                        <span className="text-sm font-normal text-gray-500">({filtered.length})</span>
                    </h2>
                    <p className="text-[10px] text-gray-600 mt-0.5">กดแถวเพื่อจัดการแพลนและวันหมดอายุ · ค้นด้วยชื่อ, Guild ID หรือ Gang ID</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ค้นหาชื่อ / Guild ID / Gang ID..."
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="bg-black/40 border border-white/10 text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:border-white/20 w-56" />
                    </div>
                    <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }}
                        className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none">
                        <option value="ALL">ทุกแพลน</option>
                        <option value="FREE">FREE</option>
                        <option value="TRIAL">TRIAL</option>
                        <option value="PRO">PRO</option>
                        <option value="PREMIUM">PREMIUM</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-black/30 text-gray-400 text-[10px] uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-2.5 text-left">แก๊ง</th>
                            <th className="px-4 py-2.5 text-left">ID</th>
                            <th className="px-4 py-2.5 text-center">แพลน</th>
                            <th className="px-4 py-2.5 text-center">หมดอายุ</th>
                            <th className="px-4 py-2.5 text-right">สมาชิก</th>
                            <th className="px-4 py-2.5 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paged.map(g => {
                            const exp = formatExpiry(g.subscriptionExpiresAt);
                            const isExpanded = expandedId === g.id;
                            const busy = isUpdating(g.id);
                            return (
                                <tr key={g.id} className="group">
                                    <td colSpan={6} className="p-0">
                                        <div>
                                            <button onClick={() => setExpandedId(isExpanded ? null : g.id)}
                                                className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-0 hover:bg-white/[0.02] transition-colors text-left">
                                                <div className="px-4 py-2.5 flex items-center gap-2 min-w-0">
                                                    {g.logoUrl ? (
                                                        <img src={g.logoUrl} alt="" className="w-6 h-6 rounded-lg object-cover border border-white/10 shrink-0" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                                                            <Crown className="w-3 h-3 text-gray-600" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-medium text-white truncate">{g.name}</div>
                                                        <div className="text-[9px] text-gray-600 font-mono">{g.discordGuildId}</div>
                                                    </div>
                                                </div>
                                                <div className="px-3 py-2.5">
                                                    <button onClick={e => { e.stopPropagation(); copyId(g.id); }}
                                                        className="text-[8px] font-mono text-gray-600 hover:text-gray-300 px-1.5 py-0.5 rounded bg-black/20 border border-white/5 hover:border-white/10 transition-colors truncate max-w-[80px]"
                                                        title={g.id}>
                                                        {g.id.slice(0, 8)}…
                                                    </button>
                                                </div>
                                                <div className="px-4 py-2.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${TIER_STYLES[g.subscriptionTier] || TIER_STYLES.FREE}`}>
                                                        {TIER_ICONS[g.subscriptionTier]}
                                                        {g.subscriptionTier}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-2.5 text-center text-[10px]">
                                                    {exp ? (
                                                        <span className={exp.expired ? 'text-red-400 font-bold' : exp.expiringSoon ? 'text-yellow-400' : 'text-gray-400'}>
                                                            {exp.expired ? `หมดอายุ (${exp.date})` : `${exp.diff}d (${exp.date})`}
                                                        </span>
                                                    ) : g.subscriptionTier !== 'FREE' ? (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">ถาวร</span>
                                                    ) : <span className="text-gray-600">—</span>}
                                                </div>
                                                <div className="px-4 py-2.5 text-right text-xs text-gray-300 tabular-nums">{memberCountMap[g.id] || 0}</div>
                                                <div className="px-3 py-2.5">
                                                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                                                </div>
                                            </button>

                                            {/* Expanded plan management */}
                                            {isExpanded && (
                                                <div className="px-5 pb-4 pt-3 bg-white/[0.015] border-t border-white/5 space-y-3">
                                                    {/* Current status */}
                                                    <div className="flex items-center gap-4 text-[10px] flex-wrap">
                                                        <span className="text-gray-500">สถานะ:</span>
                                                        {exp ? (
                                                            <span className={exp.expired ? 'text-red-400 font-bold' : exp.expiringSoon ? 'text-yellow-400 font-bold' : 'text-gray-300'}>
                                                                <Calendar className="w-3 h-3 inline mr-1" />
                                                                {exp.expired ? `หมดอายุแล้ว (${exp.date})` : `หมดอายุ ${exp.date} (เหลือ ${exp.diff} วัน)`}
                                                            </span>
                                                        ) : g.subscriptionTier !== 'FREE' ? (
                                                            <span className="text-emerald-400 font-bold">ถาวร (ไม่มีวันหมดอายุ)</span>
                                                        ) : (
                                                            <span className="text-gray-500">Free Plan</span>
                                                        )}
                                                        <span className="text-gray-600 font-mono">ID: {g.id}</span>
                                                    </div>

                                                    {/* Actions grid */}
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">แพลน</label>
                                                            <select value={g.subscriptionTier}
                                                                onChange={e => requestUpdate(g.id, g.name, `เปลี่ยนเป็น ${e.target.value}`, { subscriptionTier: e.target.value })}
                                                                disabled={busy}
                                                                className="bg-black/40 border border-white/10 text-white text-[10px] rounded-lg px-2.5 py-1.5 outline-none disabled:opacity-50">
                                                                <option value="FREE">FREE</option>
                                                                <option value="TRIAL">TRIAL</option>
                                                                <option value="PRO">PRO</option>
                                                                <option value="PREMIUM">PREMIUM</option>
                                                            </select>
                                                        </div>

                                                        <div className="h-5 w-px bg-white/10" />

                                                        <div className="flex items-center gap-1.5">
                                                            <label className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">เพิ่มเวลา</label>
                                                            <button onClick={() => addDays(g.id, g.name, 30)} disabled={busy}
                                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                                                                +30d
                                                            </button>
                                                            <button onClick={() => addDays(g.id, g.name, 90)} disabled={busy}
                                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
                                                                +90d
                                                            </button>
                                                            <button onClick={() => addDays(g.id, g.name, 365)} disabled={busy}
                                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
                                                                +1y
                                                            </button>
                                                        </div>

                                                        <div className="h-5 w-px bg-white/10" />

                                                        <button onClick={() => requestUpdate(g.id, g.name, 'ตั้งเป็นถาวร (ลบวันหมดอายุ)', { subscriptionExpiresAt: null })} disabled={busy}
                                                            className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50">
                                                            ตั้งถาวร
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-gray-600 text-sm">ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/5">
                    <span className="text-[10px] text-gray-500">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} จาก {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            let p: number;
                            if (totalPages <= 5) p = i + 1;
                            else if (page <= 3) p = i + 1;
                            else if (page >= totalPages - 2) p = totalPages - 4 + i;
                            else p = page - 2 + i;
                            return (
                                <button key={p} onClick={() => setPage(p)}
                                    className={`w-7 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center transition-colors ${p === page ? 'bg-blue-500 text-white' : 'text-gray-400 hover:bg-white/5'}`}>
                                    {p}
                                </button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-30 transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={!!confirmAction}
                title="ยืนยันการเปลี่ยนแปลง"
                description={confirmAction ? `${confirmAction.action} สำหรับแก๊ง "${confirmAction.gangName}"` : ''}
                confirmText="ยืนยัน"
                cancelText="ยกเลิก"
                variant="warning"
                loading={confirmAction ? isUpdating(confirmAction.gangId) : false}
                onConfirm={async () => { if (confirmAction) await updateGang(confirmAction.gangId, confirmAction.data); }}
                onClose={() => { if (!confirmAction || !isUpdating(confirmAction.gangId)) setConfirmAction(null); }}
            />
        </div>
    );
}

// ==================== DATA MANAGER (BACKUP / DELETE / REPORTS) ====================
interface ReportData {
    overview: { totalGangs: number; activeGangs: number; totalMembers: number; activeMembers: number; newGangs30d: number; newMembers30d: number };
    attendance: { totalSessions: number; recentSessions7d: number; totalRecords: number };
    finance: { totalTransactions: number; recentTransactions30d: number };
    leaves: { totalLeaveRequests: number };
    audit: { totalLogs: number };
    licenses: { total: number; active: number; used: number };
    tierBreakdown: Record<string, number>;
}

export function DataManager({ gangList }: { gangList: { id: string; name: string }[] }) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [purging, setPurging] = useState<string | null>(null);
    const [confirmPurge, setConfirmPurge] = useState<{ action: string; label: string; description: string; gangId?: string; days?: number } | null>(null);
    const [purgeDays, setPurgeDays] = useState(90);
    const [selectedGangId, setSelectedGangId] = useState('');

    const fetchReport = useCallback(async () => {
        setLoadingReport(true);
        try {
            const res = await fetch('/api/admin/reports');
            if (res.ok) setReport(await res.json());
        } catch { /* ignore */ } finally { setLoadingReport(false); }
    }, []);

    useEffect(() => { fetchReport(); }, [fetchReport]);

    const handleDownload = async () => {
        setDownloading(true);
        try {
            const res = await fetch('/api/admin/backup');
            if (!res.ok) throw new Error();
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            toast.success('ดาวน์โหลด Backup สำเร็จ');
        } catch {
            toast.error('ดาวน์โหลดไม่สำเร็จ');
        } finally { setDownloading(false); }
    };

    const executePurge = async () => {
        if (!confirmPurge) return;
        setPurging(confirmPurge.action);
        setConfirmPurge(null);
        try {
            const res = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: confirmPurge.action,
                    gangId: confirmPurge.gangId,
                    olderThanDays: confirmPurge.days,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            toast.success(`ลบสำเร็จ — ${data.deletedCount} รายการ`);
            fetchReport();
        } catch (e: any) {
            toast.error(e.message || 'เกิดข้อผิดพลาด');
        } finally { setPurging(null); }
    };

    const R = ({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) => (
        <div className="flex items-center gap-3 p-3 bg-black/20 rounded-xl border border-white/5">
            <div className="p-2 bg-white/5 rounded-lg">{icon}</div>
            <div>
                <div className="text-lg font-black text-white tabular-nums">{value.toLocaleString()}{sub && <span className="text-xs text-gray-600 ml-1">{sub}</span>}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</div>
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Reports Section */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-blue-400" />
                            รายงานระบบ
                        </h3>
                        <button onClick={fetchReport} disabled={loadingReport}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50">
                            <RefreshCw className={`w-3 h-3 ${loadingReport ? 'animate-spin' : ''}`} />
                            รีเฟรช
                        </button>
                    </div>
                </div>
                {report ? (
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            <R icon={<Server className="w-4 h-4 text-blue-400" />} label="แก๊ง (Active)" value={report.overview.activeGangs} sub={`/${report.overview.totalGangs}`} />
                            <R icon={<Users className="w-4 h-4 text-green-400" />} label="สมาชิก (Active)" value={report.overview.activeMembers} sub={`/${report.overview.totalMembers}`} />
                            <R icon={<ScrollText className="w-4 h-4 text-purple-400" />} label="ธุรกรรม" value={report.finance.totalTransactions} sub={`(30d: ${report.finance.recentTransactions30d})`} />
                            <R icon={<Clock className="w-4 h-4 text-yellow-400" />} label="เช็คชื่อ" value={report.attendance.totalSessions} sub={`(7d: ${report.attendance.recentSessions7d})`} />
                            <R icon={<Shield className="w-4 h-4 text-red-400" />} label="Audit Logs" value={report.audit.totalLogs} />
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-600">
                        {loadingReport ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <BarChart3 className="w-6 h-6 mx-auto opacity-30" />}
                        <p className="text-xs mt-2">{loadingReport ? 'กำลังโหลดรายงาน...' : 'ไม่สามารถโหลดรายงานได้'}</p>
                    </div>
                )}
            </div>

            {/* Backup */}
            <div className="bg-[#111] border border-emerald-500/10 rounded-2xl p-5">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 rounded-xl shrink-0">
                        <Download className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-bold text-white">ดาวน์โหลด Backup</div>
                        <div className="text-[10px] text-gray-500 mt-0.5">ดาวน์โหลดข้อมูลทั้งระบบเป็นไฟล์ JSON (แก๊ง, สมาชิก, ธุรกรรม, เช็คชื่อ, Audit Logs)</div>
                    </div>
                    <button onClick={handleDownload} disabled={downloading}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0">
                        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {downloading ? 'กำลังโหลด...' : 'ดาวน์โหลด Backup'}
                    </button>
                </div>
            </div>

            {/* Cleanup Actions */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Database className="w-4 h-4 text-yellow-400" />
                        ล้างข้อมูลเก่า
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1">ลบข้อมูลที่ไม่จำเป็นเพื่อลดขนาด Database</p>
                </div>
                <div className="p-5 space-y-3">
                    {/* Shared days input */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-gray-500 font-bold">ข้อมูลเก่ากว่า</span>
                        <input type="number" min={7} max={365} value={purgeDays} onChange={e => setPurgeDays(Math.max(7, Number(e.target.value)))}
                            className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none w-16 text-center tabular-nums" />
                        <span className="text-[10px] text-gray-500">วัน</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button onClick={() => setConfirmPurge({ action: 'purge_audit_logs', label: 'ลบ Audit Logs', description: `ลบ audit logs ที่เก่ากว่า ${purgeDays} วัน`, days: purgeDays })}
                            disabled={!!purging}
                            className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors disabled:opacity-50 text-left">
                            <div className="p-2 bg-yellow-500/10 rounded-lg shrink-0">
                                {purging === 'purge_audit_logs' ? <Loader2 className="w-4 h-4 animate-spin text-yellow-400" /> : <ScrollText className="w-4 h-4 text-yellow-400" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white">Audit Logs</div>
                                <div className="text-[9px] text-gray-500">ลบ logs เก่า</div>
                            </div>
                        </button>
                        <button onClick={() => setConfirmPurge({ action: 'purge_old_attendance', label: 'ลบเช็คชื่อเก่า', description: `ลบ attendance sessions ที่เก่ากว่า ${purgeDays} วัน`, days: purgeDays })}
                            disabled={!!purging}
                            className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors disabled:opacity-50 text-left">
                            <div className="p-2 bg-orange-500/10 rounded-lg shrink-0">
                                {purging === 'purge_old_attendance' ? <Loader2 className="w-4 h-4 animate-spin text-orange-400" /> : <Clock className="w-4 h-4 text-orange-400" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white">เช็คชื่อเก่า</div>
                                <div className="text-[9px] text-gray-500">ลบ sessions + records</div>
                            </div>
                        </button>
                        <button onClick={() => setConfirmPurge({ action: 'purge_inactive_members', label: 'ลบสมาชิก Inactive', description: 'ลบสมาชิกที่ถูก deactivate แล้วทุกแก๊ง — ย้อนกลับไม่ได้!' })}
                            disabled={!!purging}
                            className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl hover:bg-white/[0.04] transition-colors disabled:opacity-50 text-left">
                            <div className="p-2 bg-red-500/10 rounded-lg shrink-0">
                                {purging === 'purge_inactive_members' ? <Loader2 className="w-4 h-4 animate-spin text-red-400" /> : <UserX className="w-4 h-4 text-red-400" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-white">สมาชิก Inactive</div>
                                <div className="text-[9px] text-gray-500">ลบที่ deactivate แล้ว</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-[#111] border border-red-500/20 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-red-500/10 bg-red-500/[0.03]">
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Danger Zone
                    </h3>
                    <p className="text-[10px] text-gray-500 mt-1">การกระทำในส่วนนี้ย้อนกลับไม่ได้ — โปรดระวัง</p>
                </div>
                <div className="p-5">
                    <div className="flex items-center gap-3">
                        <select value={selectedGangId} onChange={e => setSelectedGangId(e.target.value)}
                            className="flex-1 bg-black/40 border border-red-500/20 text-white text-xs rounded-lg px-3 py-2.5 outline-none focus:border-red-500/40 transition-colors">
                            <option value="">— เลือกแก๊งที่ต้องการลบ —</option>
                            {gangList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button onClick={() => {
                            const gang = gangList.find(g => g.id === selectedGangId);
                            if (!gang) return;
                            setConfirmPurge({ action: 'delete_gang_data', label: `ลบแก๊ง "${gang.name}"`, description: `ลบแก๊ง "${gang.name}" และข้อมูลทั้งหมด (สมาชิก, เช็คชื่อ, ธุรกรรม, การเงิน ฯลฯ) — ย้อนกลับไม่ได้!`, gangId: gang.id });
                        }}
                            disabled={!selectedGangId || !!purging}
                            className="px-5 py-2.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0">
                            {purging === 'delete_gang_data' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                            ลบแก๊งถาวร
                        </button>
                    </div>
                </div>
            </div>

            <ConfirmModal
                isOpen={!!confirmPurge}
                onClose={() => setConfirmPurge(null)}
                onConfirm={executePurge}
                title={confirmPurge?.label || ''}
                description={confirmPurge?.description || ''}
                confirmText="ยืนยันลบ"
                cancelText="ยกเลิก"
                variant="danger"
                icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
            />
        </div>
    );
}

// ==================== FEATURE FLAG MANAGER ====================
interface FeatureFlag {
    id: string;
    key: string;
    name: string;
    description: string | null;
    enabled: boolean;
    updatedAt: string;
    updatedBy: string | null;
}

const FEATURE_ICONS: Record<string, React.ReactNode> = {
    finance: <Zap className="w-4 h-4 text-emerald-400" />,
    attendance: <Clock className="w-4 h-4 text-blue-400" />,
    leave: <UserX className="w-4 h-4 text-orange-400" />,
    announcements: <ScrollText className="w-4 h-4 text-purple-400" />,
    export_csv: <Download className="w-4 h-4 text-cyan-400" />,
    monthly_summary: <BarChart3 className="w-4 h-4 text-pink-400" />,
    analytics: <BarChart3 className="w-4 h-4 text-purple-400" />,
};

export function FeatureFlagManager({ initialFlags }: { initialFlags: FeatureFlag[] }) {
    const [flags, setFlags] = useState<FeatureFlag[]>(initialFlags);
    const [toggling, setToggling] = useState<string | null>(null);
    const [confirmToggle, setConfirmToggle] = useState<{ key: string; name: string; currentEnabled: boolean } | null>(null);

    const enabledCount = flags.filter(f => f.enabled).length;
    const disabledCount = flags.filter(f => !f.enabled).length;

    const handleToggle = async () => {
        if (!confirmToggle) return;
        const { key, currentEnabled } = confirmToggle;
        setToggling(key);
        setConfirmToggle(null);

        try {
            const res = await fetch('/api/admin/feature-flags', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key, enabled: !currentEnabled }),
            });
            if (!res.ok) throw new Error();
            setFlags(prev => prev.map(f => f.key === key ? { ...f, enabled: !currentEnabled, updatedAt: new Date().toISOString() } : f));
            toast.success(`${!currentEnabled ? 'เปิด' : 'ปิด'}ใช้งาน "${confirmToggle.name}" แล้ว`);
        } catch {
            toast.error('อัปเดตไม่สำเร็จ');
        } finally {
            setToggling(null);
        }
    };

    return (
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Power className="w-5 h-5 text-orange-400" />
                        Feature Flags
                    </h2>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20">
                        <Wrench className="w-3 h-3 text-orange-400" />
                        <span className="text-[10px] font-bold text-orange-400">Kill-Switch</span>
                    </div>
                </div>
                <p className="text-[10px] text-gray-500 leading-relaxed mb-3">
                    เปิด/ปิดฟีเจอร์ทั้งระบบ — ใช้เมื่อกำลัง DEV หรือมีปัญหา ปิดแล้วผู้ใช้ทุกคนจะเข้าถึงฟีเจอร์นั้นไม่ได้ทันที
                </p>
                <div className="flex items-center gap-4 text-xs">
                    <span className="text-green-400/70">เปิดอยู่ <strong className="text-green-400">{enabledCount}</strong></span>
                    <span className="text-red-400/70">ปิดอยู่ <strong className="text-red-400">{disabledCount}</strong></span>
                </div>
            </div>

            <div className="divide-y divide-white/5">
                {flags.map(flag => (
                    <div
                        key={flag.key}
                        className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                            flag.enabled ? 'hover:bg-white/[0.02]' : 'bg-red-500/[0.03] hover:bg-red-500/[0.05]'
                        }`}
                    >
                        <div className={`p-2 rounded-xl ${flag.enabled ? 'bg-white/5' : 'bg-red-500/10'}`}>
                            {FEATURE_ICONS[flag.key] || <Settings className="w-4 h-4 text-gray-400" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{flag.name}</span>
                                <code className="text-[9px] text-gray-600 bg-black/30 px-1.5 py-0.5 rounded font-mono">{flag.key}</code>
                                {!flag.enabled && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                        DISABLED
                                    </span>
                                )}
                            </div>
                            {flag.description && (
                                <p className="text-[10px] text-gray-500 mt-0.5 truncate">{flag.description}</p>
                            )}
                            {flag.updatedAt && (
                                <p className="text-[9px] text-gray-700 mt-0.5">
                                    อัปเดต: {new Date(flag.updatedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            )}
                        </div>
                        <button
                            onClick={() => setConfirmToggle({ key: flag.key, name: flag.name, currentEnabled: flag.enabled })}
                            disabled={toggling === flag.key}
                            className="shrink-0 transition-transform hover:scale-110 disabled:opacity-50"
                            title={flag.enabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                        >
                            {toggling === flag.key ? (
                                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                            ) : flag.enabled ? (
                                <ToggleRight className="w-7 h-7 text-green-400" />
                            ) : (
                                <ToggleLeft className="w-7 h-7 text-red-400" />
                            )}
                        </button>
                    </div>
                ))}
                {flags.length === 0 && (
                    <div className="p-12 text-center text-gray-500">
                        <Power className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">ไม่พบ Feature Flags — ระบบจะสร้างอัตโนมัติเมื่อเริ่มต้น</p>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!confirmToggle}
                title={confirmToggle?.currentEnabled ? '⚠️ ปิดฟีเจอร์' : '✅ เปิดฟีเจอร์'}
                description={
                    confirmToggle?.currentEnabled
                        ? `ต้องการปิดฟีเจอร์ "${confirmToggle?.name}" ใช่ไหม? ผู้ใช้ทุกคนจะเข้าถึงฟีเจอร์นี้ไม่ได้จนกว่าจะเปิดอีกครั้ง`
                        : `ต้องการเปิดฟีเจอร์ "${confirmToggle?.name}" ให้ผู้ใช้ใช้งานได้ใช่ไหม?`
                }
                confirmText={confirmToggle?.currentEnabled ? 'ปิดฟีเจอร์' : 'เปิดฟีเจอร์'}
                cancelText="ยกเลิก"
                variant={confirmToggle?.currentEnabled ? 'danger' : 'info'}
                onConfirm={handleToggle}
                onClose={() => setConfirmToggle(null)}
            />
        </div>
    );
}
