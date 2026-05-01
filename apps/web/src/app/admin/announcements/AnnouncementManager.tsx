'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Megaphone,
    Plus,
    X,
    Info,
    AlertTriangle,
    AlertOctagon,
    Wrench,
    Power,
    Trash2,
    Loader2,
    Clock,
    CheckCircle2,
    XCircle,
} from 'lucide-react';

interface Announcement {
    id: string;
    title: string;
    content: string;
    type: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE';
    isActive: boolean;
    startsAt: string | null;
    expiresAt: string | null;
    createdBy: string;
    createdByName: string;
    createdAt: string;
    updatedAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string; bg: string; border: string }> = {
    INFO: { icon: <Info className="w-4 h-4" />, label: 'ข้อมูล', color: 'text-fg-info', bg: 'bg-status-info-subtle', border: 'border-status-info' },
    WARNING: { icon: <AlertTriangle className="w-4 h-4" />, label: 'เตือน', color: 'text-fg-warning', bg: 'bg-status-warning-subtle', border: 'border-status-warning' },
    CRITICAL: { icon: <AlertOctagon className="w-4 h-4" />, label: 'สำคัญ', color: 'text-fg-danger', bg: 'bg-status-danger-subtle', border: 'border-status-danger' },
    MAINTENANCE: { icon: <Wrench className="w-4 h-4" />, label: 'ปิดซ่อม', color: 'text-accent-bright', bg: 'bg-accent-subtle', border: 'border-border-accent' },
};

