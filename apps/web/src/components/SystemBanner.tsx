'use client';

import { useState, useEffect } from 'react';
import { Info, AlertTriangle, AlertOctagon, Wrench, X } from 'lucide-react';

interface SystemAnnouncement {
    id: string;
    title: string;
    content: string;
    type: 'INFO' | 'WARNING' | 'CRITICAL' | 'MAINTENANCE';
    createdAt: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string; border: string; text: string }> = {
    INFO: { icon: <Info className="w-4 h-4" />, bg: 'bg-blue-500/5', border: 'border-blue-500/20', text: 'text-blue-400' },
    WARNING: { icon: <AlertTriangle className="w-4 h-4" />, bg: 'bg-yellow-500/5', border: 'border-yellow-500/20', text: 'text-yellow-400' },
    CRITICAL: { icon: <AlertOctagon className="w-4 h-4" />, bg: 'bg-red-500/5', border: 'border-red-500/20', text: 'text-red-400' },
    MAINTENANCE: { icon: <Wrench className="w-4 h-4" />, bg: 'bg-orange-500/5', border: 'border-orange-500/20', text: 'text-orange-400' },
};

export function SystemBanner() {
    const [announcements, setAnnouncements] = useState<SystemAnnouncement[]>([]);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetch('/api/system-announcements')
            .then(r => r.ok ? r.json() : [])
            .then(data => setAnnouncements(data))
            .catch(() => {});
    }, []);

    const visible = announcements.filter(a => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    return (
        <div className="space-y-2 mb-4">
            {visible.map(a => {
                const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.INFO;
                return (
                    <div key={a.id} className={`flex items-start gap-3 px-4 py-3 rounded-xl border ${cfg.bg} ${cfg.border}`}>
                        <div className={`shrink-0 mt-0.5 ${cfg.text}`}>{cfg.icon}</div>
                        <div className="flex-1 min-w-0">
                            <div className={`text-xs font-bold ${cfg.text}`}>{a.title}</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">{a.content}</div>
                        </div>
                        {a.type !== 'CRITICAL' && (
                            <button onClick={() => setDismissed(prev => new Set([...Array.from(prev), a.id]))}
                                className="shrink-0 p-1 hover:bg-white/5 rounded transition-colors">
                                <X className="w-3.5 h-3.5 text-gray-600" />
                            </button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
