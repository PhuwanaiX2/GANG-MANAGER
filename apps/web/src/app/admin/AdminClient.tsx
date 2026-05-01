'use client';

import { useState, useMemo, useEffect, useCallback, type ChangeEvent } from 'react';
import Link from 'next/link';
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
import { getSubscriptionTierLabel, normalizeSubscriptionTierValue } from '@/lib/subscriptionTier';

interface License {
    id: string;
    key: string;
    tier: 'PREMIUM';
    durationDays: number;
    isActive: boolean;
    maxMembers: number;
    expiresAt: string | null;
    createdAt: string;
}

// ==================== LICENSE MANAGEMENT ====================
export function LicenseManager({ initialLicenses, initialSearch = '', initialStatusFilter = 'all' }: { initialLicenses: License[]; initialSearch?: string; initialStatusFilter?: 'all' | 'active' | 'inactive' }) {
    const router = useRouter();
    const [licenses, setLicenses] = useState(initialLicenses);
    const [creating, setCreating] = useState(false);
    const [tier, setTier] = useState<'PREMIUM'>('PREMIUM');
    const [createCount, setCreateCount] = useState(1);
    const [deleting, setDeleting] = useState(false);
    const [durationDays, setDurationDays] = useState(30);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [confirmCreate, setConfirmCreate] = useState(false);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>(initialStatusFilter);
    const [searchKey, setSearchKey] = useState(initialSearch);

    useEffect(() => {
        setLicenses(initialLicenses);
    }, [initialLicenses]);

    useEffect(() => {
        setSearchKey(initialSearch);
        setFilterStatus(initialStatusFilter);
        setSelected(new Set());
    }, [initialSearch, initialStatusFilter]);

    const activeCount = licenses.filter(l => l.isActive).length;
    const inactiveCount = licenses.filter(l => !l.isActive).length;

    const filteredLicenses = useMemo(() => {
        return licenses.filter(l => {
            if (filterStatus === 'active' && !l.isActive) return false;
            if (filterStatus === 'inactive' && l.isActive) return false;
            if (searchKey) {
                const q = searchKey.toLowerCase();
                if (!l.key.toLowerCase().includes(q) && !l.id.toLowerCase().includes(q)) return false;
            }
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
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 shadow-token-sm">
                    <div className="text-2xl font-black text-fg-primary tabular-nums">{licenses.length}</div>
                    <div className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider mt-1">ทั้งหมด</div>
                </div>
                <div className="bg-bg-subtle border border-status-success rounded-token-xl p-4 shadow-token-sm">
                    <div className="text-2xl font-black text-fg-success tabular-nums">{activeCount}</div>
                    <div className="text-[10px] text-fg-success font-bold uppercase tracking-wider mt-1">พร้อมใช้</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-4 shadow-token-sm">
                    <div className="text-2xl font-black text-fg-tertiary tabular-nums">{inactiveCount}</div>
                    <div className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider mt-1">ใช้แล้ว/ปิด</div>
                </div>
            </div>

            {/* Create Form */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle">
                    <h3 className="text-sm font-bold text-fg-primary mb-4">สร้าง License Key</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div>
                            <label className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider block mb-1.5">แพลน</label>
                            <select value={tier} onChange={e => setTier(e.target.value as 'PREMIUM')}
                                className="w-full bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2.5 outline-none focus:border-border transition-colors">
                                <option value="PREMIUM">Premium</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider block mb-1.5">อายุ (วัน)</label>
                            <input type="number" min={1} max={365} value={durationDays} onChange={e => setDurationDays(Math.max(1, Math.min(365, Number(e.target.value))))}
                                className="w-full bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2.5 outline-none focus:border-border text-center tabular-nums transition-colors" />
                        </div>
                        <div>
                            <label className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider block mb-1.5">จำนวน</label>
                            <input type="number" min={1} max={50} value={createCount} onChange={e => setCreateCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                                className="w-full bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2.5 outline-none focus:border-border text-center tabular-nums transition-colors" />
                        </div>
                        <div className="flex items-end">
                            <button onClick={() => setConfirmCreate(true)} disabled={creating}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 bg-status-success hover:brightness-110 text-fg-inverse text-xs font-bold rounded-token-lg disabled:opacity-50 transition-colors">
                                {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                สร้าง {createCount > 1 ? `${createCount} Keys` : 'Key'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter & Search */}
                <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-fg-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ค้นหา Key หรือ ID..."
                            value={searchKey} onChange={e => setSearchKey(e.target.value)}
                            className="w-full bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg pl-8 pr-3 py-2 outline-none focus:border-border transition-colors" />
                    </div>
                    <div className="flex items-center gap-1 bg-bg-muted rounded-token-lg p-0.5">
                        {(['all', 'active', 'inactive'] as const).map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                                className={`px-3 py-1.5 rounded-token-md text-[10px] font-bold transition-colors ${filterStatus === s ? 'bg-bg-subtle text-fg-primary shadow-token-xs' : 'text-fg-tertiary hover:text-fg-secondary'}`}>
                                {s === 'all' ? 'ทั้งหมด' : s === 'active' ? 'พร้อมใช้' : 'ปิดแล้ว'}
                            </button>
                        ))}
                    </div>
                    {selected.size > 0 && (
                        <button onClick={() => setConfirmBulkDelete(true)} disabled={deleting}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-status-danger-subtle border border-status-danger text-fg-danger hover:brightness-110 text-[10px] font-bold rounded-token-lg disabled:opacity-50 transition-colors">
                            <Trash2 className="w-3 h-3" />
                            ลบ {selected.size} รายการ
                        </button>
                    )}
                </div>

                {/* License list */}
                {filteredLicenses.length === 0 ? (
                    <div className="p-12 text-center text-fg-tertiary">
                        <Key className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">{licenses.length === 0 ? 'ยังไม่มี License — สร้างด้านบน' : 'ไม่พบ License ที่ตรงกัน'}</p>
                    </div>
                ) : (
                    <>
                        <div className="px-5 py-2 border-b border-border-subtle flex items-center gap-2">
                            <button onClick={toggleSelectAll} className="text-fg-tertiary hover:text-fg-primary transition-colors">
                                {filteredLicenses.every(l => selected.has(l.id)) ? <CheckSquare className="w-4 h-4 text-fg-info" /> : <Square className="w-4 h-4" />}
                            </button>
                            <span className="text-[10px] text-fg-tertiary">{selected.size > 0 ? `เลือก ${selected.size} รายการ` : `${filteredLicenses.length} รายการ`}</span>
                        </div>
                        <div className="grid max-h-[460px] gap-3 overflow-auto p-4 md:hidden">
                            {filteredLicenses.map(l => (
                                <div key={l.id} className={`rounded-token-xl border p-4 shadow-token-sm ${selected.has(l.id) ? 'border-status-info bg-status-info-subtle' : 'border-border-subtle bg-bg-muted/70'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 rounded-token-full ${l.isActive ? 'bg-status-success' : 'bg-fg-tertiary'}`} />
                                                <span className="inline-flex items-center gap-1 rounded-token-md border border-border-accent bg-accent-subtle px-2 py-0.5 text-[10px] font-bold text-accent-bright">
                                                    <Gem className="h-3 w-3" /> {getSubscriptionTierLabel(l.tier)}
                                                </span>
                                            </div>
                                            <code className="mt-3 block truncate rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-mono text-fg-secondary">
                                                {l.key}
                                            </code>
                                        </div>
                                        <button onClick={() => toggleSelect(l.id)} className="shrink-0 text-fg-tertiary hover:text-fg-primary">
                                            {selected.has(l.id) ? <CheckSquare className="h-5 w-5 text-fg-info" /> : <Square className="h-5 w-5" />}
                                        </button>
                                    </div>
                                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                        <div className="rounded-token-lg bg-bg-subtle px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Duration</p>
                                            <p className="mt-1 font-black text-fg-primary tabular-nums">{l.durationDays || 30}d</p>
                                        </div>
                                        <div className="rounded-token-lg bg-bg-subtle px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Created</p>
                                            <p className="mt-1 font-black text-fg-primary tabular-nums">
                                                {new Date(l.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-3 flex items-center gap-2">
                                        <button
                                            onClick={() => copyKey(l.key)}
                                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-bold text-fg-secondary hover:text-fg-primary"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            Copy
                                        </button>
                                        <Link
                                            href={`/admin/logs?category=LICENSE&search=${encodeURIComponent(l.key)}`}
                                            className="inline-flex flex-1 items-center justify-center rounded-token-lg border border-status-warning bg-status-warning-subtle px-3 py-2 text-xs font-bold text-fg-warning"
                                        >
                                            LOGS
                                        </Link>
                                        <button
                                            onClick={() => handleToggle(l.id, l.isActive)}
                                            className="inline-flex items-center justify-center rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2"
                                            title={l.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                                        >
                                            {l.isActive ? <ToggleRight className="h-5 w-5 text-fg-success" /> : <ToggleLeft className="h-5 w-5 text-fg-tertiary" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden max-h-[400px] overflow-auto md:block">
                            <table className="min-w-[840px] w-full text-left">
                                <thead className="sticky top-0 z-10 bg-bg-muted border-b border-border-subtle">
                                    <tr>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary w-10"></th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">License</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Plan</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Duration</th>
                                        <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Created</th>
                                        <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle">
                                    {filteredLicenses.map(l => (
                                        <tr key={l.id} className={`hover:bg-bg-muted transition-colors ${selected.has(l.id) ? 'bg-status-info-subtle' : ''}`}>
                                            <td className="px-5 py-3">
                                                <button onClick={() => toggleSelect(l.id)} className="text-fg-tertiary hover:text-fg-primary shrink-0">
                                                    {selected.has(l.id) ? <CheckSquare className="w-4 h-4 text-fg-info" /> : <Square className="w-4 h-4" />}
                                                </button>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`shrink-0 w-2 h-2 rounded-token-full ${l.isActive ? 'bg-status-success' : 'bg-bg-muted'}`} title={l.isActive ? 'Active' : 'Inactive'} />
                                                    <code className="text-xs text-fg-secondary font-mono bg-bg-muted px-2.5 py-1 rounded-token-md truncate min-w-0">{l.key}</code>
                                                    <button onClick={() => copyKey(l.key)} className="text-fg-tertiary hover:text-fg-primary transition-colors shrink-0" title="คัดลอก">
                                                        <Copy className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-token-md text-[10px] font-bold border shrink-0 bg-accent-subtle text-accent-bright border-border-accent`}>
                                                    <Gem className="w-3 h-3" /> {getSubscriptionTierLabel(l.tier)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-right text-[10px] text-fg-tertiary tabular-nums">{l.durationDays || 30}d</td>
                                            <td className="px-4 py-3 text-right text-[10px] text-fg-tertiary tabular-nums">
                                                {new Date(l.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok',  day: 'numeric', month: 'short' })}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="inline-flex items-center gap-3">
                                                    <Link
                                                        href={`/admin/logs?category=LICENSE&search=${encodeURIComponent(l.key)}`}
                                                        className="text-[10px] font-bold text-fg-warning hover:text-fg-primary"
                                                        title="ดู log ของคีย์นี้"
                                                    >
                                                        LOGS
                                                    </Link>
                                                    <button onClick={() => handleToggle(l.id, l.isActive)} className="transition-transform hover:scale-110" title={l.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}>
                                                        {l.isActive ? <ToggleRight className="w-5 h-5 text-fg-success" /> : <ToggleLeft className="w-5 h-5 text-fg-tertiary" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            <ConfirmModal
                isOpen={confirmCreate}
                title="ยืนยันสร้าง License"
                description={`สร้าง ${createCount} License Key (${getSubscriptionTierLabel(tier)} / ${durationDays} วัน) ใช่ไหม?`}
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
    isActive: boolean;
}

interface GangTableProps {
    gangs: GangData[];
    memberCountMap: Record<string, number>;
    initialSearch?: string;
    initialTierFilter?: string;
    initialStatusFilter?: string;
    initialAttentionFilter?: string;
}

const ITEMS_PER_PAGE = 20;
const ADMIN_TRIAL_DAYS = 7;

const TIER_STYLES: Record<string, string> = {
    FREE: 'bg-bg-muted text-fg-tertiary border-border-subtle',
    TRIAL: 'bg-accent-subtle text-accent-bright border-border-accent',
    PREMIUM: 'bg-accent-subtle text-accent-bright border-border-accent',
};

const TIER_ICONS: Record<string, React.ReactNode> = {
    FREE: <Crown className="w-3.5 h-3.5 text-fg-tertiary" />,
    TRIAL: <Zap className="w-3.5 h-3.5 text-accent-bright" />,
    PREMIUM: <Gem className="w-3.5 h-3.5 text-accent-bright" />,
};

const getTierLabel = (tier: string | null | undefined) => getSubscriptionTierLabel(tier);
const getTierStyle = (tier: string | null | undefined) => TIER_STYLES[normalizeSubscriptionTierValue(tier)] || TIER_STYLES.FREE;
const getTierIcon = (tier: string | null | undefined) => TIER_ICONS[normalizeSubscriptionTierValue(tier)] || TIER_ICONS.FREE;

export function GangTable({ gangs: initialGangs, memberCountMap, initialSearch = '', initialTierFilter = 'ALL', initialStatusFilter = 'ALL', initialAttentionFilter = 'ALL' }: GangTableProps) {
    const router = useRouter();
    const [gangs, setGangs] = useState<GangData[]>(initialGangs);
    const [search, setSearch] = useState(initialSearch);
    const [tierFilter, setTierFilter] = useState<string>(initialTierFilter);
    const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
    const [attentionFilter, setAttentionFilter] = useState<string>(initialAttentionFilter);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
    const [confirmAction, setConfirmAction] = useState<{ gangId: string; gangName: string; action: string; data: Record<string, any> } | null>(null);

    // Sync with server props when they change
    useEffect(() => { setGangs(initialGangs); }, [initialGangs]);
    useEffect(() => {
        setSearch(initialSearch);
        setTierFilter(initialTierFilter);
        setStatusFilter(initialStatusFilter);
        setAttentionFilter(initialAttentionFilter);
        setPage(1);
    }, [initialSearch, initialTierFilter, initialStatusFilter, initialAttentionFilter]);

    const filtered = useMemo(() => {
        const now = Date.now();
        return gangs.filter(g => {
            const matchSearch = !search || g.name.toLowerCase().includes(search.toLowerCase()) || g.discordGuildId.includes(search) || g.id.includes(search);
            const matchTier = tierFilter === 'ALL' || g.subscriptionTier === tierFilter;
            const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? g.isActive : !g.isActive);
            const expiryTime = g.subscriptionExpiresAt ? new Date(g.subscriptionExpiresAt).getTime() : null;
            const diffDays = expiryTime === null ? null : Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));
            const matchAttention = attentionFilter === 'ALL'
                || (attentionFilter === 'TRIAL' && g.subscriptionTier === 'TRIAL')
                || (attentionFilter === 'EXPIRING' && diffDays !== null && diffDays > 0 && diffDays <= 7)
                || (attentionFilter === 'EXPIRED' && diffDays !== null && diffDays <= 0);
            return matchSearch && matchTier && matchStatus && matchAttention;
        });
    }, [gangs, search, tierFilter, statusFilter, attentionFilter]);

    const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE);
    const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);
    const filteredTrialCount = filtered.filter(g => g.subscriptionTier === 'TRIAL').length;
    const filteredInactiveCount = filtered.filter(g => !g.isActive).length;
    const filteredExpiredCount = filtered.filter(g => {
        if (!g.subscriptionExpiresAt) return false;
        return new Date(g.subscriptionExpiresAt).getTime() <= Date.now();
    }).length;
    const filteredExpiringSoonCount = filtered.filter(g => {
        if (!g.subscriptionExpiresAt) return false;
        const diff = Math.ceil((new Date(g.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return diff > 0 && diff <= 7;
    }).length;

    const isUpdating = (id: string) => updatingIds.has(id);

    const getDefaultTrialExpiryIso = () => {
        const next = new Date();
        next.setDate(next.getDate() + ADMIN_TRIAL_DAYS);
        return next.toISOString();
    };

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
        requestUpdate(gangId, gangName, `เปิด Premium ${days} วัน`, {
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: base.toISOString(),
        });
    };

    const grantPermanentPremium = (gangId: string, gangName: string) => {
        if (isUpdating(gangId)) return;
        requestUpdate(gangId, gangName, 'เปิด Premium ถาวร', {
            subscriptionTier: 'PREMIUM',
            subscriptionExpiresAt: null,
        });
    };

    const startTrial = (gangId: string, gangName: string) => {
        if (isUpdating(gangId)) return;
        requestUpdate(gangId, gangName, `เริ่ม Trial ${ADMIN_TRIAL_DAYS} วัน`, {
            subscriptionTier: 'TRIAL',
            subscriptionExpiresAt: getDefaultTrialExpiryIso(),
        });
    };

    const downgradeToFree = (gangId: string, gangName: string) => {
        if (isUpdating(gangId)) return;
        requestUpdate(gangId, gangName, 'ลดเป็น Free และล้างวันหมดอายุ', {
            subscriptionTier: 'FREE',
            subscriptionExpiresAt: null,
        });
    };

    const formatExpiry = (exp: string | null) => {
        if (!exp) return null;
        const d = new Date(exp);
        const diff = Math.ceil((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return {
            date: d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' }),
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
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
            {/* Header + Search */}
            <div className="p-5 border-b border-border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h2 className="font-bold text-lg text-fg-primary flex items-center gap-2">
                        <Settings className="w-5 h-5 text-fg-info" />
                        แก๊งทั้งหมด
                        <span className="text-sm font-normal text-fg-tertiary">({filtered.length})</span>
                    </h2>
                    <p className="text-[10px] text-fg-tertiary mt-0.5">กดแถวเพื่อจัดการแพลนและวันหมดอายุ · ค้นด้วยชื่อ, Guild ID หรือ Gang ID</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="inline-flex items-center gap-1 rounded-token-full border border-border-accent bg-accent-subtle px-2 py-0.5 font-bold text-accent-bright">
                            Trial {filteredTrialCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-token-full border border-status-warning bg-status-warning-subtle px-2 py-0.5 font-bold text-fg-warning">
                            ใกล้หมด {filteredExpiringSoonCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-token-full border border-status-danger bg-status-danger-subtle px-2 py-0.5 font-bold text-fg-danger">
                            หมดอายุ {filteredExpiredCount}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-token-full border border-border-subtle bg-bg-muted px-2 py-0.5 font-bold text-fg-secondary">
                            Inactive {filteredInactiveCount}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                        <Search className="w-3.5 h-3.5 text-fg-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                        <input type="text" placeholder="ค้นหาชื่อ / Guild ID / Gang ID..."
                            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg pl-8 pr-3 py-2 outline-none focus:border-border w-56" />
                    </div>
                    <select value={tierFilter} onChange={e => { setTierFilter(e.target.value); setPage(1); }}
                        className="bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2 outline-none focus:border-border">
                        <option value="ALL">ทุกแพลน</option>
                        <option value="FREE">Free</option>
                        <option value="TRIAL">Trial</option>
                        <option value="PREMIUM">Premium</option>
                    </select>
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                        className="bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2 outline-none focus:border-border">
                        <option value="ALL">ทุกสถานะ</option>
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                    </select>
                    <select value={attentionFilter} onChange={e => { setAttentionFilter(e.target.value); setPage(1); }}
                        className="bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-3 py-2 outline-none focus:border-border">
                        <option value="ALL">ทุกเคส</option>
                        <option value="TRIAL">Trial</option>
                        <option value="EXPIRING">ใกล้หมดอายุ</option>
                        <option value="EXPIRED">หมดอายุแล้ว</option>
                    </select>
                </div>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 p-4 md:hidden">
                {paged.map(g => {
                    const exp = formatExpiry(g.subscriptionExpiresAt);
                    const isExpanded = expandedId === g.id;
                    const busy = isUpdating(g.id);

                    return (
                        <div key={g.id} className="rounded-token-2xl border border-border-subtle bg-bg-muted/70 p-4 shadow-token-sm">
                            <button
                                onClick={() => setExpandedId(isExpanded ? null : g.id)}
                                className="w-full text-left"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex min-w-0 items-center gap-3">
                                        {g.logoUrl ? (
                                            <img src={g.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-token-xl object-cover border border-border-subtle" />
                                        ) : (
                                            <div className="h-10 w-10 shrink-0 rounded-token-xl bg-bg-subtle border border-border-subtle flex items-center justify-center">
                                                <Crown className="h-4 w-4 text-fg-tertiary" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="truncate text-sm font-black text-fg-primary">{g.name}</p>
                                            <p className="mt-1 truncate text-[10px] font-mono text-fg-tertiary">{g.discordGuildId}</p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2">
                                        {busy ? <Loader2 className="h-4 w-4 animate-spin text-fg-info" /> : isExpanded ? <ChevronUp className="h-4 w-4 text-fg-tertiary" /> : <ChevronDown className="h-4 w-4 text-fg-tertiary" />}
                                    </div>
                                </div>
                                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-token-lg bg-bg-subtle px-2 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Plan</p>
                                        <span className={`mt-1 inline-flex items-center gap-1 rounded-token-full border px-2 py-0.5 text-[10px] font-bold ${getTierStyle(g.subscriptionTier)}`}>
                                            {getTierIcon(g.subscriptionTier)}
                                            {getTierLabel(g.subscriptionTier)}
                                        </span>
                                    </div>
                                    <div className="rounded-token-lg bg-bg-subtle px-2 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Members</p>
                                        <p className="mt-1 text-sm font-black text-fg-primary tabular-nums">{memberCountMap[g.id] || 0}</p>
                                    </div>
                                    <div className="rounded-token-lg bg-bg-subtle px-2 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-fg-tertiary">Status</p>
                                        <p className={`mt-1 text-[10px] font-black ${g.isActive ? 'text-fg-success' : 'text-fg-danger'}`}>{g.isActive ? 'ACTIVE' : 'INACTIVE'}</p>
                                    </div>
                                </div>
                                <div className="mt-3 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs">
                                    {exp ? (
                                        <span className={exp.expired ? 'font-bold text-fg-danger' : exp.expiringSoon ? 'font-bold text-fg-warning' : 'text-fg-secondary'}>
                                            {exp.expired ? `หมดอายุ (${exp.date})` : `เหลือ ${exp.diff} วัน (${exp.date})`}
                                        </span>
                                    ) : g.subscriptionTier !== 'FREE' ? (
                                        <span className="font-bold text-fg-success">ถาวร ไม่มีวันหมดอายุ</span>
                                    ) : (
                                        <span className="text-fg-tertiary">Free Plan</span>
                                    )}
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="mt-4 space-y-3 border-t border-border-subtle pt-4">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyId(g.id)}
                                            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs font-bold text-fg-secondary"
                                        >
                                            <Copy className="h-3.5 w-3.5" />
                                            Copy ID
                                        </button>
                                        <span className="min-w-0 flex-1 truncate rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-[10px] font-mono text-fg-tertiary">
                                            {g.id}
                                        </span>
                                    </div>
                                    <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-accent-bright">Grant Premium</p>
                                        <p className="mt-1 text-[11px] text-fg-tertiary">เลือกสิทธิ์พร้อมวันหมดอายุ เพื่อลดเคสแผนไม่ตรงหลัง redeploy</p>
                                        <div className="mt-3 grid grid-cols-2 gap-2">
                                            <button onClick={() => addDays(g.id, g.name, 30)} disabled={busy}
                                                className="rounded-token-lg border border-status-info bg-status-info-subtle px-3 py-2 text-[10px] font-bold text-fg-info disabled:opacity-50">
                                                Premium 30 วัน
                                            </button>
                                            <button onClick={() => addDays(g.id, g.name, 90)} disabled={busy}
                                                className="rounded-token-lg border border-status-info bg-status-info-subtle px-3 py-2 text-[10px] font-bold text-fg-info disabled:opacity-50">
                                                Premium 90 วัน
                                            </button>
                                            <button onClick={() => addDays(g.id, g.name, 365)} disabled={busy}
                                                className="rounded-token-lg border border-border-accent bg-accent-subtle px-3 py-2 text-[10px] font-bold text-accent-bright disabled:opacity-50">
                                                Premium 1 ปี
                                            </button>
                                            <button onClick={() => grantPermanentPremium(g.id, g.name)} disabled={busy}
                                                className="rounded-token-lg border border-status-success bg-status-success px-3 py-2 text-[10px] font-bold text-fg-inverse disabled:opacity-50">
                                                Premium ถาวร
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => startTrial(g.id, g.name)} disabled={busy}
                                            className="rounded-token-lg border border-border-accent bg-accent-subtle px-3 py-2 text-[10px] font-bold text-accent-bright disabled:opacity-50">
                                            Trial 7 วัน
                                        </button>
                                        <button onClick={() => downgradeToFree(g.id, g.name)} disabled={busy}
                                            className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-[10px] font-bold text-fg-secondary disabled:opacity-50">
                                            ลดเป็น Free
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {paged.length === 0 && (
                    <div className="rounded-token-2xl border border-border-subtle bg-bg-muted p-8 text-center text-sm text-fg-tertiary">
                        ไม่พบข้อมูล
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="hidden overflow-x-auto md:block">
                <table className="w-full">
                    <thead className="bg-bg-muted text-fg-tertiary text-[10px] uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-2.5 text-left">แก๊ง</th>
                            <th className="px-4 py-2.5 text-left">ID</th>
                            <th className="px-4 py-2.5 text-center">แพลน</th>
                            <th className="px-4 py-2.5 text-center">หมดอายุ</th>
                            <th className="px-4 py-2.5 text-right">สมาชิก</th>
                            <th className="px-4 py-2.5 w-8"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                        {paged.map(g => {
                            const exp = formatExpiry(g.subscriptionExpiresAt);
                            const isExpanded = expandedId === g.id;
                            const busy = isUpdating(g.id);
                            return (
                                <tr key={g.id} className="group">
                                    <td colSpan={6} className="p-0">
                                        <div>
                                            <button onClick={() => setExpandedId(isExpanded ? null : g.id)}
                                                className="w-full grid grid-cols-[1fr_auto_auto_auto_auto_auto] items-center gap-0 hover:bg-bg-muted transition-colors text-left">
                                                <div className="px-4 py-2.5 flex items-center gap-2 min-w-0">
                                                    {g.logoUrl ? (
                                                        <img src={g.logoUrl} alt="" className="w-6 h-6 rounded-token-lg object-cover border border-border-subtle shrink-0" />
                                                    ) : (
                                                        <div className="w-6 h-6 rounded-token-lg bg-bg-muted border border-border-subtle flex items-center justify-center shrink-0">
                                                            <Crown className="w-3 h-3 text-fg-tertiary" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-medium text-fg-primary truncate">{g.name}</div>
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <div className="text-[9px] text-fg-tertiary font-mono">{g.discordGuildId}</div>
                                                            {!g.isActive && (
                                                                <span className="inline-flex items-center rounded-token-full border border-status-danger bg-status-danger-subtle px-1.5 py-0.5 text-[8px] font-bold text-fg-danger">
                                                                    INACTIVE
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="px-3 py-2.5">
                                                    <button onClick={e => { e.stopPropagation(); copyId(g.id); }}
                                                        className="text-[8px] font-mono text-fg-tertiary hover:text-fg-secondary px-1.5 py-0.5 rounded-token-sm bg-bg-muted border border-border-subtle hover:border-border transition-colors truncate max-w-[80px]"
                                                        title={g.id}>
                                                        {g.id.slice(0, 8)}…
                                                    </button>
                                                </div>
                                                <div className="px-4 py-2.5 text-center">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-token-full text-[9px] font-bold border ${getTierStyle(g.subscriptionTier)}`}>
                                                        {getTierIcon(g.subscriptionTier)}
                                                        {getTierLabel(g.subscriptionTier)}
                                                    </span>
                                                </div>
                                                <div className="px-4 py-2.5 text-center text-[10px]">
                                                    {exp ? (
                                                        <span className={exp.expired ? 'text-fg-danger font-bold' : exp.expiringSoon ? 'text-fg-warning' : 'text-fg-secondary'}>
                                                            {exp.expired ? `หมดอายุ (${exp.date})` : `${exp.diff}d (${exp.date})`}
                                                        </span>
                                                    ) : g.subscriptionTier !== 'FREE' ? (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-token-full text-[8px] font-bold bg-status-success-subtle text-fg-success border border-status-success">ถาวร</span>
                                                    ) : <span className="text-fg-tertiary">—</span>}
                                                </div>
                                                <div className="px-4 py-2.5 text-right text-xs text-fg-secondary tabular-nums">{memberCountMap[g.id] || 0}</div>
                                                <div className="px-3 py-2.5">
                                                    {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-fg-info" /> : isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-fg-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-fg-tertiary" />}
                                                </div>
                                            </button>

                                            {/* Expanded plan management */}
                                            {isExpanded && (
                                                <div className="px-5 pb-4 pt-3 bg-bg-muted border-t border-border-subtle space-y-3">
                                                    {/* Current status */}
                                                    <div className="flex items-center gap-4 text-[10px] flex-wrap">
                                                        <span className="text-fg-tertiary">สถานะ:</span>
                                                        <span className={`inline-flex items-center gap-1 rounded-token-full border px-2 py-0.5 font-bold ${g.isActive ? 'border-status-success bg-status-success-subtle text-fg-success' : 'border-status-danger bg-status-danger-subtle text-fg-danger'}`}>
                                                            {g.isActive ? 'ACTIVE' : 'INACTIVE'}
                                                        </span>
                                                        {exp ? (
                                                            <span className={exp.expired ? 'text-fg-danger font-bold' : exp.expiringSoon ? 'text-fg-warning font-bold' : 'text-fg-secondary'}>
                                                                <Calendar className="w-3 h-3 inline mr-1" />
                                                                {exp.expired ? `หมดอายุแล้ว (${exp.date})` : `หมดอายุ ${exp.date} (เหลือ ${exp.diff} วัน)`}
                                                            </span>
                                                        ) : g.subscriptionTier !== 'FREE' ? (
                                                            <span className="text-fg-success font-bold">ถาวร (ไม่มีวันหมดอายุ)</span>
                                                        ) : (
                                                            <span className="text-fg-tertiary">Free Plan</span>
                                                        )}
                                                        <span className="text-fg-tertiary font-mono">ID: {g.id}</span>
                                                    </div>

                                                    {/* Actions grid */}
                                                    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                                <div>
                                                                    <p className="text-[10px] font-black uppercase tracking-widest text-accent-bright">Grant Premium</p>
                                                                    <p className="text-[11px] text-fg-tertiary">เลือกสิทธิ์พร้อมวันหมดอายุในปุ่มเดียว เพื่อลดเคสกดแพลนแล้วลืมกำหนดวัน</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-wrap gap-2">
                                                                <button onClick={() => addDays(g.id, g.name, 30)} disabled={busy}
                                                                    className="text-[10px] font-bold px-3 py-2 rounded-token-lg bg-status-info-subtle text-fg-info border border-status-info hover:brightness-110 transition-colors disabled:opacity-50">
                                                                    Premium 30 วัน
                                                                </button>
                                                                <button onClick={() => addDays(g.id, g.name, 90)} disabled={busy}
                                                                    className="text-[10px] font-bold px-3 py-2 rounded-token-lg bg-status-info-subtle text-fg-info border border-status-info hover:brightness-110 transition-colors disabled:opacity-50">
                                                                    Premium 90 วัน
                                                                </button>
                                                                <button onClick={() => addDays(g.id, g.name, 365)} disabled={busy}
                                                                    className="text-[10px] font-bold px-3 py-2 rounded-token-lg bg-accent-subtle text-accent-bright border border-border-accent hover:brightness-110 transition-colors disabled:opacity-50">
                                                                    Premium 1 ปี
                                                                </button>
                                                                <button onClick={() => grantPermanentPremium(g.id, g.name)} disabled={busy}
                                                                    className="text-[10px] font-bold px-3 py-2 rounded-token-lg bg-status-success text-fg-inverse border border-status-success hover:brightness-110 transition-colors disabled:opacity-50">
                                                                    Premium ถาวร
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-2 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 lg:flex-col lg:items-stretch">
                                                            <button onClick={() => startTrial(g.id, g.name)} disabled={busy}
                                                                className="text-[10px] font-bold px-3 py-2 rounded-token-lg bg-accent-subtle text-accent-bright border border-border-accent hover:brightness-110 transition-colors disabled:opacity-50">
                                                                Trial 7 วัน
                                                            </button>

                                                            <button onClick={() => downgradeToFree(g.id, g.name)} disabled={busy}
                                                                className="text-[10px] font-bold px-3 py-2 rounded-token-lg bg-bg-muted text-fg-secondary border border-border-subtle hover:brightness-110 transition-colors disabled:opacity-50">
                                                                ลดเป็น Free
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {paged.length === 0 && (
                            <tr><td colSpan={6} className="text-center py-8 text-fg-tertiary text-sm">ไม่พบข้อมูล</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                    <span className="text-[10px] text-fg-tertiary">
                        {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, filtered.length)} จาก {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                            className="p-1.5 rounded-token-lg text-fg-secondary hover:text-fg-primary hover:bg-bg-muted disabled:opacity-30 transition-colors">
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
                                    className={`w-7 h-7 rounded-token-lg text-[10px] font-bold flex items-center justify-center transition-colors ${p === page ? 'bg-status-info text-fg-inverse' : 'text-fg-secondary hover:bg-bg-muted'}`}>
                                    {p}
                                </button>
                            );
                        })}
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                            className="p-1.5 rounded-token-lg text-fg-secondary hover:text-fg-primary hover:bg-bg-muted disabled:opacity-30 transition-colors">
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

interface BackupPreviewIssue {
    level: 'error' | 'warning';
    code: string;
    message: string;
}

interface BackupPreviewCollection {
    key: string;
    label: string;
    count: number | null;
    status: 'ok' | 'missing' | 'invalid';
}

interface BackupImpactTotals {
    backupRecords: number;
    liveRecords: number;
    identifiedRecords: number;
    createCount: number;
    overwriteCount: number;
    liveOnlyCount: number;
    rowsWithoutId: number;
}

interface BackupImpactCollection {
    key: string;
    label: string;
    backupCount: number;
    liveCount: number;
    identifiedCount: number;
    createCount: number;
    overwriteCount: number;
    liveOnlyCount: number;
    rowsWithoutId: number;
}

interface BackupImpactData {
    hasExistingData: boolean;
    hasIdCollisions: boolean;
    strategyHint: 'create_only_candidate' | 'review_required';
    totals: BackupImpactTotals;
    collections: BackupImpactCollection[];
    notes: string[];
}

interface BackupPreviewData {
    fileName: string;
    timestamp: string | null;
    isValid: boolean;
    totalRecords: number;
    collections: BackupPreviewCollection[];
    issues: BackupPreviewIssue[];
    impact?: BackupImpactData;
}

interface RestorePlanSummary {
    backupRecords: number;
    plannedCreates: number;
    plannedOverwrites: number;
    skippedRecords: number;
    liveOnlyCount: number;
    affectedCollections: number;
}

interface RestorePlanCollection {
    key: string;
    label: string;
    backupCount: number;
    createCount: number;
    overwriteCount: number;
    skipCount: number;
    liveOnlyCount: number;
    rowsWithoutId: number;
}

interface RestorePlanData {
    fileName: string;
    strategy: 'create_only' | 'upsert_existing';
    requiresManualReview: boolean;
    summary: RestorePlanSummary;
    collections: RestorePlanCollection[];
    warnings: string[];
    prerequisites: string[];
    limitations: string[];
}

export function DataManager({ gangList }: { gangList: { id: string; name: string }[] }) {
    const [report, setReport] = useState<ReportData | null>(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [downloading, setDownloading] = useState(false);
    const [purging, setPurging] = useState<string | null>(null);
    const [confirmPurge, setConfirmPurge] = useState<{ action: string; label: string; description: string; gangId?: string; days?: number } | null>(null);
    const [purgeDays, setPurgeDays] = useState(90);
    const [selectedGangId, setSelectedGangId] = useState('');
    const [backupPreview, setBackupPreview] = useState<BackupPreviewData | null>(null);
    const [previewingBackup, setPreviewingBackup] = useState(false);
    const [backupPreviewError, setBackupPreviewError] = useState<string | null>(null);
    const [uploadedBackupJson, setUploadedBackupJson] = useState<string | null>(null);
    const [restorePlan, setRestorePlan] = useState<RestorePlanData | null>(null);
    const [restorePlanError, setRestorePlanError] = useState<string | null>(null);
    const [planningRestoreStrategy, setPlanningRestoreStrategy] = useState<'create_only' | 'upsert_existing' | null>(null);

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

    const handleBackupPreviewChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const input = event.target;
        const file = input.files?.[0];
        input.value = '';

        if (!file) return;

        setPreviewingBackup(true);
        setBackupPreview(null);
        setBackupPreviewError(null);
        setUploadedBackupJson(null);
        setRestorePlan(null);
        setRestorePlanError(null);

        try {
            const backupJson = await file.text();
            const res = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'preview_restore',
                    fileName: file.name,
                    backupJson,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ไม่สามารถตรวจสอบ Backup ได้');

            setUploadedBackupJson(backupJson);
            setBackupPreview(data.preview);

            if (data.preview?.isValid) {
                toast.success('ตรวจสอบ Backup สำเร็จ');
            } else {
                toast.error('Backup นี้ยังไม่พร้อมสำหรับการกู้คืน');
            }
        } catch (e: any) {
            const message = e.message || 'ไม่สามารถตรวจสอบ Backup ได้';
            setBackupPreviewError(message);
            toast.error(message);
        } finally {
            setPreviewingBackup(false);
        }
    };

    const handleRestorePlanPreview = async (strategy: 'create_only' | 'upsert_existing') => {
        if (!backupPreview || !uploadedBackupJson) return;

        setPlanningRestoreStrategy(strategy);
        setRestorePlan(null);
        setRestorePlanError(null);

        try {
            const res = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'preview_restore_plan',
                    fileName: backupPreview.fileName,
                    strategy,
                    backupJson: uploadedBackupJson,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ไม่สามารถสร้าง restore plan ได้');

            if (data.preview) {
                setBackupPreview(data.preview);
            }
            setRestorePlan(data.plan);
            toast.success('สร้าง restore plan สำเร็จ');
        } catch (e: any) {
            const message = e.message || 'ไม่สามารถสร้าง restore plan ได้';
            setRestorePlanError(message);
            toast.error(message);
        } finally {
            setPlanningRestoreStrategy(null);
        }
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
        <div className="flex items-center gap-3 p-3 bg-bg-muted rounded-token-xl border border-border-subtle">
            <div className="p-2 bg-bg-subtle rounded-token-lg">{icon}</div>
            <div>
                <div className="text-lg font-black text-fg-primary tabular-nums">{value.toLocaleString()}{sub && <span className="text-xs text-fg-tertiary ml-1">{sub}</span>}</div>
                <div className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider">{label}</div>
            </div>
        </div>
    );

    const previewErrors = backupPreview?.issues.filter(issue => issue.level === 'error') || [];
    const previewWarnings = backupPreview?.issues.filter(issue => issue.level === 'warning') || [];

    return (
        <div className="space-y-4">
            {/* Reports Section */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-fg-primary flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-fg-info" />
                            รายงานระบบ
                        </h3>
                        <button onClick={fetchReport} disabled={loadingReport}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-token-lg text-[10px] font-bold text-fg-secondary hover:text-fg-primary hover:bg-bg-muted transition-colors disabled:opacity-50">
                            <RefreshCw className={`w-3 h-3 ${loadingReport ? 'animate-spin' : ''}`} />
                            รีเฟรช
                        </button>
                    </div>
                </div>
                {report ? (
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                            <R icon={<Server className="w-4 h-4 text-fg-info" />} label="แก๊ง (Active)" value={report.overview.activeGangs} sub={`/${report.overview.totalGangs}`} />
                            <R icon={<Users className="w-4 h-4 text-fg-success" />} label="สมาชิก (Active)" value={report.overview.activeMembers} sub={`/${report.overview.totalMembers}`} />
                            <R icon={<ScrollText className="w-4 h-4 text-accent-bright" />} label="ธุรกรรม" value={report.finance.totalTransactions} sub={`(30d: ${report.finance.recentTransactions30d})`} />
                            <R icon={<Clock className="w-4 h-4 text-fg-warning" />} label="เช็คชื่อ" value={report.attendance.totalSessions} sub={`(7d: ${report.attendance.recentSessions7d})`} />
                            <R icon={<Shield className="w-4 h-4 text-fg-danger" />} label="Audit Logs" value={report.audit.totalLogs} />
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-fg-tertiary">
                        {loadingReport ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : <BarChart3 className="w-6 h-6 mx-auto opacity-30" />}
                        <p className="text-xs mt-2">{loadingReport ? 'กำลังโหลดรายงาน...' : 'ไม่สามารถโหลดรายงานได้'}</p>
                    </div>
                )}
            </div>

            {/* Backup */}
            <div className="bg-bg-subtle border border-status-success rounded-token-2xl p-5 shadow-token-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-status-success-subtle rounded-token-xl shrink-0">
                        <Download className="w-6 h-6 text-fg-success" />
                    </div>
                    <div className="flex-1">
                        <div className="text-sm font-bold text-fg-primary">ดาวน์โหลด Backup</div>
                        <div className="text-[10px] text-fg-tertiary mt-0.5">ดาวน์โหลดข้อมูลทั้งระบบเป็นไฟล์ JSON (แก๊ง, สมาชิก, ธุรกรรม, เช็คชื่อ, Audit Logs)</div>
                    </div>
                    <button onClick={handleDownload} disabled={downloading}
                        className="px-5 py-2.5 rounded-token-xl text-xs font-bold text-fg-inverse bg-status-success hover:brightness-110 transition-colors flex items-center gap-2 disabled:opacity-50 shrink-0">
                        {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                        {downloading ? 'กำลังโหลด...' : 'ดาวน์โหลด Backup'}
                    </button>
                </div>
            </div>

            <div className="bg-bg-subtle border border-status-info rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-status-info-subtle rounded-token-xl shrink-0">
                                <FileText className="w-6 h-6 text-fg-info" />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-fg-primary">ตรวจสอบไฟล์ Backup ก่อนกู้คืน</div>
                                <div className="text-[10px] text-fg-tertiary mt-0.5">อัปโหลดไฟล์ JSON เพื่อ validate โครงสร้างและดู preview เท่านั้น ระบบยังไม่ restore ข้อมูลจริง</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {(backupPreview || backupPreviewError) && (
                                <button
                                    onClick={() => {
                                        setBackupPreview(null);
                                        setBackupPreviewError(null);
                                        setUploadedBackupJson(null);
                                        setRestorePlan(null);
                                        setRestorePlanError(null);
                                    }}
                                    className="px-3 py-2 rounded-token-lg text-[10px] font-bold text-fg-secondary hover:text-fg-primary hover:bg-bg-muted transition-colors"
                                >
                                    ล้างผลตรวจ
                                </button>
                            )}
                            <label className="px-4 py-2.5 rounded-token-xl text-xs font-bold text-fg-inverse bg-status-info hover:brightness-110 transition-colors flex items-center gap-2 cursor-pointer">
                                {previewingBackup ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                {previewingBackup ? 'กำลังตรวจ...' : 'เลือกไฟล์ Backup'}
                                <input type="file" accept=".json,application/json" className="hidden" onChange={handleBackupPreviewChange} disabled={previewingBackup} />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {backupPreviewError && (
                        <div className="rounded-token-xl border border-status-danger bg-status-danger-subtle p-4 text-xs text-fg-danger">
                            <div className="font-bold text-fg-danger">ตรวจสอบ Backup ไม่สำเร็จ</div>
                            <div className="mt-1 text-fg-danger">{backupPreviewError}</div>
                        </div>
                    )}

                    {backupPreview ? (
                        <div className="space-y-4">
                            <div className="flex flex-col gap-3 rounded-token-2xl border border-border-subtle bg-bg-muted p-4 lg:flex-row lg:items-center lg:justify-between">
                                <div className="space-y-1">
                                    <div className="text-sm font-bold text-fg-primary break-all">{backupPreview.fileName}</div>
                                    <div className="text-[10px] text-fg-tertiary">
                                        {backupPreview.timestamp ? `Exported: ${new Date(backupPreview.timestamp).toLocaleString('th-TH')}` : 'ไฟล์นี้ไม่มี timestamp จากระบบ export'}
                                    </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <div className={`inline-flex items-center rounded-token-full border px-3 py-1 text-[10px] font-bold ${backupPreview.isValid ? 'border-status-success bg-status-success-subtle text-fg-success' : 'border-status-danger bg-status-danger-subtle text-fg-danger'}`}>
                                        {backupPreview.isValid ? 'ผ่านการตรวจสอบเบื้องต้น' : 'ยังไม่พร้อมสำหรับการกู้คืน'}
                                    </div>
                                    <div className="inline-flex items-center rounded-token-full border border-border-subtle bg-bg-subtle px-3 py-1 text-[10px] font-bold text-fg-secondary">
                                        {backupPreview.totalRecords.toLocaleString()} records
                                    </div>
                                    <div className="inline-flex items-center rounded-token-full border border-status-danger bg-status-danger-subtle px-3 py-1 text-[10px] font-bold text-fg-danger">
                                        Errors {previewErrors.length}
                                    </div>
                                    <div className="inline-flex items-center rounded-token-full border border-status-warning bg-status-warning-subtle px-3 py-1 text-[10px] font-bold text-fg-warning">
                                        Warnings {previewWarnings.length}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {backupPreview.collections.map((collection) => (
                                    <div key={collection.key} className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">{collection.label}</div>
                                            <div className={`rounded-token-full px-2 py-0.5 text-[9px] font-bold ${collection.status === 'ok' ? 'bg-status-success-subtle text-fg-success' : collection.status === 'missing' ? 'bg-status-danger-subtle text-fg-danger' : 'bg-status-warning-subtle text-fg-warning'}`}>
                                                {collection.status === 'ok' ? 'OK' : collection.status === 'missing' ? 'MISSING' : 'INVALID'}
                                            </div>
                                        </div>
                                        <div className="mt-3 text-lg font-black text-fg-primary tabular-nums">{collection.count === null ? '—' : collection.count.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="rounded-token-2xl border border-border-subtle bg-bg-muted p-4">
                                <div className="text-xs font-bold text-fg-primary">ผลตรวจเบื้องต้น</div>
                                {backupPreview.issues.length > 0 ? (
                                    <div className="mt-3 space-y-2">
                                        {backupPreview.issues.map((issue, index) => (
                                            <div key={`${issue.code}-${index}`} className={`rounded-token-xl border px-3 py-2 text-xs ${issue.level === 'error' ? 'border-status-danger bg-status-danger-subtle text-fg-danger' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                                                <div className="font-bold uppercase tracking-wider text-[10px] opacity-80">{issue.level}</div>
                                                <div className="mt-1">{issue.message}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="mt-3 rounded-token-xl border border-status-success bg-status-success-subtle px-3 py-2 text-xs text-fg-success">
                                        ไม่พบปัญหาเชิงโครงสร้างจากไฟล์ Backup นี้
                                    </div>
                                )}
                            </div>

                            {backupPreview.impact && (
                                <div className="rounded-token-2xl border border-border-subtle bg-bg-muted p-4 space-y-4">
                                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                        <div>
                                            <div className="text-xs font-bold text-fg-primary">ผลกระทบถ้าจะกู้คืนในอนาคต</div>
                                            <div className="mt-1 text-[10px] text-fg-tertiary">เป็นการเทียบกับข้อมูลปัจจุบันแบบ dry-run เท่านั้น ยังไม่มีการเขียนทับหรือนำเข้าข้อมูลจริง</div>
                                        </div>
                                        <div className={`inline-flex items-center rounded-token-full border px-3 py-1 text-[10px] font-bold ${backupPreview.impact.strategyHint === 'create_only_candidate' ? 'border-status-success bg-status-success-subtle text-fg-success' : 'border-status-warning bg-status-warning-subtle text-fg-warning'}`}>
                                            {backupPreview.impact.strategyHint === 'create_only_candidate' ? 'ชนข้อมูลน้อย / review ง่าย' : 'ต้อง review ก่อน restore เสมอ'}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Create</div>
                                            <div className="mt-2 text-lg font-black text-fg-success tabular-nums">{backupPreview.impact.totals.createCount.toLocaleString()}</div>
                                        </div>
                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Overwrite</div>
                                            <div className="mt-2 text-lg font-black text-fg-danger tabular-nums">{backupPreview.impact.totals.overwriteCount.toLocaleString()}</div>
                                        </div>
                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Live Only</div>
                                            <div className="mt-2 text-lg font-black text-fg-warning tabular-nums">{backupPreview.impact.totals.liveOnlyCount.toLocaleString()}</div>
                                        </div>
                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">No ID</div>
                                            <div className="mt-2 text-lg font-black text-fg-secondary tabular-nums">{backupPreview.impact.totals.rowsWithoutId.toLocaleString()}</div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Operator Notes</div>
                                            <div className="mt-3 space-y-2">
                                                {backupPreview.impact.notes.map((note, index) => (
                                                    <div key={index} className="rounded-token-lg border border-border-subtle bg-bg-muted px-3 py-2 text-xs text-fg-secondary">
                                                        {note}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-3">
                                            <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Impact Totals</div>
                                            <div className="mt-3 space-y-2 text-xs text-fg-secondary">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Backup records</span>
                                                    <span className="font-bold tabular-nums text-fg-primary">{backupPreview.impact.totals.backupRecords.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Live records</span>
                                                    <span className="font-bold tabular-nums text-fg-primary">{backupPreview.impact.totals.liveRecords.toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center justify-between gap-3">
                                                    <span>Identified backup rows</span>
                                                    <span className="font-bold tabular-nums text-fg-primary">{backupPreview.impact.totals.identifiedRecords.toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto rounded-token-xl border border-border-subtle">
                                        <table className="min-w-full text-left text-xs">
                                            <thead className="bg-bg-subtle text-fg-tertiary">
                                                <tr>
                                                    <th className="px-3 py-2 font-bold">Collection</th>
                                                    <th className="px-3 py-2 font-bold">Backup</th>
                                                    <th className="px-3 py-2 font-bold">Live</th>
                                                    <th className="px-3 py-2 font-bold">Create</th>
                                                    <th className="px-3 py-2 font-bold">Overwrite</th>
                                                    <th className="px-3 py-2 font-bold">Live Only</th>
                                                    <th className="px-3 py-2 font-bold">No ID</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-subtle">
                                                {backupPreview.impact.collections.map((collection) => (
                                                    <tr key={collection.key} className="bg-bg-muted text-fg-secondary">
                                                        <td className="px-3 py-2 font-bold text-fg-primary">{collection.label}</td>
                                                        <td className="px-3 py-2 tabular-nums">{collection.backupCount.toLocaleString()}</td>
                                                        <td className="px-3 py-2 tabular-nums">{collection.liveCount.toLocaleString()}</td>
                                                        <td className="px-3 py-2 tabular-nums text-fg-success">{collection.createCount.toLocaleString()}</td>
                                                        <td className="px-3 py-2 tabular-nums text-fg-danger">{collection.overwriteCount.toLocaleString()}</td>
                                                        <td className="px-3 py-2 tabular-nums text-fg-warning">{collection.liveOnlyCount.toLocaleString()}</td>
                                                        <td className="px-3 py-2 tabular-nums text-fg-secondary">{collection.rowsWithoutId.toLocaleString()}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <div className="rounded-token-xl border border-status-info bg-status-info-subtle p-4 space-y-3">
                                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                                            <div>
                                                <div className="text-xs font-bold text-fg-primary">สร้าง Restore Plan แบบ Dry-Run</div>
                                                <div className="mt-1 text-[10px] text-fg-secondary">เลือก strategy เพื่อจำลองว่าถ้า restore จริงในอนาคต ระบบจะ create / overwrite / skip อะไรบ้าง โดยยังไม่เขียนข้อมูลจริง</div>
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    onClick={() => handleRestorePlanPreview('create_only')}
                                                    disabled={!backupPreview.isValid || !!planningRestoreStrategy}
                                                    className="px-3 py-2 rounded-token-lg text-[10px] font-bold text-fg-inverse bg-status-success hover:brightness-110 transition-colors disabled:opacity-50"
                                                >
                                                    {planningRestoreStrategy === 'create_only' ? 'กำลังสร้าง...' : 'Plan: Create Only'}
                                                </button>
                                                <button
                                                    onClick={() => handleRestorePlanPreview('upsert_existing')}
                                                    disabled={!backupPreview.isValid || !!planningRestoreStrategy}
                                                    className="px-3 py-2 rounded-token-lg text-[10px] font-bold text-fg-inverse bg-status-warning hover:brightness-110 transition-colors disabled:opacity-50"
                                                >
                                                    {planningRestoreStrategy === 'upsert_existing' ? 'กำลังสร้าง...' : 'Plan: Upsert Existing'}
                                                </button>
                                            </div>
                                        </div>

                                        {restorePlanError && (
                                            <div className="rounded-token-lg border border-status-danger bg-status-danger-subtle px-3 py-2 text-xs text-fg-danger">
                                                {restorePlanError}
                                            </div>
                                        )}

                                        {restorePlan && (
                                            <div className="space-y-4">
                                                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                    <div>
                                                        <div className="text-sm font-bold text-fg-primary">Restore Plan: {restorePlan.strategy === 'create_only' ? 'Create Only' : 'Upsert Existing'}</div>
                                                        <div className="mt-1 text-[10px] text-fg-tertiary break-all">{restorePlan.fileName}</div>
                                                    </div>
                                                    <div className={`inline-flex items-center rounded-token-full border px-3 py-1 text-[10px] font-bold ${restorePlan.requiresManualReview ? 'border-status-warning bg-status-warning-subtle text-fg-warning' : 'border-status-success bg-status-success-subtle text-fg-success'}`}>
                                                        {restorePlan.requiresManualReview ? 'ต้อง review ก่อนทุกกรณี' : 'ความเสี่ยงต่ำกว่า แต่ยังเป็น plan-only'}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Creates</div>
                                                        <div className="mt-2 text-lg font-black text-fg-success tabular-nums">{restorePlan.summary.plannedCreates.toLocaleString()}</div>
                                                    </div>
                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Overwrites</div>
                                                        <div className="mt-2 text-lg font-black text-fg-danger tabular-nums">{restorePlan.summary.plannedOverwrites.toLocaleString()}</div>
                                                    </div>
                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Skipped</div>
                                                        <div className="mt-2 text-lg font-black text-fg-secondary tabular-nums">{restorePlan.summary.skippedRecords.toLocaleString()}</div>
                                                    </div>
                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Live Only</div>
                                                        <div className="mt-2 text-lg font-black text-fg-warning tabular-nums">{restorePlan.summary.liveOnlyCount.toLocaleString()}</div>
                                                    </div>
                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Collections</div>
                                                        <div className="mt-2 text-lg font-black text-fg-primary tabular-nums">{restorePlan.summary.affectedCollections.toLocaleString()}</div>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Warnings</div>
                                                        <div className="mt-3 space-y-2">
                                                            {restorePlan.warnings.map((warning, index) => (
                                                                <div key={index} className="rounded-token-lg border border-status-warning bg-status-warning-subtle px-3 py-2 text-xs text-fg-warning">
                                                                    {warning}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Prerequisites</div>
                                                        <div className="mt-3 space-y-2">
                                                            {restorePlan.prerequisites.map((item, index) => (
                                                                <div key={index} className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs text-fg-secondary">
                                                                    {item}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    <div className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-fg-tertiary">Limitations</div>
                                                        <div className="mt-3 space-y-2">
                                                            {restorePlan.limitations.map((item, index) => (
                                                                <div key={index} className="rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-xs text-fg-secondary">
                                                                    {item}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="overflow-x-auto rounded-token-xl border border-border-subtle">
                                                    <table className="min-w-full text-left text-xs">
                                                        <thead className="bg-bg-subtle text-fg-tertiary">
                                                            <tr>
                                                                <th className="px-3 py-2 font-bold">Collection</th>
                                                                <th className="px-3 py-2 font-bold">Backup</th>
                                                                <th className="px-3 py-2 font-bold">Create</th>
                                                                <th className="px-3 py-2 font-bold">Overwrite</th>
                                                                <th className="px-3 py-2 font-bold">Skip</th>
                                                                <th className="px-3 py-2 font-bold">Live Only</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border-subtle">
                                                            {restorePlan.collections.map((collection) => (
                                                                <tr key={collection.key} className="bg-bg-muted text-fg-secondary">
                                                                    <td className="px-3 py-2 font-bold text-fg-primary">{collection.label}</td>
                                                                    <td className="px-3 py-2 tabular-nums">{collection.backupCount.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 tabular-nums text-fg-success">{collection.createCount.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 tabular-nums text-fg-danger">{collection.overwriteCount.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 tabular-nums text-fg-secondary">{collection.skipCount.toLocaleString()}</td>
                                                                    <td className="px-3 py-2 tabular-nums text-fg-warning">{collection.liveOnlyCount.toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : !backupPreviewError ? (
                        <div className="rounded-token-2xl border border-dashed border-border bg-bg-muted p-6 text-center">
                            <FileText className="w-6 h-6 mx-auto text-fg-tertiary" />
                            <div className="mt-2 text-xs font-bold text-fg-secondary">ยังไม่ได้อัปโหลดไฟล์ Backup</div>
                            <div className="mt-1 text-[10px] text-fg-tertiary">เมื่อเลือกไฟล์แล้ว ระบบจะตรวจโครงสร้าง, นับจำนวน records และชี้ปัญหาที่ควรแก้ก่อนใช้กู้คืน</div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Cleanup Actions */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle">
                    <h3 className="text-sm font-bold text-fg-primary flex items-center gap-2">
                        <Database className="w-4 h-4 text-fg-warning" />
                        ล้างข้อมูลเก่า
                    </h3>
                    <p className="text-[10px] text-fg-tertiary mt-1">ลบข้อมูลที่ไม่จำเป็นเพื่อลดขนาด Database</p>
                </div>
                <div className="p-5 space-y-3">
                    {/* Shared days input */}
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-fg-tertiary font-bold">ข้อมูลเก่ากว่า</span>
                        <input type="number" min={7} max={365} value={purgeDays} onChange={e => setPurgeDays(Math.max(7, Number(e.target.value)))}
                            className="bg-bg-muted border border-border-subtle text-fg-primary text-xs rounded-token-lg px-2 py-1.5 outline-none focus:border-border w-16 text-center tabular-nums" />
                        <span className="text-[10px] text-fg-tertiary">วัน</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button onClick={() => setConfirmPurge({ action: 'purge_audit_logs', label: 'ลบ Audit Logs', description: `ลบ audit logs ที่เก่ากว่า ${purgeDays} วัน`, days: purgeDays })}
                            disabled={!!purging}
                            className="flex items-center gap-3 p-3 bg-bg-muted border border-border-subtle rounded-token-xl hover:bg-bg-subtle transition-colors disabled:opacity-50 text-left">
                            <div className="p-2 bg-status-warning-subtle rounded-token-lg shrink-0">
                                {purging === 'purge_audit_logs' ? <Loader2 className="w-4 h-4 animate-spin text-fg-warning" /> : <ScrollText className="w-4 h-4 text-fg-warning" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-fg-primary">Audit Logs</div>
                                <div className="text-[9px] text-fg-tertiary">ลบ logs เก่า</div>
                            </div>
                        </button>
                        <button onClick={() => setConfirmPurge({ action: 'purge_old_attendance', label: 'ลบเช็คชื่อเก่า', description: `ลบ attendance sessions ที่เก่ากว่า ${purgeDays} วัน`, days: purgeDays })}
                            disabled={!!purging}
                            className="flex items-center gap-3 p-3 bg-bg-muted border border-border-subtle rounded-token-xl hover:bg-bg-subtle transition-colors disabled:opacity-50 text-left">
                            <div className="p-2 bg-status-warning-subtle rounded-token-lg shrink-0">
                                {purging === 'purge_old_attendance' ? <Loader2 className="w-4 h-4 animate-spin text-fg-warning" /> : <Clock className="w-4 h-4 text-fg-warning" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-fg-primary">เช็คชื่อเก่า</div>
                                <div className="text-[9px] text-fg-tertiary">ลบ sessions + records</div>
                            </div>
                        </button>
                        <button onClick={() => setConfirmPurge({ action: 'purge_inactive_members', label: 'ลบสมาชิก Inactive', description: 'ลบสมาชิกที่ถูก deactivate แล้วทุกแก๊ง — ย้อนกลับไม่ได้!' })}
                            disabled={!!purging}
                            className="flex items-center gap-3 p-3 bg-bg-muted border border-border-subtle rounded-token-xl hover:bg-bg-subtle transition-colors disabled:opacity-50 text-left">
                            <div className="p-2 bg-status-danger-subtle rounded-token-lg shrink-0">
                                {purging === 'purge_inactive_members' ? <Loader2 className="w-4 h-4 animate-spin text-fg-danger" /> : <UserX className="w-4 h-4 text-fg-danger" />}
                            </div>
                            <div>
                                <div className="text-xs font-bold text-fg-primary">สมาชิก Inactive</div>
                                <div className="text-[9px] text-fg-tertiary">ลบที่ deactivate แล้ว</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-bg-subtle border border-status-danger rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-status-danger bg-status-danger-subtle">
                    <h3 className="text-sm font-bold text-fg-danger flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Danger Zone
                    </h3>
                    <p className="text-[10px] text-fg-tertiary mt-1">การกระทำในส่วนนี้ย้อนกลับไม่ได้ — โปรดระวัง</p>
                </div>
                <div className="p-5">
                    <div className="flex items-center gap-3">
                        <select value={selectedGangId} onChange={e => setSelectedGangId(e.target.value)}
                            className="flex-1 bg-bg-muted border border-status-danger text-fg-primary text-xs rounded-token-lg px-3 py-2.5 outline-none focus:border-status-danger transition-colors">
                            <option value="">— เลือกแก๊งที่ต้องการลบ —</option>
                            {gangList.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                        <button onClick={() => {
                            const gang = gangList.find(g => g.id === selectedGangId);
                            if (!gang) return;
                            setConfirmPurge({ action: 'delete_gang_data', label: `ลบแก๊ง "${gang.name}"`, description: `ลบแก๊ง "${gang.name}" และข้อมูลทั้งหมด (สมาชิก, เช็คชื่อ, ธุรกรรม, การเงิน ฯลฯ) — ย้อนกลับไม่ได้!`, gangId: gang.id });
                        }}
                            disabled={!selectedGangId || !!purging}
                            className="px-5 py-2.5 rounded-token-lg text-xs font-bold text-fg-inverse bg-status-danger hover:brightness-110 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0">
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
                icon={<AlertTriangle className="w-6 h-6 text-fg-danger" />}
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
    finance: <Zap className="w-4 h-4 text-fg-success" />,
    attendance: <Clock className="w-4 h-4 text-fg-info" />,
    leave: <UserX className="w-4 h-4 text-fg-warning" />,
    announcements: <ScrollText className="w-4 h-4 text-accent-bright" />,
    export_csv: <Download className="w-4 h-4 text-fg-info" />,
    monthly_summary: <BarChart3 className="w-4 h-4 text-accent-bright" />,
    analytics: <BarChart3 className="w-4 h-4 text-accent-bright" />,
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
        <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
            <div className="p-5 border-b border-border-subtle">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="font-bold text-lg text-fg-primary flex items-center gap-2">
                        <Power className="w-5 h-5 text-fg-warning" />
                        Feature Flags
                    </h2>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-token-full bg-status-warning-subtle border border-status-warning">
                        <Wrench className="w-3 h-3 text-fg-warning" />
                        <span className="text-[10px] font-bold text-fg-warning">Kill-Switch</span>
                    </div>
                </div>
                <p className="text-[10px] text-fg-tertiary leading-relaxed mb-3">
                    เปิด/ปิดฟีเจอร์ทั้งระบบ — ใช้เมื่อกำลัง DEV หรือมีปัญหา ปิดแล้วผู้ใช้ทุกคนจะเข้าถึงฟีเจอร์นั้นไม่ได้ทันที
                </p>
                <div className="flex items-center gap-4 text-xs">
                    <span className="text-fg-success">เปิดอยู่ <strong>{enabledCount}</strong></span>
                    <span className="text-fg-danger">ปิดอยู่ <strong>{disabledCount}</strong></span>
                </div>
            </div>

            <div className="divide-y divide-border-subtle">
                {flags.map(flag => (
                    <div
                        key={flag.key}
                        className={`flex items-center gap-4 px-5 py-4 transition-colors ${flag.enabled ? 'hover:bg-bg-muted' : 'bg-status-danger-subtle hover:brightness-105'
                            }`}
                    >
                        <div className={`p-2 rounded-token-xl ${flag.enabled ? 'bg-bg-muted' : 'bg-status-danger-subtle'}`}>
                            {FEATURE_ICONS[flag.key] || <Settings className="w-4 h-4 text-fg-secondary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-fg-primary">{flag.name}</span>
                                <code className="text-[9px] text-fg-tertiary bg-bg-muted px-1.5 py-0.5 rounded-token-sm font-mono">{flag.key}</code>
                                {!flag.enabled && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-token-sm text-[9px] font-bold bg-status-danger-subtle text-fg-danger border border-status-danger">
                                        DISABLED
                                    </span>
                                )}
                            </div>
                            {flag.description && (
                                <p className="text-[10px] text-fg-tertiary mt-0.5 truncate">{flag.description}</p>
                            )}
                            {flag.updatedAt && (
                                <p className="text-[9px] text-fg-tertiary mt-0.5">
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
                                <Loader2 className="w-6 h-6 animate-spin text-fg-secondary" />
                            ) : flag.enabled ? (
                                <ToggleRight className="w-7 h-7 text-fg-success" />
                            ) : (
                                <ToggleLeft className="w-7 h-7 text-fg-danger" />
                            )}
                        </button>
                    </div>
                ))}
                {flags.length === 0 && (
                    <div className="p-12 text-center text-fg-tertiary">
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
