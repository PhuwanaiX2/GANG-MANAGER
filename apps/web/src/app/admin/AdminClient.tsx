'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
    Key, Plus, Trash2, ToggleLeft, ToggleRight, RefreshCw, Copy,
    Crown, Zap, Gem, ChevronDown, ChevronUp, Search, Info,
    Calendar, ChevronLeft, ChevronRight, Settings, CheckSquare, Square
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
    const [showTip, setShowTip] = useState(false);
    const [durationDays, setDurationDays] = useState(30);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmCreate, setConfirmCreate] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    const activeCount = licenses.filter(l => l.isActive).length;
    const inactiveCount = licenses.filter(l => !l.isActive).length;

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
        if (selected.size === licenses.length) setSelected(new Set());
        else setSelected(new Set(licenses.map(l => l.id)));
    };

    return (
        <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-5 border-b border-white/5">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Key className="w-5 h-5 text-yellow-400" />
                        จัดการ License
                    </h2>
                    <button onClick={() => setShowTip(!showTip)} className="text-gray-500 hover:text-white transition-colors">
                        <Info className="w-4 h-4" />
                    </button>
                </div>
                {showTip && (
                    <div className="bg-yellow-500/5 border border-yellow-500/10 rounded-xl p-3 mb-3 text-xs text-yellow-400/80 leading-relaxed">
                        <strong>วิธีใช้:</strong> สร้าง License Key แล้วส่งให้ผู้ใช้ไปกรอกในหน้าตั้งค่าแก๊ง
                        เพื่อเปิดใช้งานแพลน Key ใช้ได้ 1 ครั้งต่อ 1 แก๊ง ปิดใช้งานได้หากยังไม่ถูกใช้
                    </div>
                )}
                <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-500">ทั้งหมด <strong className="text-white">{licenses.length}</strong></span>
                    <span className="text-green-400/70">พร้อมใช้ <strong className="text-green-400">{activeCount}</strong></span>
                    <span className="text-gray-600">ปิดแล้ว <strong className="text-gray-400">{inactiveCount}</strong></span>
                </div>
            </div>

            {/* Create controls */}
            <div className="p-4 border-b border-white/5 flex items-center gap-2 flex-wrap">
                <select value={tier} onChange={e => setTier(e.target.value as 'PRO' | 'PREMIUM')}
                    className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none">
                    <option value="PRO">PRO</option>
                    <option value="PREMIUM">PREMIUM</option>
                </select>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">อายุ</span>
                    <input type="number" min={1} max={365} value={durationDays} onChange={e => setDurationDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                        className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-2 py-2 outline-none w-14 text-center tabular-nums" />
                    <span className="text-[10px] text-gray-500">วัน</span>
                </div>
                <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-500">จำนวน</span>
                    <input type="number" min={1} max={50} value={createCount} onChange={e => setCreateCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                        className="bg-black/40 border border-white/10 text-white text-xs rounded-lg px-2 py-2 outline-none w-14 text-center tabular-nums" />
                </div>
                <button onClick={() => setConfirmCreate(true)} disabled={creating}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors">
                    {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    สร้าง {createCount > 1 ? `${createCount} Keys` : 'License'}
                </button>
                {selected.size > 0 && (
                    <button onClick={() => setConfirmBulkDelete(true)} disabled={deleting}
                        className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-colors ml-auto">
                        <Trash2 className="w-3.5 h-3.5" />
                        ลบ {selected.size} รายการ
                    </button>
                )}
            </div>

            {/* License list */}
            {licenses.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                    <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">ยังไม่มี License — กดปุ่มด้านบนเพื่อสร้าง</p>
                </div>
            ) : (
                <>
                    <div className="px-5 py-2 border-b border-white/5 flex items-center gap-2">
                        <button onClick={toggleSelectAll} className="text-gray-500 hover:text-white transition-colors">
                            {selected.size === licenses.length ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                        </button>
                        <span className="text-[10px] text-gray-500">{selected.size > 0 ? `เลือก ${selected.size} รายการ` : 'เลือกทั้งหมด'}</span>
                    </div>
                    <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
                        {licenses.map(l => (
                            <div key={l.id} className={`flex items-center gap-3 px-5 py-2.5 hover:bg-white/[0.02] transition-colors ${selected.has(l.id) ? 'bg-blue-500/5' : ''}`}>
                                <button onClick={() => toggleSelect(l.id)} className="text-gray-500 hover:text-white shrink-0">
                                    {selected.has(l.id) ? <CheckSquare className="w-4 h-4 text-blue-400" /> : <Square className="w-4 h-4" />}
                                </button>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${l.tier === 'PRO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'}`}>
                                    {l.tier === 'PRO' ? <Zap className="w-3 h-3" /> : <Gem className="w-3 h-3" />} {l.tier}
                                </span>
                                <span className="text-[10px] text-gray-500 shrink-0">{l.durationDays || 30}วัน</span>
                                <code className="text-xs text-gray-300 font-mono bg-black/30 px-2 py-1 rounded truncate flex-1 min-w-0">{l.key}</code>
                                <button onClick={() => copyKey(l.key)} className="text-gray-500 hover:text-white transition-colors shrink-0" title="คัดลอก">
                                    <Copy className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] text-gray-600 shrink-0 hidden sm:inline">
                                    {new Date(l.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                </span>
                                <button onClick={() => handleToggle(l.id, l.isActive)} className="shrink-0" title={l.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                                    {l.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5 text-gray-500" />}
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Confirm Create */}
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

            {/* Confirm Bulk Delete */}
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
interface GangTableProps {
    gangs: {
        id: string;
        name: string;
        subscriptionTier: string;
        subscriptionExpiresAt: string | null;
        createdAt: string;
        discordGuildId: string;
        logoUrl: string | null;
    }[];
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

export function GangTable({ gangs, memberCountMap }: GangTableProps) {
    const router = useRouter();
    const [search, setSearch] = useState('');
    const [tierFilter, setTierFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updating, setUpdating] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<{ gangId: string; gangName: string; action: string; data: Record<string, any> } | null>(null);

    const filtered = useMemo(() => {
        return gangs.filter(g => {
            const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.discordGuildId.includes(search);
            const matchTier = tierFilter === 'ALL' || g.subscriptionTier === tierFilter;
            return matchSearch && matchTier;
        });
    }, [gangs, search, tierFilter]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const updateGang = async (gangId: string, data: Record<string, any>) => {
        setUpdating(gangId);
        try {
            const res = await fetch(`/api/admin/gangs/${gangId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error();
            toast.success('อัปเดตสำเร็จ');
            router.refresh();
        } catch {
            toast.error('อัปเดตไม่สำเร็จ');
        } finally {
            setUpdating(null);
            setConfirmAction(null);
        }
    };

    const requestUpdate = (gangId: string, gangName: string, action: string, data: Record<string, any>) => {
        setConfirmAction({ gangId, gangName, action, data });
    };

    const addDays = (gangId: string, gangName: string, days: number, currentExpiry: string | null) => {
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
                    <p className="text-[10px] text-gray-600 mt-0.5">กดแถวเพื่อจัดการแพลนและวันหมดอายุ</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ค้นหาชื่อ / Guild ID..."
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="bg-black/40 border border-white/10 text-white text-xs rounded-lg pl-8 pr-3 py-2 outline-none focus:border-white/20 w-48" />
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
                            <th className="px-4 py-2.5 text-center">แพลน</th>
                            <th className="px-4 py-2.5 text-center">หมดอายุ</th>
                            <th className="px-4 py-2.5 text-right">สมาชิก</th>
                            <th className="px-4 py-2.5 text-right">สร้าง</th>
                            <th className="px-4 py-2.5 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paged.map(g => {
                            const exp = formatExpiry(g.subscriptionExpiresAt);
                            const isExpanded = expandedId === g.id;
                            return (
                                <tr key={g.id} className="group">
                                    {/* Main row as single clickable tr */}
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
                                                <div className="px-4 py-2.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${TIER_STYLES[g.subscriptionTier] || TIER_STYLES.FREE}`}>
                                                        {TIER_ICONS[g.subscriptionTier]}
                                                        {g.subscriptionTier}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-2.5 text-center text-[10px]">
                                                    {exp ? (
                                                        <span className={exp.expired ? 'text-red-400' : exp.expiringSoon ? 'text-yellow-400' : 'text-gray-400'}>
                                                            {exp.expired ? 'หมดอายุ' : `${exp.diff}d`}
                                                        </span>
                                                    ) : <span className="text-gray-600">—</span>}
                                                </div>
                                                <div className="px-4 py-2.5 text-right text-xs text-gray-300 tabular-nums">{memberCountMap[g.id] || 0}</div>
                                                <div className="px-4 py-2.5 text-right text-[10px] text-gray-500">
                                                    {new Date(g.createdAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                                                </div>
                                                <div className="px-3 py-2.5">
                                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                                                </div>
                                            </button>

                                            {/* Expanded plan management */}
                                            {isExpanded && (
                                                <div className="px-4 pb-3 pt-1 bg-white/[0.01] border-t border-white/5">
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-500">แพลน</span>
                                                            <select defaultValue={g.subscriptionTier}
                                                                onChange={e => requestUpdate(g.id, g.name, `เปลี่ยนเป็น ${e.target.value}`, { subscriptionTier: e.target.value })}
                                                                disabled={updating === g.id}
                                                                className="bg-black/40 border border-white/10 text-white text-[10px] rounded-lg px-2 py-1 outline-none disabled:opacity-50">
                                                                <option value="FREE">FREE</option>
                                                                <option value="TRIAL">TRIAL</option>
                                                                <option value="PRO">PRO</option>
                                                                <option value="PREMIUM">PREMIUM</option>
                                                            </select>
                                                        </div>
                                                        <div className="h-4 w-px bg-white/10" />
                                                        <button onClick={() => addDays(g.id, g.name, 30, g.subscriptionExpiresAt)} disabled={updating === g.id}
                                                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50">
                                                            +30d
                                                        </button>
                                                        <button onClick={() => addDays(g.id, g.name, 365, g.subscriptionExpiresAt)} disabled={updating === g.id}
                                                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-colors disabled:opacity-50">
                                                            +1y
                                                        </button>
                                                        <button onClick={() => requestUpdate(g.id, g.name, 'ลบวันหมดอายุ', { subscriptionExpiresAt: null })} disabled={updating === g.id}
                                                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                                                            ลบ Expiry
                                                        </button>
                                                        {exp && (
                                                            <>
                                                                <div className="h-4 w-px bg-white/10" />
                                                                <span className={`text-[10px] ${exp.expired ? 'text-red-400' : 'text-gray-400'}`}>
                                                                    <Calendar className="w-3 h-3 inline mr-0.5" />
                                                                    {exp.expired ? `หมดอายุ ${exp.date}` : `${exp.date} (${exp.diff}d)`}
                                                                </span>
                                                            </>
                                                        )}
                                                        {updating === g.id && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
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
                onConfirm={() => { if (confirmAction) updateGang(confirmAction.gangId, confirmAction.data); }}
                onClose={() => setConfirmAction(null)}
            />
        </div>
    );
}
