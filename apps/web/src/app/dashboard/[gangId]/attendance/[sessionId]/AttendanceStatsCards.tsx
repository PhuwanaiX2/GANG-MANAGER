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
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2.5 shadow-token-sm transition-colors hover:border-border sm:p-3" data-testid="attendance-stat-total-card">
                <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-token-lg border border-border-subtle bg-bg-muted sm:h-8 sm:w-8">
                        <Users className="h-3.5 w-3.5 text-fg-tertiary sm:h-4 sm:w-4" />
                    </div>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary sm:text-[10px]">ทั้งหมด</span>
                </div>
                <p data-testid="attendance-stat-total-value" className="text-lg font-black tracking-tight text-fg-primary tabular-nums sm:text-xl">{stats.total}</p>
            </div>
            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2.5 shadow-token-sm transition-colors hover:border-border sm:p-3" data-testid="attendance-stat-present-card">
                <div>
                    <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-token-lg border border-status-success bg-status-success-subtle sm:h-8 sm:w-8">
                            <CheckCircle2 className="h-3.5 w-3.5 text-fg-success sm:h-4 sm:w-4" />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary text-shadow-sm sm:text-[10px]">มา</span>
                    </div>
                    <p data-testid="attendance-stat-present-value" className="text-lg font-black tracking-tight text-fg-success tabular-nums sm:text-xl">{stats.present}</p>
                </div>
            </div>
            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2.5 shadow-token-sm transition-colors hover:border-border sm:p-3" data-testid="attendance-stat-absent-card">
                <div>
                    <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-token-lg border border-status-danger bg-status-danger-subtle sm:h-8 sm:w-8">
                            <XCircle className="h-3.5 w-3.5 text-fg-danger sm:h-4 sm:w-4" />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary text-shadow-sm sm:text-[10px]">ขาด</span>
                    </div>
                    <p data-testid="attendance-stat-absent-value" className="text-lg font-black tracking-tight text-fg-danger tabular-nums sm:text-xl">{stats.absent}</p>
                </div>
            </div>
            <div className="rounded-token-xl border border-border-subtle bg-bg-subtle p-2.5 shadow-token-sm transition-colors hover:border-border sm:p-3" data-testid="attendance-stat-leave-card">
                <div>
                    <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-token-lg border border-status-info bg-status-info-subtle sm:h-8 sm:w-8">
                            <FileText className="h-3.5 w-3.5 text-fg-info sm:h-4 sm:w-4" />
                        </div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-fg-tertiary text-shadow-sm sm:text-[10px]">ลา</span>
                    </div>
                    <p data-testid="attendance-stat-leave-value" className="text-lg font-black tracking-tight text-fg-info tabular-nums sm:text-xl">{stats.leave}</p>
                </div>
            </div>
        </div>
    );
}
