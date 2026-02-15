export default function FinanceLoading() {
    return (
        <div className="animate-pulse space-y-6 sm:space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-6 w-36 bg-white/5 rounded-full" />
                    <div className="h-10 w-48 bg-white/10 rounded-2xl" />
                    <div className="flex gap-2">
                        <div className="h-9 w-24 bg-white/5 rounded-lg" />
                        <div className="h-9 w-24 bg-white/5 rounded-lg" />
                        <div className="h-9 w-24 bg-white/5 rounded-lg" />
                    </div>
                </div>
                <div className="flex gap-2">
                    <div className="h-10 w-28 bg-white/5 rounded-2xl" />
                    <div className="h-10 w-28 bg-white/10 rounded-2xl" />
                </div>
            </div>

            {/* KPI Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className={`p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border border-white/5 ${i === 3 ? 'bg-white/[0.04] sm:col-span-2 lg:col-span-1' : 'bg-white/[0.02]'}`}>
                        <div className="flex items-center gap-2 mb-4">
                            <div className="w-8 h-8 rounded-lg bg-white/5" />
                            <div className="h-3 w-20 bg-white/5 rounded" />
                        </div>
                        <div className="h-9 w-40 bg-white/10 rounded-xl mb-3" />
                        <div className="h-3 w-48 bg-white/5 rounded" />
                    </div>
                ))}
            </div>

            {/* Content Area Skeleton */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left Panel */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center gap-2">
                        <div className="w-5 h-5 rounded bg-white/5" />
                        <div className="h-4 w-32 bg-white/10 rounded" />
                    </div>
                    <div className="divide-y divide-white/5">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-4">
                                <div className="w-9 h-9 rounded-full bg-white/5 shrink-0" />
                                <div className="flex-1 space-y-2">
                                    <div className="h-3 w-3/4 bg-white/5 rounded" />
                                    <div className="h-2 w-1/2 bg-white/[0.03] rounded" />
                                </div>
                                <div className="h-8 w-16 bg-white/5 rounded-lg shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Panel */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                    <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded bg-white/5" />
                            <div className="h-4 w-28 bg-white/10 rounded" />
                        </div>
                        <div className="h-3 w-16 bg-white/5 rounded" />
                    </div>
                    <div className="divide-y divide-white/5">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <div key={i} className="flex items-center gap-3 px-5 py-3">
                                <div className="w-7 h-7 rounded-lg bg-white/5 shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <div className="h-3 w-2/3 bg-white/5 rounded" />
                                    <div className="h-2 w-1/3 bg-white/[0.03] rounded" />
                                </div>
                                <div className="h-4 w-20 bg-white/5 rounded shrink-0" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
