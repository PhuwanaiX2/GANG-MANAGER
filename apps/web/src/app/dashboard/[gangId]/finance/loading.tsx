function Line({ className = '' }: { className?: string }) {
    return <div className={`rounded-token-full bg-bg-muted ${className}`} />;
}

function PanelSkeleton() {
    return (
        <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-muted px-4 py-3">
                <Line className="h-4 w-32 bg-bg-subtle" />
                <Line className="h-4 w-20 bg-bg-subtle" />
            </div>
            <div className="divide-y divide-border-subtle">
                {[0, 1, 2, 3, 4].map((item) => (
                    <div key={item} className="grid grid-cols-[1fr_auto] gap-4 px-4 py-3">
                        <div className="min-w-0 space-y-2">
                            <Line className="h-3 w-3/4" />
                            <Line className="h-2.5 w-1/2" />
                        </div>
                        <Line className="h-4 w-20" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function FinanceLoading() {
    return (
        <div className="animate-pulse space-y-4">
            <section className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:p-5">
                    <div className="min-w-0 space-y-3">
                        <Line className="h-6 w-32 bg-bg-elevated" />
                        <Line className="h-8 w-48" />
                        <div className="flex w-full gap-1 rounded-token-xl border border-border-subtle bg-bg-muted p-1 sm:w-fit">
                            <Line className="h-10 w-24 bg-bg-elevated" />
                            <Line className="h-10 w-24 bg-bg-elevated" />
                            <Line className="h-10 w-20 bg-bg-elevated" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                        <Line className="h-11 w-full bg-bg-elevated sm:w-28" />
                        <Line className="h-11 w-full bg-bg-elevated sm:w-32" />
                        <Line className="col-span-2 h-11 w-full bg-bg-elevated sm:w-36" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-border-subtle bg-bg-muted/50 p-3 xl:grid-cols-4">
                    {[0, 1, 2, 3].map((item) => (
                        <div key={item} className="rounded-token-xl border border-border-subtle bg-bg-elevated px-3 py-3 shadow-token-xs">
                            <Line className="h-3 w-20" />
                            <Line className="mt-3 h-6 w-28" />
                            <Line className="mt-2 h-3 w-16" />
                        </div>
                    ))}
                </div>
            </section>

            <section className="rounded-token-xl border border-border-subtle bg-bg-muted/80 px-4 py-3 shadow-token-xs">
                <div className="flex items-center gap-3">
                    <Line className="h-9 w-9 bg-bg-subtle" />
                    <div className="flex-1 space-y-2">
                        <Line className="h-3 w-28 bg-bg-subtle" />
                        <Line className="h-4 w-64 max-w-full bg-bg-subtle" />
                    </div>
                </div>
            </section>

            <div className="grid gap-4 lg:grid-cols-2">
                <PanelSkeleton />
                <PanelSkeleton />
            </div>
        </div>
    );
}
