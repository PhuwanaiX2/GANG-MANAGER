'use client';

import { Fragment, useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
    Search,
    Activity,
    Shield,
    Clock,
    Key,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    AlertTriangle,
    Zap,
    Users,
    DollarSign,
    Settings,
    Eye,
    ArrowRight,
} from 'lucide-react';

interface LogData {
    id: string;
    gangId: string;
    actorId: string;
    actorName: string;
    action: string;
    targetType: string | null;
    targetId: string | null;
    oldValue: string | null;
    newValue: string | null;
    details: string | null;
    createdAt: string;
    gangName: string | null;
}

interface Stats {
    total: number;
    adminActions: number;
    todayCount: number;
}

const ITEMS_PER_PAGE = 50;

function getActionCategory(action: string): { icon: React.ReactNode; color: string; label: string } {
    if (action.includes('LICENSE')) return { icon: <Key className="w-3.5 h-3.5" />, color: 'bg-status-warning-subtle text-fg-warning border-status-warning', label: 'LICENSE' };
    if (action.startsWith('ADMIN')) return { icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-status-danger-subtle text-fg-danger border-status-danger', label: 'ADMIN' };
    if (action.includes('TOGGLE') || action.includes('FEATURE')) return { icon: <Zap className="w-3.5 h-3.5" />, color: 'bg-status-warning-subtle text-fg-warning border-status-warning', label: 'FEATURE' };
    if (action.includes('MEMBER') || action.includes('JOIN') || action.includes('LEAVE') || action.includes('APPROVE') || action.includes('REJECT')) return { icon: <Users className="w-3.5 h-3.5" />, color: 'bg-status-info-subtle text-fg-info border-status-info', label: 'MEMBER' };
    if (action.includes('TRANSACTION') || action.includes('FINANCE') || action.includes('DEPOSIT') || action.includes('LOAN') || action.includes('FEE')) return { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'bg-status-success-subtle text-fg-success border-status-success', label: 'FINANCE' };
    if (action.includes('ATTENDANCE') || action.includes('CHECK_IN')) return { icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-status-info-subtle text-fg-info border-status-info', label: 'ATTEND' };
    if (action.includes('SETTING') || action.includes('UPDATE') || action.includes('CONFIG')) return { icon: <Settings className="w-3.5 h-3.5" />, color: 'bg-accent-subtle text-accent-bright border-border-accent', label: 'SETTING' };
    if (action.includes('CREATE')) return { icon: <Zap className="w-3.5 h-3.5" />, color: 'bg-status-success-subtle text-fg-success border-status-success', label: 'CREATE' };
    if (action.includes('DELETE')) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'bg-status-danger-subtle text-fg-danger border-status-danger', label: 'DELETE' };
    return { icon: <Activity className="w-3.5 h-3.5" />, color: 'bg-bg-muted text-fg-secondary border-border-subtle', label: 'OTHER' };
}

function parseDetails(details: string | null): string {
    if (!details) return '';
    try {
        const d = JSON.parse(details);
        return d.gangName || d.licenseKey || d.description || d.reason || JSON.stringify(d).slice(0, 100);
    } catch {
        return details.slice(0, 100);
    }
}

function getLicenseLookupValue(log: LogData): string | null {
    if (log.details) {
        try {
            const details = JSON.parse(log.details);
            if (typeof details.licenseKey === 'string' && details.licenseKey.trim()) {
                return details.licenseKey.trim();
            }
        } catch {
            // ignore malformed details payloads
        }
    }

    if (log.targetType?.toLowerCase() === 'license' && log.targetId) {
        return log.targetId;
    }

    return null;
}

export function ActivityLog({ logs, stats, actionTypes, initialSearch = '', initialCategoryFilter = 'ALL', initialActionFilter = 'ALL' }: { logs: LogData[]; stats: Stats; actionTypes: string[]; initialSearch?: string; initialCategoryFilter?: string; initialActionFilter?: string }) {
    const [search, setSearch] = useState(initialSearch);
    const [actionFilter, setActionFilter] = useState<string>(initialActionFilter);
    const [categoryFilter, setCategoryFilter] = useState<string>(initialCategoryFilter);
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        setSearch(initialSearch);
        setActionFilter(initialActionFilter);
        setCategoryFilter(initialCategoryFilter);
        setPage(1);
        setExpandedId(null);
    }, [initialSearch, initialActionFilter, initialCategoryFilter]);

    const categories = useMemo(() => {
        const cats = new Set<string>();
        actionTypes.forEach(a => {
            const { label } = getActionCategory(a);
            cats.add(label);
        });
        return Array.from(cats).sort();
    }, [actionTypes]);

    const categoryCounts = useMemo(() => {
        return logs.reduce((acc, log) => {
            const category = getActionCategory(log.action).label;
            acc[category] = (acc[category] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);
    }, [logs]);

    const buildLogHref = ({ nextSearch = search, nextCategory = categoryFilter, nextAction = actionFilter }: { nextSearch?: string; nextCategory?: string; nextAction?: string }) => {
        const params = new URLSearchParams();
        const trimmedSearch = nextSearch.trim();
        if (trimmedSearch) params.set('search', trimmedSearch);
        if (nextCategory !== 'ALL') params.set('category', nextCategory);
        if (nextAction !== 'ALL') params.set('action', nextAction);
        const query = params.toString();
        return query ? `/admin/logs?${query}` : '/admin/logs';
    };

    const filtered = useMemo(() => {
        return logs.filter(log => {
            const q = search.toLowerCase();
            const matchSearch = !search ||
                log.action.toLowerCase().includes(q) ||
                log.actorName.toLowerCase().includes(q) ||
                (log.gangName && log.gangName.toLowerCase().includes(q)) ||
                (log.details && log.details.toLowerCase().includes(q)) ||
                (log.oldValue && log.oldValue.toLowerCase().includes(q)) ||
                (log.newValue && log.newValue.toLowerCase().includes(q)) ||
                log.actorId.includes(search) ||
                log.gangId.includes(search) ||
                (log.targetId && log.targetId.includes(search));
            const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
            const matchCategory = categoryFilter === 'ALL' || getActionCategory(log.action).label === categoryFilter;
            return matchSearch && matchAction && matchCategory;
        });
    }, [logs, search, actionFilter, categoryFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    const paged = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    const copyId = (id: string) => {
        navigator.clipboard.writeText(id);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-3.5 h-3.5 text-fg-info" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">Log ทั้งหมด</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.total.toLocaleString()}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-fg-danger" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">Admin Actions</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.adminActions.toLocaleString()}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3.5 h-3.5 text-fg-warning" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">วันนี้</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{stats.todayCount.toLocaleString()}</div>
                </div>
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                <div className="flex items-center justify-between gap-3 mb-3">
                    <div>
                        <h3 className="text-sm font-bold text-fg-primary">Quick Filters</h3>
                        <p className="text-[11px] text-fg-tertiary mt-1">คิว troubleshoot จาก activity log ที่โหลดอยู่ตอนนี้</p>
                    </div>
                    <Link href="/admin/logs" className="text-[10px] text-fg-info hover:text-fg-primary font-bold flex items-center gap-1">
                        ดูทั้งหมด <ArrowRight className="w-3 h-3" />
                    </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Link href={buildLogHref({ nextCategory: 'ALL', nextAction: 'ALL' })}
                        className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1.5 text-[10px] font-bold transition-colors ${categoryFilter === 'ALL' && actionFilter === 'ALL' ? 'border-status-info bg-status-info-subtle text-fg-info' : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border'}`}>
                        ทั้งหมด
                        <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{logs.length}</span>
                    </Link>
                    {categories.map(category => (
                        <Link
                            key={category}
                            href={buildLogHref({ nextCategory: category, nextAction: 'ALL' })}
                            className={`inline-flex items-center gap-2 rounded-token-full border px-3 py-1.5 text-[10px] font-bold transition-colors ${categoryFilter === category ? 'border-status-info bg-status-info-subtle text-fg-info' : 'border-border-subtle bg-bg-muted text-fg-secondary hover:border-border'}`}
                        >
                            {category}
                            <span className="rounded-token-full bg-bg-muted px-1.5 py-0.5 text-[9px] tabular-nums">{categoryCounts[category] || 0}</span>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-fg-tertiary" />
                        <input
                            type="text"
                            placeholder="ค้นหา action, ชื่อ, gang, ID..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border"
                        />
                    </div>
                    <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setActionFilter('ALL'); setPage(1); }}
                        className="px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border">
                        <option value="ALL">ทุกหมวด</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border max-w-[200px]">
                        <option value="ALL">ทุก Action</option>
                        {actionTypes
                            .filter(a => categoryFilter === 'ALL' || getActionCategory(a).label === categoryFilter)
                            .sort()
                            .map(a => <option key={a} value={a}>{a}</option>)
                        }
                    </select>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-fg-tertiary">
                    <span>พบ {filtered.length.toLocaleString()} รายการ</span>
                    <span>·</span>
                    <span>หน้า {page}/{totalPages}</span>
                    {(search || actionFilter !== 'ALL' || categoryFilter !== 'ALL') && (
                        <button onClick={() => { setSearch(''); setActionFilter('ALL'); setCategoryFilter('ALL'); setPage(1); }}
                            className="text-fg-info hover:text-fg-primary ml-auto">
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
            </div>

            {/* Log List */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                {paged.length === 0 ? (
                    <div className="p-12 text-center">
                        <Eye className="w-8 h-8 text-fg-tertiary mx-auto mb-2" />
                        <p className="text-xs text-fg-tertiary">ไม่พบ log ที่ตรงกับการค้นหา</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[920px] w-full text-left">
                            <thead className="bg-bg-muted border-b border-border-subtle">
                                <tr>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Action</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Gang</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Actor</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Details</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {paged.map(log => {
                                    const cat = getActionCategory(log.action);
                                    const isExpanded = expandedId === log.id;
                                    const detail = parseDetails(log.details);
                                    const licenseLookupValue = getLicenseLookupValue(log);
                                    return (
                                        <Fragment key={log.id}>
                                            <tr key={log.id} className="hover:bg-bg-muted transition-colors">
                                                <td className="px-4 py-3">
                                                    <button
                                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                                        className="flex items-center gap-2 text-left"
                                                    >
                                                        <span className={`px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold border shrink-0 flex items-center gap-1 ${cat.color}`}>
                                                            {cat.icon}
                                                            {cat.label}
                                                        </span>
                                                        <span className="text-xs text-fg-primary font-medium">{log.action}</span>
                                                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-fg-tertiary" /> : <ChevronDown className="w-3.5 h-3.5 text-fg-tertiary" />}
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3 text-[9px] text-fg-tertiary truncate max-w-[180px]">{log.gangName ? `@ ${log.gangName}` : '-'}</td>
                                                <td className="px-4 py-3 text-[9px] text-fg-tertiary">{log.actorName}</td>
                                                <td className="px-4 py-3 text-[9px] text-fg-tertiary truncate max-w-[300px]">{detail || '-'}</td>
                                                <td className="px-4 py-3 text-right text-[9px] text-fg-tertiary tabular-nums whitespace-nowrap">
                                                    {new Date(log.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${log.id}-details`} className="bg-bg-muted">
                                                    <td colSpan={5} className="px-4 py-3 border-t border-border-subtle">
                                                        <div className="space-y-2">
                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                                                <div>
                                                                    <span className="text-fg-tertiary block mb-0.5">Log ID</span>
                                                                    <button onClick={() => copyId(log.id)} className="flex items-center gap-1 text-fg-secondary hover:text-fg-primary font-mono transition-colors">
                                                                        {log.id.slice(0, 16)}…
                                                                        {copiedId === log.id ? <Check className="w-3 h-3 text-fg-success" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                </div>
                                                                <div>
                                                                    <span className="text-fg-tertiary block mb-0.5">Actor ID</span>
                                                                    <button onClick={() => copyId(log.actorId)} className="flex items-center gap-1 text-fg-secondary hover:text-fg-primary font-mono transition-colors">
                                                                        {log.actorId.slice(0, 16)}{log.actorId.length > 16 ? '…' : ''}
                                                                        {copiedId === log.actorId ? <Check className="w-3 h-3 text-fg-success" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                </div>
                                                                <div>
                                                                    <span className="text-fg-tertiary block mb-0.5">Gang ID</span>
                                                                    <button onClick={() => copyId(log.gangId)} className="flex items-center gap-1 text-fg-secondary hover:text-fg-primary font-mono transition-colors">
                                                                        {log.gangId.slice(0, 12)}…
                                                                        {copiedId === log.gangId ? <Check className="w-3 h-3 text-fg-success" /> : <Copy className="w-3 h-3" />}
                                                                    </button>
                                                                </div>
                                                                {log.targetType && (
                                                                    <div>
                                                                        <span className="text-fg-tertiary block mb-0.5">Target</span>
                                                                        <span className="text-fg-secondary">{log.targetType}: {log.targetId?.slice(0, 12)}…</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                                                <Link
                                                                    href={`/admin/gangs?search=${encodeURIComponent(log.gangId)}`}
                                                                    className="inline-flex items-center gap-1 rounded-token-lg border border-status-info bg-status-info-subtle px-2.5 py-1 font-bold text-fg-info hover:brightness-110"
                                                                >
                                                                    เปิดเคสแก๊ง
                                                                    <ArrowRight className="w-3 h-3" />
                                                                </Link>
                                                                {(log.targetId || log.actorId) && (
                                                                    <Link
                                                                        href={`/admin/members?search=${encodeURIComponent(log.targetId || log.actorId)}`}
                                                                        className="inline-flex items-center gap-1 rounded-token-lg border border-status-info bg-status-info-subtle px-2.5 py-1 font-bold text-fg-info hover:brightness-110"
                                                                    >
                                                                        ค้นสมาชิกที่เกี่ยวข้อง
                                                                        <ArrowRight className="w-3 h-3" />
                                                                    </Link>
                                                                )}
                                                                {licenseLookupValue && (
                                                                    <Link
                                                                        href={`/admin/licenses?search=${encodeURIComponent(licenseLookupValue)}`}
                                                                        className="inline-flex items-center gap-1 rounded-token-lg border border-status-warning bg-status-warning-subtle px-2.5 py-1 font-bold text-fg-warning hover:brightness-110"
                                                                    >
                                                                        เปิดเคส license
                                                                        <ArrowRight className="w-3 h-3" />
                                                                    </Link>
                                                                )}
                                                            </div>
                                                            {(log.oldValue || log.newValue) && (
                                                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                                                    {log.oldValue && (
                                                                        <div>
                                                                            <span className="text-fg-danger block mb-0.5">ค่าเดิม</span>
                                                                            <pre className="text-[9px] text-fg-danger bg-status-danger-subtle border border-status-danger rounded-token-sm p-2 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">{log.oldValue}</pre>
                                                                        </div>
                                                                    )}
                                                                    {log.newValue && (
                                                                        <div>
                                                                            <span className="text-fg-success block mb-0.5">ค่าใหม่</span>
                                                                            <pre className="text-[9px] text-fg-success bg-status-success-subtle border border-status-success rounded-token-sm p-2 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">{log.newValue}</pre>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {log.details && (
                                                                <div className="text-[10px]">
                                                                    <span className="text-fg-tertiary block mb-0.5">รายละเอียด</span>
                                                                    <pre className="text-[9px] text-fg-secondary bg-bg-subtle border border-border-subtle rounded-token-sm p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">{log.details}</pre>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
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
