'use client';

import { useState, useMemo } from 'react';
import {
    Search,
    Activity,
    Shield,
    Clock,
    Filter,
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
    if (action.startsWith('ADMIN')) return { icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'ADMIN' };
    if (action.includes('TOGGLE') || action.includes('FEATURE')) return { icon: <Zap className="w-3.5 h-3.5" />, color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', label: 'FEATURE' };
    if (action.includes('MEMBER') || action.includes('JOIN') || action.includes('LEAVE') || action.includes('APPROVE') || action.includes('REJECT')) return { icon: <Users className="w-3.5 h-3.5" />, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', label: 'MEMBER' };
    if (action.includes('TRANSACTION') || action.includes('FINANCE') || action.includes('DEPOSIT') || action.includes('LOAN') || action.includes('FEE')) return { icon: <DollarSign className="w-3.5 h-3.5" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'FINANCE' };
    if (action.includes('ATTENDANCE') || action.includes('CHECK_IN')) return { icon: <Clock className="w-3.5 h-3.5" />, color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20', label: 'ATTEND' };
    if (action.includes('SETTING') || action.includes('UPDATE') || action.includes('CONFIG')) return { icon: <Settings className="w-3.5 h-3.5" />, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', label: 'SETTING' };
    if (action.includes('CREATE')) return { icon: <Zap className="w-3.5 h-3.5" />, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', label: 'CREATE' };
    if (action.includes('DELETE')) return { icon: <AlertTriangle className="w-3.5 h-3.5" />, color: 'bg-red-500/10 text-red-400 border-red-500/20', label: 'DELETE' };
    return { icon: <Activity className="w-3.5 h-3.5" />, color: 'bg-white/5 text-gray-400 border-white/10', label: 'OTHER' };
}

function parseDetails(details: string | null): string {
    if (!details) return '';
    try {
        const d = JSON.parse(details);
        return d.gangName || d.description || d.reason || JSON.stringify(d).slice(0, 100);
    } catch {
        return details.slice(0, 100);
    }
}

export function ActivityLog({ logs, stats, actionTypes }: { logs: LogData[]; stats: Stats; actionTypes: string[] }) {
    const [search, setSearch] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('ALL');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [page, setPage] = useState(1);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Group action types by category for filter
    const categories = useMemo(() => {
        const cats = new Set<string>();
        actionTypes.forEach(a => {
            const { label } = getActionCategory(a);
            cats.add(label);
        });
        return Array.from(cats).sort();
    }, [actionTypes]);

    const filtered = useMemo(() => {
        return logs.filter(log => {
            const q = search.toLowerCase();
            const matchSearch = !search ||
                log.action.toLowerCase().includes(q) ||
                log.actorName.toLowerCase().includes(q) ||
                (log.gangName && log.gangName.toLowerCase().includes(q)) ||
                log.actorId.includes(search) ||
                log.gangId.includes(search);
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
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Log ทั้งหมด</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.total.toLocaleString()}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">Admin Actions</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.adminActions.toLocaleString()}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3.5 h-3.5 text-yellow-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">วันนี้</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{stats.todayCount.toLocaleString()}</div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="ค้นหา action, ชื่อ, gang, ID..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                        />
                    </div>
                    <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setActionFilter('ALL'); setPage(1); }}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none">
                        <option value="ALL">ทุกหมวด</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}
                        className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none max-w-[200px]">
                        <option value="ALL">ทุก Action</option>
                        {actionTypes
                            .filter(a => categoryFilter === 'ALL' || getActionCategory(a).label === categoryFilter)
                            .sort()
                            .map(a => <option key={a} value={a}>{a}</option>)
                        }
                    </select>
                </div>
                <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-600">
                    <span>พบ {filtered.length.toLocaleString()} รายการ</span>
                    <span>·</span>
                    <span>หน้า {page}/{totalPages}</span>
                    {(search || actionFilter !== 'ALL' || categoryFilter !== 'ALL') && (
                        <button onClick={() => { setSearch(''); setActionFilter('ALL'); setCategoryFilter('ALL'); setPage(1); }}
                            className="text-blue-400 hover:text-blue-300 ml-auto">
                            ล้างตัวกรอง
                        </button>
                    )}
                </div>
            </div>

            {/* Log List */}
            <div className="bg-[#111] border border-white/5 rounded-2xl overflow-hidden">
                {paged.length === 0 ? (
                    <div className="p-12 text-center">
                        <Eye className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                        <p className="text-xs text-gray-600">ไม่พบ log ที่ตรงกับการค้นหา</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {paged.map(log => {
                            const cat = getActionCategory(log.action);
                            const isExpanded = expandedId === log.id;
                            const detail = parseDetails(log.details);
                            return (
                                <div key={log.id}>
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : log.id)}
                                        className="w-full px-4 py-3 flex items-start gap-3 hover:bg-white/[0.02] transition-colors text-left"
                                    >
                                        <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold border shrink-0 mt-0.5 flex items-center gap-1 ${cat.color}`}>
                                            {cat.icon}
                                            {cat.label}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-white font-medium">{log.action}</span>
                                                {log.gangName && (
                                                    <span className="text-[9px] text-gray-600 truncate">@ {log.gangName}</span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[9px] text-gray-500">{log.actorName}</span>
                                                {detail && <span className="text-[9px] text-gray-700 truncate max-w-[300px]">{detail}</span>}
                                            </div>
                                        </div>
                                        <div className="text-[9px] text-gray-600 shrink-0 tabular-nums text-right">
                                            {new Date(log.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </div>
                                        <div className="shrink-0 ml-1">
                                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-600" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-600" />}
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="px-4 py-3 bg-black/20 border-t border-white/5 space-y-2">
                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[10px]">
                                                <div>
                                                    <span className="text-gray-600 block mb-0.5">Log ID</span>
                                                    <button onClick={() => copyId(log.id)} className="flex items-center gap-1 text-gray-400 hover:text-white font-mono transition-colors">
                                                        {log.id.slice(0, 16)}…
                                                        {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 block mb-0.5">Actor ID</span>
                                                    <button onClick={() => copyId(log.actorId)} className="flex items-center gap-1 text-gray-400 hover:text-white font-mono transition-colors">
                                                        {log.actorId.slice(0, 16)}{log.actorId.length > 16 ? '…' : ''}
                                                        {copiedId === log.actorId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                <div>
                                                    <span className="text-gray-600 block mb-0.5">Gang ID</span>
                                                    <button onClick={() => copyId(log.gangId)} className="flex items-center gap-1 text-gray-400 hover:text-white font-mono transition-colors">
                                                        {log.gangId.slice(0, 12)}…
                                                        {copiedId === log.gangId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                                    </button>
                                                </div>
                                                {log.targetType && (
                                                    <div>
                                                        <span className="text-gray-600 block mb-0.5">Target</span>
                                                        <span className="text-gray-400">{log.targetType}: {log.targetId?.slice(0, 12)}…</span>
                                                    </div>
                                                )}
                                            </div>
                                            {(log.oldValue || log.newValue) && (
                                                <div className="grid grid-cols-2 gap-3 text-[10px]">
                                                    {log.oldValue && (
                                                        <div>
                                                            <span className="text-red-400/60 block mb-0.5">ค่าเดิม</span>
                                                            <pre className="text-[9px] text-red-400/80 bg-red-500/5 border border-red-500/10 rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">{log.oldValue}</pre>
                                                        </div>
                                                    )}
                                                    {log.newValue && (
                                                        <div>
                                                            <span className="text-emerald-400/60 block mb-0.5">ค่าใหม่</span>
                                                            <pre className="text-[9px] text-emerald-400/80 bg-emerald-500/5 border border-emerald-500/10 rounded p-2 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">{log.newValue}</pre>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                            {log.details && (
                                                <div className="text-[10px]">
                                                    <span className="text-gray-600 block mb-0.5">รายละเอียด</span>
                                                    <pre className="text-[9px] text-gray-400 bg-black/30 border border-white/5 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">{log.details}</pre>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
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
