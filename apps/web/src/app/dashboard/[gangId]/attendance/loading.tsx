export default function AttendanceLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-4 w-28 bg-white/5 rounded-full" />
                    <div className="h-10 w-48 bg-white/10 rounded-2xl" />
                </div>
                <div className="h-10 w-36 bg-white/10 rounded-2xl" />
            </div>

            {/* Session Cards */}
            <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-2">
                                <div className="h-5 w-48 bg-white/10 rounded" />
                                <div className="h-3 w-32 bg-white/5 rounded" />
                            </div>
                            <div className="flex gap-2">
                                <div className="h-7 w-16 bg-white/5 rounded-full" />
                                <div className="h-7 w-20 bg-white/5 rounded-full" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
