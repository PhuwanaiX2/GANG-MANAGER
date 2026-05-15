function SkeletonBlock({ className = '' }: { className?: string }) {
    return <div className={`animate-pulse rounded-token-lg bg-bg-muted ${className}`} />;
}

export default function AttendanceSessionLoading() {
    return (
        <div className="space-y-4 animate-fade-in-up">
            <section className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex min-w-0 gap-4">
                        <SkeletonBlock className="h-14 w-14 shrink-0 rounded-token-full" />
                        <div className="min-w-0 flex-1 space-y-3">
                            <SkeletonBlock className="h-4 w-28" />
                            <SkeletonBlock className="h-8 w-64 max-w-full" />
                            <div className="flex flex-wrap gap-2">
                                <SkeletonBlock className="h-8 w-24" />
                                <SkeletonBlock className="h-8 w-36" />
                                <SkeletonBlock className="h-8 w-28" />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <SkeletonBlock className="h-11 w-28" />
                        <SkeletonBlock className="h-11 w-32" />
                    </div>
                </div>

                <div className="grid gap-3 border-t border-border-subtle p-4 sm:grid-cols-2 lg:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div key={index} className="rounded-token-xl border border-border-subtle bg-bg-muted p-3">
                            <SkeletonBlock className="mb-3 h-8 w-8" />
                            <SkeletonBlock className="h-3 w-20" />
                            <SkeletonBlock className="mt-3 h-7 w-16" />
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                    <div className="grid gap-3 border-b border-border-subtle bg-bg-muted p-4 lg:grid-cols-[minmax(220px,360px)_1fr]">
                        <SkeletonBlock className="h-11 w-full" />
                        <div className="flex gap-2 overflow-hidden">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <SkeletonBlock key={index} className="h-11 w-24 shrink-0" />
                            ))}
                        </div>
                    </div>
                    <div className="divide-y divide-border-subtle">
                        {Array.from({ length: 8 }).map((_, index) => (
                            <div key={index} className="grid gap-3 p-4 md:grid-cols-[minmax(220px,1fr)_120px_160px_160px] md:items-center">
                                <div className="flex items-center gap-3">
                                    <SkeletonBlock className="h-9 w-9 rounded-token-full" />
                                    <div className="min-w-0 flex-1 space-y-2">
                                        <SkeletonBlock className="h-4 w-40 max-w-full" />
                                        <SkeletonBlock className="h-3 w-24" />
                                    </div>
                                </div>
                                <SkeletonBlock className="h-8 w-24" />
                                <SkeletonBlock className="h-4 w-28" />
                                <SkeletonBlock className="h-10 w-full" />
                            </div>
                        ))}
                    </div>
                </div>

                <aside className="hidden space-y-4 xl:block">
                    <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                        <SkeletonBlock className="h-4 w-32" />
                        <div className="mt-4 space-y-3">
                            {Array.from({ length: 5 }).map((_, index) => (
                                <SkeletonBlock key={index} className="h-8 w-full" />
                            ))}
                        </div>
                    </div>
                    <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                        <SkeletonBlock className="h-4 w-28" />
                        <div className="mt-4 space-y-3">
                            {Array.from({ length: 4 }).map((_, index) => (
                                <SkeletonBlock key={index} className="h-16 w-full" />
                            ))}
                        </div>
                    </div>
                </aside>
            </section>
        </div>
    );
}
