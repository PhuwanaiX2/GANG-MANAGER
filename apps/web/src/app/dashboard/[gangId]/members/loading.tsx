export default function MembersLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-white/5 rounded-full" />
                    <div className="h-10 w-44 bg-white/10 rounded-2xl" />
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-40 bg-white/5 rounded-xl" />
                    <div className="h-10 w-10 bg-white/5 rounded-xl" />
                </div>
            </div>

            {/* Member Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-10 h-10 rounded-full bg-white/5" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-4 w-24 bg-white/10 rounded" />
                                <div className="h-2.5 w-16 bg-white/5 rounded" />
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <div className="h-6 w-16 bg-white/5 rounded-full" />
                            <div className="h-6 w-14 bg-white/5 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
