'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Users, XCircle } from 'lucide-react';

export interface AttendanceStats {
    total: number;
    present: number;
    absent: number;
    leave: number;
}

export const ATTENDANCE_STATS_UPDATE_EVENT = 'attendance-stats:update';

export function AttendanceStatsCards({ initialStats }: { initialStats: AttendanceStats }) {
    const [stats, setStats] = useState(initialStats);

    useEffect(() => {
        setStats(initialStats);
    }, [initialStats]);

    useEffect(() => {
        const handleStatsUpdate = (event: Event) => {
            const nextStats = (event as CustomEvent<AttendanceStats>).detail;
            if (nextStats) {
                setStats(nextStats);
            }
        };

        window.addEventListener(ATTENDANCE_STATS_UPDATE_EVENT, handleStatsUpdate);
        return () => window.removeEventListener(ATTENDANCE_STATS_UPDATE_EVENT, handleStatsUpdate);
    }, []);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-total-card">
                <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-token-lg bg-bg-muted border border-border-subtle">
                        <Users className="w-4 h-4 text-fg-tertiary" />
                    </div>
                    <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest">ทั้งหมด</span>
                </div>
                <p data-testid="attendance-stat-total-value" className="text-3xl font-black text-fg-primary tabular-nums tracking-tight">{stats.total}</p>
            </div>
            <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-present-card">
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-token-full blur-3xl opacity-70 bg-status-success-subtle" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-token-lg bg-status-success-subtle border border-status-success">
                            <CheckCircle2 className="w-4 h-4 text-fg-success" />
                        </div>
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">มา</span>
                    </div>
                    <p data-testid="attendance-stat-present-value" className="text-3xl font-black text-fg-success tabular-nums tracking-tight">{stats.present}</p>
                </div>
            </div>
            <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-absent-card">
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-token-full blur-3xl opacity-70 bg-status-danger-subtle" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-token-lg bg-status-danger-subtle border border-status-danger">
                            <XCircle className="w-4 h-4 text-fg-danger" />
                        </div>
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">ขาด</span>
                    </div>
                    <p data-testid="attendance-stat-absent-value" className="text-3xl font-black text-fg-danger tabular-nums tracking-tight">{stats.absent}</p>
                </div>
            </div>
            <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 overflow-hidden shadow-token-sm hover:border-border transition-colors" data-testid="attendance-stat-leave-card">
                <div className="absolute -top-10 -right-10 w-24 h-24 rounded-token-full blur-3xl opacity-70 bg-status-info-subtle" />
                <div className="relative">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="p-2 rounded-token-lg bg-status-info-subtle border border-status-info">
                            <FileText className="w-4 h-4 text-fg-info" />
                        </div>
                        <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-widest text-shadow-sm">ลา</span>
                    </div>
                    <p data-testid="attendance-stat-leave-value" className="text-3xl font-black text-fg-info tabular-nums tracking-tight">{stats.leave}</p>
                </div>
            </div>
        </div>
    );
}
