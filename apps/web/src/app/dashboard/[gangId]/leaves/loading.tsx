export default function LeavesLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-sm">
                <div className="space-y-2">
                    <div className="h-4 w-24 bg-bg-muted rounded-token-full" />
                    <div className="h-10 w-44 bg-bg-muted rounded-token-2xl" />
                </div>
            </div>

            {/* Leave Cards */}
            <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="overflow-x-auto">
                    <div className="min-w-[1100px]">
                        <div className="grid grid-cols-[220px_220px_1fr_140px_220px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-12 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-20 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-24 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-14 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-16 rounded-token-sm bg-bg-subtle justify-self-end" />
                        </div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[220px_220px_1fr_140px_220px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-token-full bg-bg-muted shrink-0" />
                                    <div className="space-y-1.5">
                                        <div className="h-4 w-32 rounded-token-md bg-bg-muted" />
                                        <div className="h-5 w-16 rounded-token-full bg-bg-muted" />
                                    </div>
                                </div>
                                <div className="h-4 w-44 rounded-token-sm bg-bg-muted" />
                                <div className="space-y-1.5">
                                    <div className="h-4 w-full rounded-token-sm bg-bg-muted" />
                                    <div className="h-3 w-36 rounded-token-sm bg-bg-muted opacity-70" />
                                </div>
                                <div className="h-3 w-24 rounded-token-sm bg-bg-muted" />
                                <div className="flex justify-end gap-2">
                                    <div className="h-8 w-20 rounded-token-lg bg-bg-muted" />
                                    <div className="h-8 w-20 rounded-token-lg bg-bg-muted" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
