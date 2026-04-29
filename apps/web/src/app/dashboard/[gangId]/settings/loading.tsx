export default function SettingsLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-4 w-24 bg-bg-muted rounded-token-full" />
                <div className="h-10 w-36 bg-bg-muted rounded-token-2xl" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-9 w-24 bg-bg-muted rounded-token-lg" />
                ))}
            </div>

            {/* Settings Form */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2].map((panel) => (
                    <div key={panel} className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-6 shadow-token-sm">
                        <div className="flex items-center gap-2 border-b border-border-subtle pb-4 mb-5">
                            <div className="h-5 w-5 bg-bg-muted rounded-token-sm" />
                            <div className="h-5 w-36 bg-bg-muted rounded-token-sm" />
                        </div>
                        <div className="overflow-x-auto rounded-token-xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                            <div className="min-w-[560px]">
                                <div className="grid grid-cols-[1fr_1.5fr_80px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                                    <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                                    <div className="h-3 w-24 bg-bg-subtle rounded-token-sm" />
                                    <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-end" />
                                </div>
                                {[1, 2, 3, 4, 5].map((i) => (
                                    <div key={i} className="grid grid-cols-[1fr_1.5fr_80px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                        <div className="flex items-center gap-2">
                                            <div className="h-6 w-16 bg-bg-muted rounded-token-full" />
                                            <div className="h-3 w-24 bg-bg-muted rounded-token-sm" />
                                        </div>
                                        <div className="h-9 w-full bg-bg-muted rounded-token-lg border border-border-subtle" />
                                        <div className="h-4 w-10 bg-bg-muted rounded-token-sm justify-self-end" />
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
