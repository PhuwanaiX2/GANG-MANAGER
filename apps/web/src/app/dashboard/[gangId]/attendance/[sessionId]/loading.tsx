export default function AttendanceSessionLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Back + Header */}
            <div className="rounded-token-2xl border border-border-subtle bg-bg-subtle p-6 shadow-token-sm">
                <div className="h-4 w-20 bg-bg-muted rounded-token-sm" />
                <div className="space-y-2 mt-4">
                    <div className="h-8 w-56 bg-bg-muted rounded-token-xl" />
                    <div className="h-3 w-40 bg-bg-muted rounded-token-sm" />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="h-3 w-14 bg-bg-muted rounded-token-sm mb-2" />
                        <div className="h-7 w-12 bg-bg-muted rounded-token-lg" />
                    </div>
                ))}
            </div>

            {/* Member List */}
            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="p-5 border-b border-border-subtle bg-bg-muted">
                    <div className="h-5 w-36 bg-bg-subtle rounded-token-md" />
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[760px]">
                        <div className="grid grid-cols-[1.2fr_120px_130px_100px_160px] gap-4 border-b border-border-subtle bg-bg-muted px-5 py-4">
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm justify-self-end" />
                        </div>
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[1.2fr_120px_130px_100px_160px] items-center gap-4 border-b border-border-subtle px-5 py-3.5 last:border-b-0">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-token-full bg-bg-muted shrink-0" />
                                    <div className="space-y-1.5">
                                        <div className="h-3 w-28 bg-bg-muted rounded-token-sm" />
                                        <div className="h-2 w-20 bg-bg-muted rounded-token-sm" />
                                    </div>
                                </div>
                                <div className="h-6 w-16 bg-bg-muted rounded-token-full" />
                                <div className="h-3 w-20 bg-bg-muted rounded-token-sm" />
                                <div className="h-3 w-12 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="flex justify-end gap-2">
                                    <div className="h-7 w-12 bg-bg-muted rounded-token-md" />
                                    <div className="h-7 w-12 bg-bg-muted rounded-token-md" />
                                    <div className="h-7 w-12 bg-bg-muted rounded-token-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-bg-subtle border border-border-subtle rounded-token-2xl overflow-hidden shadow-token-sm">
                <div className="px-6 py-4 border-b border-border-subtle bg-bg-muted flex items-center gap-3">
                    <div className="w-10 h-10 rounded-token-xl bg-bg-subtle border border-border-subtle" />
                    <div className="space-y-1.5">
                        <div className="h-4 w-32 bg-bg-subtle rounded-token-sm" />
                        <div className="h-3 w-64 bg-bg-subtle rounded-token-sm" />
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[780px]">
                        <div className="grid grid-cols-[1fr_140px_170px_90px_150px] gap-4 border-b border-border-subtle bg-bg-muted px-5 py-3">
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-end" />
                        </div>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[1fr_140px_170px_90px_150px] items-center gap-4 border-b border-border-subtle px-5 py-3 last:border-b-0">
                                <div className="h-3 w-32 bg-bg-muted rounded-token-sm" />
                                <div className="h-6 w-24 bg-bg-muted rounded-token-md" />
                                <div className="h-6 w-32 bg-bg-muted rounded-token-md" />
                                <div className="h-3 w-10 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="h-3 w-28 bg-bg-muted rounded-token-sm justify-self-end" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
