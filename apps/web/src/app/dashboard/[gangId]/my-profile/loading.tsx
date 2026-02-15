export default function MyProfileLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
                <div className="w-20 h-20 rounded-full bg-white/5" />
                <div className="space-y-2">
                    <div className="h-8 w-44 bg-white/10 rounded-xl" />
                    <div className="h-3 w-56 bg-white/5 rounded" />
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <div className="h-3 w-16 bg-white/5 rounded mb-2" />
                        <div className="h-7 w-20 bg-white/10 rounded-lg" />
                    </div>
                ))}
            </div>

            {/* Content */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-5 border-b border-white/5">
                    <div className="h-5 w-32 bg-white/10 rounded" />
                </div>
                <div className="divide-y divide-white/5">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                            <div className="w-8 h-8 rounded-lg bg-white/5 shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3 w-2/3 bg-white/5 rounded" />
                                <div className="h-2 w-1/4 bg-white/[0.03] rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
