export default function DashboardLoading() {
    return (
        <div className="animate-pulse space-y-6 sm:space-y-8 relative z-10">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-4 w-32 bg-white/5 rounded-full" />
                    <div className="h-9 sm:h-10 w-48 sm:w-64 bg-white/10 rounded-2xl" />
                    <div className="h-4 w-64 sm:w-96 bg-white/5 rounded-full" />
                </div>
                <div className="h-10 w-36 bg-white/5 rounded-2xl" />
            </div>

            {/* Stats/Cards Skeleton */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className={`h-36 sm:h-48 bg-white/[0.02] rounded-2xl sm:rounded-[2.5rem] border border-white/5 ${i === 3 ? 'sm:col-span-2 lg:col-span-1' : ''}`} />
                ))}
            </div>

            {/* Main Content Skeleton */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-7 sm:h-8 w-36 sm:w-48 bg-white/5 rounded-xl" />
                    <div className="h-7 sm:h-8 w-20 sm:w-24 bg-white/5 rounded-xl" />
                </div>
                <div className="h-[300px] sm:h-[400px] bg-white/[0.02] rounded-2xl sm:rounded-[2.5rem] border border-white/5" />
            </div>
        </div>
    );
}