export function AnnouncementManager({ initialAnnouncements }: { initialAnnouncements: Announcement[] }) {
    const router = useRouter();
    const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(false);
    const [togglingId, setTogglingId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    // Form state
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState<string>('INFO');
    const [expiresAt, setExpiresAt] = useState('');

    const activeCount = announcements.filter(a => a.isActive).length;

    const handleCreate = async () => {
        if (!title.trim() || !content.trim()) return;
        setLoading(true);
        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: title.trim(), content: content.trim(), type, expiresAt: expiresAt || null }),
            });
            if (res.ok) {
                setTitle('');
                setContent('');
                setType('INFO');
                setExpiresAt('');
                setShowForm(false);
                router.refresh();
                // Optimistic: refetch
                const listRes = await fetch('/api/admin/announcements');
                if (listRes.ok) setAnnouncements(await listRes.json());
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (id: string, currentActive: boolean) => {
        setTogglingId(id);
        try {
            const res = await fetch('/api/admin/announcements', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, isActive: !currentActive }),
            });
            if (res.ok) {
                setAnnouncements(prev => prev.map(a => a.id === id ? { ...a, isActive: !currentActive } : a));
            }
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('ลบประกาศนี้ถาวร?')) return;
        setDeletingId(id);
        try {
            const res = await fetch(`/api/admin/announcements?id=${id}`, { method: 'DELETE' });
            if (res.ok) {
                setAnnouncements(prev => prev.filter(a => a.id !== id));
            }
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <Megaphone className="w-3.5 h-3.5 text-fg-info" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">ประกาศทั้งหมด</span>
                    </div>
                    <div className="text-xl font-black text-fg-primary tabular-nums">{announcements.length}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-fg-success" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">กำลังแสดง</span>
                    </div>
                    <div className="text-xl font-black text-fg-success tabular-nums">{activeCount}</div>
                </div>
                <div className="bg-bg-subtle border border-border-subtle rounded-token-xl p-3 shadow-token-sm">
                    <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-3.5 h-3.5 text-fg-tertiary" />
                        <span className="text-[9px] text-fg-tertiary font-bold uppercase">ปิดอยู่</span>
                    </div>
                    <div className="text-xl font-black text-fg-tertiary tabular-nums">{announcements.length - activeCount}</div>
                </div>
            </div>

            {/* Create Button / Form */}
            {!showForm ? (
                <button onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-status-info-subtle border border-status-info rounded-token-2xl text-sm font-bold text-fg-info hover:brightness-110 transition-colors shadow-token-sm">
                    <Plus className="w-4 h-4" />
                    สร้างประกาศใหม่
                </button>
            ) : (
                <div className="bg-bg-subtle border border-status-info rounded-token-2xl p-5 space-y-4 shadow-token-sm">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-fg-primary flex items-center gap-2">
                            <Plus className="w-4 h-4 text-fg-info" />
                            สร้างประกาศใหม่
                        </h3>
                        <button
                            onClick={() => setShowForm(false)}
                            className="p-1 hover:bg-bg-muted rounded-token-sm"
                            aria-label="Close announcement form"
                        >
                            <X className="w-4 h-4 text-fg-tertiary" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-fg-tertiary font-bold uppercase mb-1 block">หัวข้อ</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="เช่น: ปิดซ่อมระบบ 15 ก.พ."
                                className="w-full px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-fg-tertiary font-bold uppercase mb-1 block">เนื้อหา</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="รายละเอียดประกาศ..."
                                rows={3}
                                className="w-full px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-primary placeholder:text-fg-tertiary focus:outline-none focus:border-border resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-fg-tertiary font-bold uppercase mb-1 block">ประเภท</label>
                                <select value={type} onChange={e => setType(e.target.value)}
                                    className="w-full px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border">
                                    <option value="INFO">ข้อมูล (INFO)</option>
                                    <option value="WARNING">เตือน (WARNING)</option>
                                    <option value="CRITICAL">สำคัญ (CRITICAL)</option>
                                    <option value="MAINTENANCE">ปิดซ่อม (MAINTENANCE)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-fg-tertiary font-bold uppercase mb-1 block">หมดอายุ (ไม่บังคับ)</label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={e => setExpiresAt(e.target.value)}
                                    className="w-full px-3 py-2 bg-bg-muted border border-border-subtle rounded-token-lg text-xs text-fg-secondary focus:outline-none focus:border-border"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {title && (
                        <div>
                            <div className="text-[9px] text-fg-tertiary font-bold uppercase mb-1.5">Preview (จะแสดงบน Dashboard)</div>
                            <div className={`flex items-start gap-3 px-4 py-3 rounded-token-xl border ${TYPE_CONFIG[type].bg} ${TYPE_CONFIG[type].border}`}>
                                <div className={TYPE_CONFIG[type].color}>{TYPE_CONFIG[type].icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold ${TYPE_CONFIG[type].color}`}>{title}</div>
                                    {content && <div className="text-[10px] text-fg-secondary mt-0.5">{content}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleCreate}
                        disabled={loading || !title.trim() || !content.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-status-info text-fg-inverse text-xs font-bold rounded-token-lg hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                        {loading ? 'กำลังสร้าง...' : 'สร้างประกาศ'}
                    </button>
                </div>
            )}

            {/* Announcement List */}
            <div>
                {announcements.length === 0 ? (
                    <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-12 text-center shadow-token-sm">
                        <Megaphone className="w-8 h-8 text-fg-tertiary mx-auto mb-2" />
                        <p className="text-xs text-fg-tertiary">ยังไม่มีประกาศ</p>
                        <p className="text-[10px] text-fg-tertiary mt-1">กดปุ่มด้านบนเพื่อสร้างประกาศใหม่</p>
                    </div>
                ) : (
                    <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                        <div className="grid gap-3 p-4 md:hidden">
                            {announcements.map(a => {
                                const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.INFO;
                                const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();

                                return (
                                    <div key={a.id} className={`rounded-token-xl border p-4 shadow-token-sm ${a.isActive ? 'border-border-subtle bg-bg-muted/70' : 'border-border-subtle bg-bg-muted/40 opacity-70'}`}>
                                        <div className="flex items-start gap-3">
                                            <div className={`shrink-0 rounded-token-lg p-2 ${cfg.bg} ${cfg.color}`}>
                                                {cfg.icon}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <span className={`inline-flex rounded-token-sm border px-1.5 py-0.5 text-[8px] font-bold ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                                                    {a.isActive ? (
                                                        <span className="rounded-token-sm border border-status-success bg-status-success-subtle px-1.5 py-0.5 text-[8px] font-bold text-fg-success">กำลังแสดง</span>
                                                    ) : (
                                                        <span className="rounded-token-sm border border-border-subtle bg-bg-subtle px-1.5 py-0.5 text-[8px] font-bold text-fg-tertiary">ปิดอยู่</span>
                                                    )}
                                                    {isExpired && (
                                                        <span className="rounded-token-sm border border-status-danger bg-status-danger-subtle px-1.5 py-0.5 text-[8px] font-bold text-fg-danger">หมดอายุ</span>
                                                    )}
                                                </div>
                                                <p className="mt-2 line-clamp-2 text-sm font-bold text-fg-primary">{a.title}</p>
                                                <p className="mt-1 line-clamp-3 text-xs text-fg-secondary">{a.content}</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] text-fg-tertiary">
                                            <div className="rounded-token-lg bg-bg-subtle px-3 py-2">
                                                <p className="font-bold uppercase tracking-widest">Author</p>
                                                <p className="mt-1 truncate text-fg-secondary">{a.createdByName}</p>
                                            </div>
                                            <div className="rounded-token-lg bg-bg-subtle px-3 py-2">
                                                <p className="font-bold uppercase tracking-widest">Time</p>
                                                <p className="mt-1 text-fg-secondary tabular-nums">
                                                    {new Date(a.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </p>
                                            </div>
                                        </div>
                                        {a.expiresAt && (
                                            <div className="mt-2 inline-flex items-center gap-1 rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-[10px] text-fg-tertiary">
                                                <Clock className="h-3 w-3" />
                                                หมดอายุ {new Date(a.expiresAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                        <div className="mt-3 flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggle(a.id, a.isActive)}
                                                disabled={togglingId === a.id}
                                                className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-token-lg border px-3 py-2 text-xs font-bold transition-colors ${a.isActive ? 'bg-status-success-subtle border-status-success text-fg-success' : 'bg-bg-subtle border-border-subtle text-fg-tertiary'}`}
                                                aria-label={a.isActive ? 'Deactivate announcement' : 'Activate announcement'}
                                            >
                                                {togglingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                                                {a.isActive ? 'ปิด' : 'เปิด'}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(a.id)}
                                                disabled={deletingId === a.id}
                                                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-token-lg border border-status-danger bg-status-danger-subtle px-3 py-2 text-xs font-bold text-fg-danger"
                                                aria-label="Delete announcement"
                                            >
                                                {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                                ลบ
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-[860px] w-full text-left" aria-label="System announcements">
                            <thead className="bg-bg-muted border-b border-border-subtle">
                                <tr>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">ประกาศ</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Type</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Status</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">Author</th>
                                    <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Time</th>
                                    <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-fg-tertiary text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {announcements.map(a => {
                                    const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.INFO;
                                    const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
                                    return (
                                        <tr key={a.id} className={`hover:bg-bg-muted transition-colors ${a.isActive ? '' : 'opacity-60'}`}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={`p-1.5 rounded-token-lg shrink-0 ${cfg.bg} ${cfg.color}`}>
                                                        {cfg.icon}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-fg-primary truncate">{a.title}</div>
                                                        <p className="text-[10px] text-fg-secondary mt-1 line-clamp-2">{a.content}</p>
                                                        {a.expiresAt && (
                                                            <div className="mt-1 inline-flex items-center gap-1 text-[9px] text-fg-tertiary">
                                                                <Clock className="w-3 h-3" />
                                                                หมดอายุ {new Date(a.expiresAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {a.isActive ? (
                                                        <span className="px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold bg-status-success-subtle text-fg-success border border-status-success">กำลังแสดง</span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold bg-bg-muted text-fg-tertiary border border-border-subtle">ปิดอยู่</span>
                                                    )}
                                                    {isExpired && (
                                                        <span className="px-1.5 py-0.5 rounded-token-sm text-[8px] font-bold bg-status-danger-subtle text-fg-danger border border-status-danger">หมดอายุ</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-[9px] text-fg-tertiary">{a.createdByName}</td>
                                            <td className="px-4 py-3 text-right text-[9px] text-fg-tertiary tabular-nums whitespace-nowrap">
                                                {new Date(a.createdAt).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        onClick={() => handleToggle(a.id, a.isActive)}
                                                        disabled={togglingId === a.id}
                                                        className={`p-1.5 rounded-token-lg border transition-colors ${a.isActive ? 'bg-status-success-subtle border-status-success text-fg-success hover:brightness-110' : 'bg-bg-muted border-border-subtle text-fg-tertiary hover:bg-bg-subtle'}`}
                                                        title={a.isActive ? 'ปิดประกาศ' : 'เปิดประกาศ'}
                                                        aria-label={a.isActive ? 'Deactivate announcement' : 'Activate announcement'}
                                                    >
                                                        {togglingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(a.id)}
                                                        disabled={deletingId === a.id}
                                                        className="p-1.5 rounded-token-lg border bg-status-danger-subtle border-status-danger text-fg-danger hover:brightness-110 transition-colors"
                                                        title="ลบประกาศ"
                                                        aria-label="Delete announcement"
                                                    >
                                                        {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
