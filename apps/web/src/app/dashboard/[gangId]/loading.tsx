function SkeletonBlock({ className }: { className: string }) {
    return <div className={`ops-skeleton rounded-token-md bg-bg-muted ${className}`} />;
}

function SmallMetricSkeleton() {
    return (
        <div className="ops-surface rounded-token-xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-3">
                    <SkeletonBlock className="h-3 w-20" />
                    <SkeletonBlock className="h-6 w-10" />
                    <SkeletonBlock className="h-3 w-28" />
                </div>
                <SkeletonBlock className="h-9 w-9 rounded-token-lg" />
            </div>
        </div>
    );
}

function QuickActionSkeleton() {
    return (
        <div className="rounded-token-lg border border-border-subtle bg-bg-surface p-4">
            <div className="flex items-center gap-3">
                <SkeletonBlock className="h-9 w-9 rounded-token-lg" />
                <div className="min-w-0 flex-1 space-y-2">
                    <SkeletonBlock className="h-4 w-28" />
                    <SkeletonBlock className="h-3 w-44 max-w-full" />
                </div>
                <SkeletonBlock className="h-5 w-5 rounded-full" />
            </div>
        </div>
    );
}

export default function DashboardLoading() {
    return (
        <div className="min-w-0 space-y-4" aria-busy="true" aria-label="Loading dashboard">
            <section className="ops-surface rounded-token-2xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm sm:p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                        <SkeletonBlock className="h-12 w-12 rounded-token-lg" />
                        <div className="min-w-0 space-y-2">
                            <SkeletonBlock className="h-3 w-28" />
                            <SkeletonBlock className="h-7 w-56 max-w-full" />
                            <SkeletonBlock className="h-3 w-72 max-w-full" />
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <SkeletonBlock className="h-10 w-24 rounded-token-lg" />
                        <SkeletonBlock className="h-10 w-24 rounded-token-lg" />
                    </div>
                </div>
            </section>

            <div className="grid min-w-0 gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <section className="ops-surface rounded-token-xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm sm:p-5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 space-y-2">
                            <SkeletonBlock className="h-3 w-20" />
                            <SkeletonBlock className="h-5 w-52 max-w-full" />
                            <SkeletonBlock className="h-3 w-80 max-w-full" />
                        </div>
                        <SkeletonBlock className="h-10 w-28 rounded-token-lg" />
                    </div>
                </section>

                <section className="ops-surface rounded-token-xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm sm:p-5">
                    <div className="space-y-3">
                        <SkeletonBlock className="h-3 w-20" />
                        <SkeletonBlock className="h-5 w-32" />
                        <SkeletonBlock className="h-10 w-full rounded-token-lg" />
                    </div>
                </section>
            </div>

            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <SmallMetricSkeleton />
                <SmallMetricSkeleton />
                <SmallMetricSkeleton />
            </div>

            <section className="ops-surface rounded-token-xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm sm:p-5">
                <div className="mb-4 space-y-2">
                    <SkeletonBlock className="h-3 w-20" />
                    <SkeletonBlock className="h-5 w-40" />
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                    <QuickActionSkeleton />
                    <QuickActionSkeleton />
                    <QuickActionSkeleton />
                </div>
            </section>
        </div>
    );
}
