export default function FinanceLoading() {
    return (
        <div className="animate-pulse space-y-6 sm:space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-6 w-36 bg-bg-muted rounded-token-full" />
                    <div className="h-10 w-48 bg-bg-muted rounded-token-2xl" />
                    <div className="flex gap-2">
                        <div className="h-9 w-24 bg-bg-muted rounded-token-lg" />
                        <div className="h-9 w-24 bg-bg-muted rounded-token-lg" />
                        <div className="h-9 w-24 bg-bg-muted rounded-token-lg" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-28 bg-bg-muted rounded-token-2xl" />
                    <div className="h-10 w-28 bg-bg-muted rounded-token-2xl" />
                </div>
            </div>

            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className={`p-5 sm:p-8 rounded-token-2xl sm:rounded-[2.5rem] border border-border-subtle shadow-token-sm ${i === 3 ? 'bg-bg-elevated sm:col-span-2 lg:col-span-1' : 'bg-bg-subtle'}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-token-lg bg-bg-muted" />
                            <div className="h-3 w-20 bg-bg-muted rounded-token-sm" />
                        </div>
                        <div className="h-9 w-40 bg-bg-muted rounded-token-xl mb-3" />
                        <div className="h-3 w-48 bg-bg-muted rounded-token-sm" />
                    </div>
                ))}
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-token-sm bg-bg-subtle" />
                        <div className="h-4 w-32 bg-bg-subtle rounded-token-sm" />
                    </div>
                    <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[980px]">
                        <div className="grid grid-cols-[140px_130px_190px_190px_1fr_70px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-8 bg-bg-subtle rounded-token-sm justify-self-end" />
                        </div>
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="grid grid-cols-[140px_130px_190px_190px_1fr_70px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                <div className="space-y-1.5">
                                    <div className="h-3 w-24 bg-bg-muted rounded-token-sm" />
                                    <div className="h-2 w-12 bg-bg-muted rounded-token-sm" />
                                </div>
                                <div className="h-7 w-24 bg-bg-muted rounded-token-md justify-self-end" />
                                <div className="flex items-center gap-3">
                                    <div className="h-2.5 w-28 bg-bg-muted rounded-token-full" />
                                    <div className="h-3 w-14 bg-bg-muted rounded-token-sm" />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="h-2.5 w-28 bg-bg-muted rounded-token-full" />
                                    <div className="h-3 w-14 bg-bg-muted rounded-token-sm" />
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    <div className="h-6 w-24 bg-bg-muted rounded-token-md" />
                                    <div className="h-6 w-28 bg-bg-muted rounded-token-md" />
                                    <div className="h-6 w-20 bg-bg-muted rounded-token-md" />
                                </div>
                                <div className="h-3 w-7 bg-bg-muted rounded-token-sm justify-self-end" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((panel) => (
                    <div key={panel} className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                        <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-token-sm bg-bg-subtle" />
                                <div className="h-4 w-32 bg-bg-subtle rounded-token-sm" />
                            </div>
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                        </div>
                        <div className="overflow-x-auto">
                            <div className="min-w-[620px]">
                                <div className="grid grid-cols-[1.2fr_110px_110px_120px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                                    <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                                    <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-end" />
                                    <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                                    <div className="h-3 w-16 bg-bg-subtle rounded-token-sm justify-self-end" />
                                </div>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="grid grid-cols-[1.2fr_110px_110px_120px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-8 h-8 rounded-token-lg bg-bg-muted shrink-0" />
                                            <div className="space-y-1.5 min-w-0">
                                                <div className="h-3 w-40 bg-bg-muted rounded-token-sm" />
                                                <div className="h-2 w-24 bg-bg-muted rounded-token-sm" />
                                            </div>
                                        </div>
                                        <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                        <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                        <div className="h-7 w-20 bg-bg-muted rounded-token-lg justify-self-end" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-token-sm bg-bg-subtle" />
                        <div className="h-4 w-36 bg-bg-subtle rounded-token-sm" />
                    </div>
                    <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[780px]">
                        <div className="grid grid-cols-[50px_1.2fr_110px_110px_110px_130px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-5 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm justify-self-end" />
                        </div>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="grid grid-cols-[50px_1.2fr_110px_110px_110px_130px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                <div className="h-3 w-4 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-token-full bg-bg-muted shrink-0" />
                                    <div className="space-y-1.5">
                                        <div className="h-3 w-28 bg-bg-muted rounded-token-sm" />
                                        <div className="h-1.5 w-32 bg-bg-muted rounded-token-full" />
                                    </div>
                                </div>
                                <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="h-7 w-24 bg-bg-muted rounded-token-md justify-self-end" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
