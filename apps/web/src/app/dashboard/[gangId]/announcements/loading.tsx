export default function AnnouncementsLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-sm">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-bg-muted rounded-token-full" />
                    <div className="h-10 w-40 bg-bg-muted rounded-token-2xl" />
                </div>
            </div>

            {/* Announcement Cards */}
            <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                        <div className="grid grid-cols-[1fr_220px_140px_140px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-20 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-16 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-14 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-12 rounded-token-sm bg-bg-subtle" />
                        </div>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[1fr_220px_140px_140px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                <div className="space-y-2">
                                    <div className="h-4 w-64 rounded-token-md bg-bg-muted" />
                                    <div className="h-3 w-full rounded-token-sm bg-bg-muted opacity-70" />
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <div className="h-8 w-8 rounded-token-full bg-bg-muted" />
                                    <div className="space-y-1.5">
                                        <div className="h-3 w-24 rounded-token-sm bg-bg-muted" />
                                        <div className="h-2.5 w-16 rounded-token-sm bg-bg-muted opacity-70" />
                                    </div>
                                </div>
                                <div className="h-6 w-20 rounded-token-md bg-bg-muted" />
                                <div className="h-3 w-24 rounded-token-sm bg-bg-muted" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
