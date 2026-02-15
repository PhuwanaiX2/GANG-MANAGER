export default function AnalyticsLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-4 w-28 bg-white/5 rounded-full" />
                <div className="h-10 w-44 bg-white/10 rounded-2xl" />
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                        <div className="h-3 w-16 bg-white/5 rounded mb-3" />
                        <div className="h-8 w-24 bg-white/10 rounded-lg" />
                    </div>
                ))}
            </div>

            {/* Chart Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl h-72" />
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl h-72" />
            </div>
        </div>
    );
}
