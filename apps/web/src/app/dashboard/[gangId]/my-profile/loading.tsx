export default function MyProfileLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-sm">
                <div className="mb-3 h-6 w-28 rounded-token-full bg-bg-muted" />
                <div className="h-10 w-48 rounded-token-xl bg-bg-muted" />
                <div className="mt-3 h-4 w-full max-w-xl rounded-token-md bg-bg-muted" />
            </div>

            <div className="flex flex-col sm:flex-row gap-4 sm:items-center rounded-token-2xl border border-border-subtle bg-bg-subtle p-5 shadow-token-sm">
                <div className="w-20 h-20 rounded-token-2xl bg-bg-muted" />
                <div className="space-y-2">
                    <div className="h-8 w-44 bg-bg-muted rounded-token-xl" />
                    <div className="h-3 w-56 bg-bg-muted rounded-token-sm" />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="h-3 w-20 bg-bg-muted rounded-token-sm mb-3" />
                        <div className="h-7 w-24 bg-bg-muted rounded-token-lg" />
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted">
                    <div className="h-5 w-32 bg-bg-subtle rounded-token-md" />
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[920px]">
                        <div className="grid grid-cols-[180px_150px_1fr] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-12 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-16 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-20 rounded-token-sm bg-bg-subtle" />
                        </div>
                        {Array.from({ length: 6 }).map((_, i) => (
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
                                        <div className="h-3 w-32 rounded-token-sm bg-bg-muted opacity-70" />
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
