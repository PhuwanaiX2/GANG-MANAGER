export default function MemberDetailLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header with Back Button Skeleton */}
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-token-xl bg-bg-subtle border border-border-subtle shadow-token-sm" />
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-bg-subtle rounded-token-lg" />
                    <div className="h-4 w-28 bg-bg-muted rounded-token-md" />
                </div>
            </div>

            {/* Member Summary Card Skeleton */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 sm:p-6 shadow-token-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="text-center p-3 sm:p-4 rounded-token-xl bg-bg-muted border border-border-subtle shadow-inner">
                            <div className="w-8 h-8 rounded-token-lg bg-bg-subtle mx-auto mb-2" />
                            <div className="h-3 w-16 bg-bg-subtle mx-auto rounded-token-sm mb-2" />
                            <div className="h-6 w-24 bg-bg-subtle mx-auto rounded-token-sm" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Filter Tabs Skeleton */}
            <div className="flex gap-2.5 overflow-x-auto pb-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-9 w-24 rounded-token-xl bg-bg-subtle border border-border-subtle shrink-0" />
                ))}
            </div>

            {/* Activity Timeline Skeleton */}
            <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="overflow-x-auto">
                    <div className="min-w-[920px]">
                        <div className="grid grid-cols-[180px_150px_1fr] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-12 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-16 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-20 rounded-token-sm bg-bg-subtle" />
                        </div>
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="grid grid-cols-[180px_150px_1fr] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                <div className="flex items-center gap-2">
                                    <div className="h-3 w-3 rounded-token-full bg-bg-muted" />
                                    <div className="h-3 w-32 rounded-token-sm bg-bg-muted" />
                                </div>
                                <div className="h-6 w-20 rounded-token-md bg-bg-muted" />
                                <div className="flex items-center gap-3.5">
                                    <div className="h-10 w-10 rounded-token-xl bg-bg-muted" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-48 rounded-token-sm bg-bg-muted" />
                                        <div className="h-3 w-32 rounded-token-sm bg-bg-muted" />
                                    </div>
                                    <div className="h-6 w-20 rounded-token-sm bg-bg-muted" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
