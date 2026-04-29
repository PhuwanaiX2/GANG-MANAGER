export default function AttendanceLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-bg-muted rounded-token-full" />
                    <div className="h-10 w-48 bg-bg-subtle rounded-token-2xl" />
                </div>
                    <div className="h-10 w-36 bg-bg-subtle rounded-token-2xl" />
            </div>

            <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-bg-subtle border border-border-subtle rounded-token-2xl p-4 shadow-token-sm">
                        <div className="h-3 w-20 bg-bg-muted rounded-token-sm mb-3" />
                        <div className="h-7 w-14 bg-bg-muted rounded-token-lg" />
                    </div>
                ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex gap-2 bg-bg-subtle p-1 rounded-token-xl border border-border-subtle shadow-token-sm">
                    <div className="h-9 w-28 bg-bg-muted rounded-token-lg" />
                    <div className="h-9 w-28 bg-bg-muted rounded-token-lg" />
                </div>
                <div className="h-10 w-36 bg-bg-muted rounded-token-xl" />
            </div>

            <div className="overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-sm">
                <div className="overflow-x-auto">
                    <div className="min-w-[980px]">
                        <div className="grid grid-cols-[1.4fr_150px_110px_110px_110px_130px_100px] gap-4 border-b border-border-subtle bg-bg-muted px-4 py-3">
                            <div className="h-3 w-20 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-center" />
                            <div className="h-3 w-12 bg-bg-subtle rounded-token-sm justify-self-center" />
                            <div className="h-3 w-10 bg-bg-subtle rounded-token-sm justify-self-center" />
                            <div className="h-3 w-16 bg-bg-subtle rounded-token-sm justify-self-end" />
                            <div className="h-3 w-14 bg-bg-subtle rounded-token-sm justify-self-end" />
                        </div>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[1.4fr_150px_110px_110px_110px_130px_100px] items-center gap-4 border-b border-border-subtle px-4 py-3 last:border-b-0">
                                <div className="space-y-1.5">
                                    <div className="h-4 w-44 bg-bg-muted rounded-token-sm" />
                                    <div className="h-3 w-28 bg-bg-muted rounded-token-sm" />
                                </div>
                                <div className="h-6 w-20 bg-bg-muted rounded-token-full" />
                                <div className="h-4 w-10 bg-bg-muted rounded-token-sm justify-self-center" />
                                <div className="h-4 w-10 bg-bg-muted rounded-token-sm justify-self-center" />
                                <div className="h-4 w-10 bg-bg-muted rounded-token-sm justify-self-center" />
                                <div className="h-3 w-20 bg-bg-muted rounded-token-sm justify-self-end" />
                                <div className="h-8 w-20 bg-bg-muted rounded-token-lg justify-self-end" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
