export default function MemberDetailLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header with Back Button Skeleton */}
            <div className="flex items-center gap-4 mb-2">
                <div className="w-10 h-10 rounded-xl bg-[#111] border border-white/5 shadow-sm" />
                <div className="space-y-2">
                    <div className="h-8 w-48 bg-[#111] rounded-lg" />
                    <div className="h-4 w-28 bg-[#0A0A0A] rounded-md" />
                </div>
            </div>

            {/* Member Summary Card Skeleton */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="text-center p-3 sm:p-4 rounded-xl bg-[#0A0A0A] border border-white/5 shadow-inner">
                            <div className="w-8 h-8 rounded-lg bg-[#111] mx-auto mb-2" />
                            <div className="h-3 w-16 bg-[#111] mx-auto rounded mb-2" />
                            <div className="h-6 w-24 bg-[#111] mx-auto rounded" />
                        </div>
                    ))}
                </div>
            </div>

            {/* Filter Tabs Skeleton */}
            <div className="flex gap-2.5 overflow-x-auto pb-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-9 w-24 rounded-xl bg-[#111] border border-white/5 shrink-0" />
                ))}
            </div>

            {/* Activity Timeline Skeleton */}
            <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="bg-[#111] border border-white/5 rounded-xl p-4 sm:p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-[#0A0A0A]" />
                                <div className="h-3 w-32 bg-[#0A0A0A] rounded" />
                            </div>
                            <div className="h-5 w-16 bg-[#0A0A0A] rounded-md" />
                        </div>
                        <div className="pl-1 flex items-center gap-3.5">
                            <div className="w-10 h-10 rounded-xl bg-[#0A0A0A]" />
                            <div className="flex-1 space-y-2">
                                <div className="h-4 w-48 bg-[#0A0A0A] rounded" />
                                <div className="h-3 w-32 bg-[#0A0A0A] rounded" />
                            </div>
                            <div className="h-6 w-20 bg-[#0A0A0A] rounded" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
