export default function DashboardLoading() {
    return (
        <div className="animate-pulse space-y-8 relative z-10">
            {/* Header Skeleton */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3">
                    <div className="h-4 w-32 bg-white/5 rounded-full" />
                    <div className="h-10 w-64 bg-white/10 rounded-2xl" />
                    <div className="h-4 w-96 bg-white/5 rounded-full" />
                </div>
                <div className="h-11 w-36 bg-white/5 rounded-2xl" />
            </div>

            {/* Stats/Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-48 bg-white/5 rounded-[2.5rem] border border-white/5" />
                ))}
            </div>

            {/* Main Content Skeleton */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <div className="h-8 w-48 bg-white/5 rounded-xl" />
                    <div className="h-8 w-24 bg-white/5 rounded-xl" />
                </div>
                <div className="h-[400px] bg-white/5 rounded-[2.5rem] border border-white/5" />
            </div>
        </div>
    );
}
