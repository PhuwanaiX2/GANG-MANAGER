export default function Loading() {
    return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-discord-primary rounded-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-gray-400 animate-pulse">กำลังโหลดข้อมูล...</p>
            </div>
        </div>
    );
}
