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
    INFO: { icon: <Info className="w-4 h-4" />, label: 'ข้อมูล', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    WARNING: { icon: <AlertTriangle className="w-4 h-4" />, label: 'เตือน', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' },
    CRITICAL: { icon: <AlertOctagon className="w-4 h-4" />, label: 'สำคัญ', color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    MAINTENANCE: { icon: <Wrench className="w-4 h-4" />, label: 'ปิดซ่อม', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
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
            <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Megaphone className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">ประกาศทั้งหมด</span>
                    </div>
                    <div className="text-xl font-black text-white tabular-nums">{announcements.length}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">กำลังแสดง</span>
                    </div>
                    <div className="text-xl font-black text-emerald-400 tabular-nums">{activeCount}</div>
                </div>
                <div className="bg-[#111] border border-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                        <XCircle className="w-3.5 h-3.5 text-gray-500" />
                        <span className="text-[9px] text-gray-500 font-bold uppercase">ปิดอยู่</span>
                    </div>
                    <div className="text-xl font-black text-gray-500 tabular-nums">{announcements.length - activeCount}</div>
                </div>
            </div>

            {/* Create Button / Form */}
            {!showForm ? (
                <button onClick={() => setShowForm(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-sm font-bold text-blue-400 hover:bg-blue-500/20 transition-colors">
                    <Plus className="w-4 h-4" />
                    สร้างประกาศใหม่
                </button>
            ) : (
                <div className="bg-[#111] border border-blue-500/20 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Plus className="w-4 h-4 text-blue-400" />
                            สร้างประกาศใหม่
                        </h3>
                        <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/5 rounded">
                            <X className="w-4 h-4 text-gray-500" />
                        </button>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">หัวข้อ</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                placeholder="เช่น: ปิดซ่อมระบบ 15 ก.พ."
                                className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">เนื้อหา</label>
                            <textarea
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                placeholder="รายละเอียดประกาศ..."
                                rows={3}
                                className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 resize-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">ประเภท</label>
                                <select value={type} onChange={e => setType(e.target.value)}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none">
                                    <option value="INFO">ข้อมูล (INFO)</option>
                                    <option value="WARNING">เตือน (WARNING)</option>
                                    <option value="CRITICAL">สำคัญ (CRITICAL)</option>
                                    <option value="MAINTENANCE">ปิดซ่อม (MAINTENANCE)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-gray-500 font-bold uppercase mb-1 block">หมดอายุ (ไม่บังคับ)</label>
                                <input
                                    type="datetime-local"
                                    value={expiresAt}
                                    onChange={e => setExpiresAt(e.target.value)}
                                    className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-xs text-gray-300 focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Preview */}
                    {title && (
                        <div>
                            <div className="text-[9px] text-gray-600 font-bold uppercase mb-1.5">Preview (จะแสดงบน Dashboard)</div>
                            <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${TYPE_CONFIG[type].bg} ${TYPE_CONFIG[type].border}`}>
                                <div className={TYPE_CONFIG[type].color}>{TYPE_CONFIG[type].icon}</div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-xs font-bold ${TYPE_CONFIG[type].color}`}>{title}</div>
                                    {content && <div className="text-[10px] text-gray-400 mt-0.5">{content}</div>}
                                </div>
                            </div>
                        </div>
                    )}

                    <button
                        onClick={handleCreate}
                        disabled={loading || !title.trim() || !content.trim()}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500 text-white text-xs font-bold rounded-lg hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                        {loading ? 'กำลังสร้าง...' : 'สร้างประกาศ'}
                    </button>
                </div>
            )}

            {/* Announcement List */}
            <div className="space-y-2">
                {announcements.length === 0 && (
                    <div className="bg-[#111] border border-white/5 rounded-2xl p-12 text-center">
                        <Megaphone className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                        <p className="text-xs text-gray-600">ยังไม่มีประกาศ</p>
                        <p className="text-[10px] text-gray-700 mt-1">กดปุ่มด้านบนเพื่อสร้างประกาศใหม่</p>
                    </div>
                )}
                {announcements.map(a => {
                    const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.INFO;
                    const isExpired = a.expiresAt && new Date(a.expiresAt) < new Date();
                    return (
                        <div key={a.id} className={`bg-[#111] border rounded-xl p-4 transition-colors ${a.isActive ? cfg.border : 'border-white/5 opacity-60'}`}>
                            <div className="flex items-start gap-3">
                                <div className={`p-1.5 rounded-lg shrink-0 ${cfg.bg} ${cfg.color}`}>
                                    {cfg.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-bold text-white">{a.title}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>{cfg.label}</span>
                                        {a.isActive ? (
                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">กำลังแสดง</span>
                                        ) : (
                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-gray-500/10 text-gray-500 border border-gray-500/20">ปิดอยู่</span>
                                        )}
                                        {isExpired && (
                                            <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-red-500/10 text-red-400 border border-red-500/20">หมดอายุ</span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{a.content}</p>
                                    <div className="flex items-center gap-3 mt-2 text-[9px] text-gray-600">
                                        <span>โดย {a.createdByName}</span>
                                        <span>·</span>
                                        <span>{new Date(a.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                                        {a.expiresAt && (
                                            <>
                                                <span>·</span>
                                                <span className="flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    หมดอายุ {new Date(a.expiresAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => handleToggle(a.id, a.isActive)}
                                        disabled={togglingId === a.id}
                                        className={`p-1.5 rounded-lg border transition-colors ${a.isActive ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white/5 border-white/10 text-gray-500 hover:bg-white/10'}`}
                                        title={a.isActive ? 'ปิดประกาศ' : 'เปิดประกาศ'}
                                    >
                                        {togglingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Power className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(a.id)}
                                        disabled={deletingId === a.id}
                                        className="p-1.5 rounded-lg border bg-red-500/5 border-red-500/10 text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                        title="ลบประกาศ"
                                    >
                                        {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
