import type { CSSProperties, ReactNode } from 'react';

type RouteLoadingProps = {
    actions?: number;
    stats?: number;
    tabs?: number;
    children?: ReactNode;
};

type ListSkeletonProps = {
    rows?: number;
    columns?: 3 | 4 | 5;
};

function Skeleton({ className = '', style }: { className?: string; style?: CSSProperties }) {
    return <div className={`ops-skeleton rounded-token-md bg-bg-muted ${className}`} style={style} />;
}

export function RouteLoadingShell({ actions = 1, stats = 4, tabs = 0, children }: RouteLoadingProps) {
    return (
        <div aria-busy="true" className="min-w-0 space-y-4">
            <div className="ops-surface rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0 space-y-2">
                        <Skeleton className="h-3 w-24 rounded-token-full" />
                        <Skeleton className="h-8 w-48 max-w-[70vw] rounded-token-lg bg-bg-muted" />
                        <Skeleton className="h-3 w-72 max-w-full" />
                    </div>
                    {actions > 0 && (
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
                            {Array.from({ length: actions }).map((_, index) => (
                                <Skeleton key={index} className="h-10 min-w-0 bg-bg-muted sm:w-32" />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {tabs > 0 && (
                <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
                    {Array.from({ length: tabs }).map((_, index) => (
                        <Skeleton key={index} className="h-9 w-24 shrink-0 bg-bg-subtle" />
                    ))}
                </div>
            )}

            {stats > 0 && <MetricSkeletonGrid count={stats} />}

            {children ?? <ResponsiveListSkeleton />}
        </div>
    );
}

export function MetricSkeletonGrid({ count = 4 }: { count?: number }) {
    return (
        <div className="grid min-w-0 grid-cols-2 gap-2 lg:grid-cols-4">
            {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="min-w-0 rounded-token-xl border border-border-subtle bg-bg-subtle p-3 shadow-token-sm">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="mt-3 h-6 w-20 bg-bg-elevated" />
                    <Skeleton className="mt-2 h-2.5 w-12" />
                </div>
            ))}
        </div>
    );
}

export function DashboardCardSkeletonGrid({ cards = 2 }: { cards?: number }) {
    return (
        <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: cards }).map((_, index) => (
                <section key={index} className="min-w-0 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="flex min-w-0 items-start justify-between gap-4">
                        <div className="flex min-w-0 items-center gap-3">
                            <Skeleton className="h-10 w-10 shrink-0 rounded-token-lg bg-bg-elevated" />
                            <div className="min-w-0 space-y-2">
                                <Skeleton className="h-4 w-32 max-w-full bg-bg-elevated" />
                                <Skeleton className="h-3 w-20 bg-bg-elevated" />
                            </div>
                        </div>
                        <Skeleton className="h-8 w-8 shrink-0 rounded-token-full bg-bg-elevated" />
                    </div>
                    <div className="mt-4 border-t border-border-subtle pt-3">
                        <Skeleton className="h-3 w-28 bg-bg-elevated" />
                    </div>
                </section>
            ))}
        </div>
    );
}

export function ResponsiveListSkeleton({ rows = 6, columns = 4 }: ListSkeletonProps) {
    const desktopColumns = {
        3: 'grid-cols-[1fr_140px_140px]',
        4: 'grid-cols-[1fr_140px_140px_120px]',
        5: 'grid-cols-[1.2fr_120px_140px_120px_100px]',
    }[columns];

    return (
        <section className="min-w-0 overflow-hidden rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
            <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted px-4 py-3">
                <div className="min-w-0 space-y-1.5">
                    <Skeleton className="h-3 w-24 bg-bg-subtle" />
                    <Skeleton className="h-3 w-56 max-w-full bg-bg-subtle" />
                </div>
                <Skeleton className="hidden h-7 w-24 rounded-token-full bg-bg-subtle sm:block" />
            </div>

            <div className="grid gap-2 p-3 md:hidden">
                {Array.from({ length: Math.min(rows, 5) }).map((_, index) => (
                    <div key={index} className="min-w-0 rounded-token-lg border border-border-subtle bg-bg-muted/70 p-3">
                        <div className="flex min-w-0 items-start gap-3">
                            <Skeleton className="h-9 w-9 shrink-0 rounded-token-lg bg-bg-subtle" />
                            <div className="min-w-0 flex-1 space-y-2">
                                <Skeleton className="h-3.5 w-36 max-w-full bg-bg-subtle" />
                                <Skeleton className="h-2.5 w-48 max-w-full bg-bg-subtle" />
                            </div>
                            <Skeleton className="h-6 w-14 shrink-0 rounded-token-full bg-bg-subtle" />
                        </div>
                    </div>
                ))}
            </div>

            <div className="hidden md:block">
                <div className={`grid ${desktopColumns} gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3`}>
                    {Array.from({ length: columns }).map((_, index) => (
                        <Skeleton key={index} className="h-3 w-20 bg-bg-subtle" />
                    ))}
                </div>
                {Array.from({ length: rows }).map((_, index) => (
                    <div key={index} className={`grid ${desktopColumns} items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0`}>
                        <div className="flex min-w-0 items-center gap-3">
                            <Skeleton className="h-8 w-8 shrink-0 rounded-token-lg" />
                            <div className="min-w-0 space-y-1.5">
                                <Skeleton className="h-3.5 w-36 max-w-full" />
                                <Skeleton className="h-2.5 w-24" />
                            </div>
                        </div>
                        {Array.from({ length: columns - 1 }).map((__, cellIndex) => (
                            <Skeleton key={cellIndex} className="h-3.5 w-20" />
                        ))}
                    </div>
                ))}
            </div>
        </section>
    );
}

export function ChartSkeletonGrid({ panels = 2 }: { panels?: number }) {
    return (
        <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            {Array.from({ length: panels }).map((_, index) => (
                <section key={index} className="min-w-0 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-4 flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-7 w-20 rounded-token-full" />
                    </div>
                    <div className="flex h-56 items-end gap-2 rounded-token-lg border border-border-subtle bg-bg-muted/50 p-3">
                        {[48, 82, 64, 92, 56, 74, 68, 88].map((height, barIndex) => (
                            <div key={barIndex} className="flex flex-1 items-end">
                                <Skeleton className="w-full bg-bg-subtle" style={{ height: `${height}%` }} />
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}

export function FormPanelSkeleton({ panels = 2 }: { panels?: number }) {
    return (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {Array.from({ length: panels }).map((_, index) => (
                <section key={index} className="min-w-0 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                    <div className="mb-4 flex items-center gap-2 border-b border-border-subtle pb-3">
                        <Skeleton className="h-8 w-8 bg-bg-elevated" />
                        <Skeleton className="h-4 w-36" />
                    </div>
                    <div className="space-y-3">
                        {Array.from({ length: 5 }).map((_, rowIndex) => (
                            <div key={rowIndex} className="grid min-w-0 gap-2 sm:grid-cols-[140px_1fr] sm:items-center">
                                <Skeleton className="h-3 w-24" />
                                <Skeleton className="h-9 w-full bg-bg-elevated" />
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
