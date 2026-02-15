export default function SettingsLoading() {
    return (
        <div className="animate-pulse space-y-6">
            {/* Header */}
            <div className="space-y-2">
                <div className="h-4 w-24 bg-white/5 rounded-full" />
                <div className="h-10 w-36 bg-white/10 rounded-2xl" />
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-9 w-24 bg-white/5 rounded-lg" />
                ))}
            </div>

            {/* Settings Form */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 space-y-5">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <div className="h-3 w-24 bg-white/5 rounded" />
                        <div className="h-10 w-full bg-white/[0.03] rounded-xl border border-white/5" />
                    </div>
                ))}
                <div className="h-10 w-32 bg-white/10 rounded-xl mt-4" />
            </div>
        </div>
    );
}
