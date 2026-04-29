export default function DashboardLoading() {
    return (
        <div className="animate-pulse space-y-6 sm:space-y-8 relative z-10">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-4 w-32 bg-bg-muted rounded-token-full" />
                    <div className="h-9 sm:h-10 w-48 sm:w-64 bg-bg-subtle rounded-token-2xl" />
                    <div className="h-4 w-64 sm:w-96 bg-bg-muted rounded-token-full" />
                </div>
                <div className="h-10 w-36 bg-bg-muted rounded-token-2xl" />
            </div>

            {/* Stats/Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className={`h-36 sm:h-48 bg-bg-subtle rounded-token-2xl sm:rounded-[2.5rem] border border-border-subtle ${i === 3 ? 'sm:col-span-2 lg:col-span-1' : ''}`} />
                ))}
            </div>

            {/* Main Content Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {[1, 2].map((panel) => (
                    <div key={panel} className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                        <div className="px-5 py-3.5 border-b border-border-subtle flex items-center justify-between">
                            <div className="h-4 w-28 bg-bg-muted rounded-token-sm" />
                            <div className="h-3 w-16 bg-bg-muted rounded-token-sm" />
                        </div>
                        <div className="overflow-x-auto">
                            <div className={panel === 1 ? 'min-w-[520px]' : 'min-w-[620px]'}>
                                <div className={panel === 1 ? 'grid grid-cols-[1fr_90px_90px] gap-4 border-b border-border-subtle bg-bg-muted px-5 py-3' : 'grid grid-cols-[1fr_90px_110px] gap-4 border-b border-border-subtle bg-bg-muted px-5 py-3'}>
                                    <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                                    <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-center" />
                                    <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                                </div>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className={panel === 1 ? 'grid grid-cols-[1fr_90px_90px] items-center gap-4 border-b border-border-subtle px-5 py-3 last:border-b-0' : 'grid grid-cols-[1fr_90px_110px] items-center gap-4 border-b border-border-subtle px-5 py-3 last:border-b-0'}>
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={panel === 1 ? 'w-2 h-2 rounded-token-full bg-bg-muted shrink-0' : 'w-8 h-8 rounded-token-md bg-bg-muted shrink-0'} />
                                            <div className="space-y-1.5 min-w-0">
                                                <div className="h-3 w-36 bg-bg-muted rounded-token-sm" />
                                                {panel === 2 && <div className="h-2 w-24 bg-bg-muted rounded-token-sm" />}
                                            </div>
                                        </div>
                                        <div className="h-5 w-16 bg-bg-muted rounded-token-sm justify-self-center" />
                                        <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
