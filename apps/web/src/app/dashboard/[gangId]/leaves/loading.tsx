export default function LeavesLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-4 w-24 bg-white/5 rounded-full" />
                    <div className="h-10 w-44 bg-white/10 rounded-2xl" />
                </div>
                <div className="h-10 w-32 bg-white/10 rounded-2xl" />
            </div>

            {/* Leave Cards */}
            <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 sm:p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-white/5 shrink-0" />
                                <div className="space-y-1.5">
                                    <div className="h-4 w-32 bg-white/10 rounded" />
                                    <div className="h-3 w-48 bg-white/5 rounded" />
                                </div>
                            </div>
                            <div className="h-7 w-20 bg-white/5 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
