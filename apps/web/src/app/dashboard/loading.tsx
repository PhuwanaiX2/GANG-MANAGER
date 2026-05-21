function SkeletonBlock({ className }: { className: string }) {
    return <div className={`ops-skeleton rounded-token-md bg-bg-muted ${className}`} />;
}

function GangCardSkeleton() {
    return (
        <div className="ops-surface rounded-token-xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                    <SkeletonBlock className="h-11 w-11 rounded-token-lg" />
                    <div className="min-w-0 space-y-2">
                        <SkeletonBlock className="h-5 w-36 max-w-full" />
                        <SkeletonBlock className="h-4 w-20" />
                    </div>
                </div>
                <SkeletonBlock className="h-10 w-10 rounded-full" />
            </div>
            <div className="mt-4 border-t border-border-subtle pt-3">
                <div className="flex items-center justify-between gap-3">
                    <SkeletonBlock className="h-4 w-20" />
                    <SkeletonBlock className="h-4 w-32" />
                </div>
            </div>
        </div>
    );
}

export default function DashboardIndexLoading() {
    return (
        <div className="min-w-0 space-y-4" aria-busy="true" aria-label="Loading gang selector">
            <div className="grid min-w-0 gap-4 lg:grid-cols-[1.5fr_0.75fr]">
                <section className="ops-surface rounded-token-2xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm sm:p-5">
                    <div className="space-y-3">
                        <SkeletonBlock className="h-5 w-40" />
                        <SkeletonBlock className="h-8 w-48 max-w-full" />
                        <SkeletonBlock className="h-4 w-80 max-w-full" />
                    </div>
                </section>
                <section className="ops-surface rounded-token-xl border border-border-subtle bg-bg-surface p-4 shadow-token-sm sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-3">
                            <SkeletonBlock className="h-4 w-28" />
                            <SkeletonBlock className="h-7 w-8" />
                            <SkeletonBlock className="h-3 w-48 max-w-full" />
                        </div>
                        <SkeletonBlock className="h-11 w-11 rounded-token-lg" />
                    </div>
                </section>
            </div>

            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <GangCardSkeleton />
                <GangCardSkeleton />
            </div>
        </div>
    );
}
