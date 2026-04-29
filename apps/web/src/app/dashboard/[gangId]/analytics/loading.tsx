export default function AnalyticsLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-4 w-28 bg-bg-muted rounded-token-full" />
                <div className="h-10 w-44 bg-bg-muted rounded-token-2xl" />
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-5 shadow-token-sm">
                        <div className="h-3 w-16 bg-bg-muted rounded-token-sm mb-3" />
                        <div className="h-8 w-24 bg-bg-muted rounded-token-lg" />
                    </div>
                ))}
            </div>

            {/* Chart Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl h-72 shadow-token-sm" />
                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl h-72 shadow-token-sm" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[1, 2].map((panel) => (
                    <div key={panel} className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                        <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center gap-2">
                            <div className="w-5 h-5 rounded-token-sm bg-bg-subtle" />
                            <div className="h-4 w-36 bg-bg-subtle rounded-token-sm" />
                        </div>
                        <div className="overflow-x-auto">
                            <div className={panel === 1 ? 'min-w-[460px]' : 'min-w-[420px]'}>
                                <div className="grid grid-cols-[48px_1fr_100px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                                    <div className="h-3 w-4 bg-bg-subtle rounded-token-sm justify-self-end" />
                                    <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                                    <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                                </div>
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="grid grid-cols-[48px_1fr_100px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                        <div className="h-3 w-4 bg-bg-muted rounded-token-sm justify-self-end" />
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-7 h-7 rounded-token-full bg-bg-muted shrink-0" />
                                            <div className="space-y-1.5 min-w-0">
                                                <div className="h-3 w-28 bg-bg-muted rounded-token-sm" />
                                                {panel === 1 && <div className="h-2 w-32 bg-bg-muted rounded-token-sm" />}
                                            </div>
                                        </div>
                                        <div className="h-3 w-16 bg-bg-muted rounded-token-sm justify-self-end" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}

                <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                    <div className="p-5 border-b border-border-subtle bg-bg-muted flex items-center gap-2">
                        <div className="w-5 h-5 rounded-token-sm bg-bg-subtle" />
                        <div className="h-4 w-24 bg-bg-subtle rounded-token-sm" />
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="h-4 w-28 bg-bg-muted rounded-token-sm" />
                            <div className="h-6 w-12 bg-bg-muted rounded-token-lg" />
                        </div>
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className="h-3 w-20 bg-bg-muted rounded-token-sm" />
                                    <div className="h-3 w-8 bg-bg-muted rounded-token-sm" />
                                </div>
                                <div className="h-2 w-full bg-bg-muted rounded-token-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
