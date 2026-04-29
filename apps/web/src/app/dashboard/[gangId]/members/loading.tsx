export default function MembersLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-bg-muted rounded-token-full" />
                    <div className="h-10 w-44 bg-bg-subtle rounded-token-2xl" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-40 bg-bg-muted rounded-token-xl" />
                    <div className="h-10 w-10 bg-bg-muted rounded-token-xl" />
                </div>
            </div>

            {/* Member Cards Grid */}
            <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="flex items-center justify-between gap-3 border-b border-border-subtle bg-bg-muted px-5 py-3">
                    <div className="space-y-1.5">
                        <div className="h-3 w-24 rounded-token-sm bg-bg-subtle" />
                        <div className="h-3 w-72 rounded-token-sm bg-bg-subtle" />
                    </div>
                    <div className="hidden h-6 w-28 rounded-token-full bg-bg-subtle sm:block" />
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[920px]">
                        <div className="grid grid-cols-[35%_15%_20%_15%_10%_5%] border-b border-border-subtle bg-bg-muted px-5 py-4">
                            <div className="h-3 w-24 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-10 rounded-token-sm bg-bg-subtle justify-self-center" />
                            <div className="h-3 w-16 rounded-token-sm bg-bg-subtle" />
                            <div className="h-3 w-20 rounded-token-sm bg-bg-subtle justify-self-end" />
                            <div className="h-3 w-14 rounded-token-sm bg-bg-subtle justify-self-center" />
                            <div className="h-3 w-4 rounded-token-sm bg-bg-subtle justify-self-end" />
                        </div>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[35%_15%_20%_15%_10%_5%] items-center border-b border-border-subtle px-5 py-4 last:border-b-0">
                                <div className="flex items-center gap-4">
                                    <div className="h-11 w-11 rounded-token-full bg-bg-muted" />
                                    <div className="space-y-1.5">
                                        <div className="h-4 w-28 rounded-token-sm bg-bg-muted" />
                                        <div className="h-2.5 w-20 rounded-token-sm bg-bg-muted" />
                                    </div>
                                </div>
                                <div className="h-6 w-20 rounded-token-full bg-bg-muted justify-self-center" />
                                <div className="h-4 w-32 rounded-token-sm bg-bg-muted" />
                                <div className="space-y-1.5 justify-self-end">
                                    <div className="h-4 w-24 rounded-token-sm bg-bg-muted" />
                                    <div className="h-3 w-16 rounded-token-sm bg-bg-muted justify-self-end" />
                                </div>
                                <div className="h-6 w-16 rounded-token-full bg-bg-muted justify-self-center" />
                                <div className="h-8 w-8 rounded-token-lg bg-bg-muted justify-self-end" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
