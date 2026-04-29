export default function Loading() {
    return (
        <div className="min-h-screen bg-bg text-fg-primary flex flex-col items-center justify-center p-4">
            <div className="flex flex-col items-center gap-4">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-border-subtle rounded-token-full"></div>
                    <div className="absolute inset-0 border-4 border-accent rounded-token-full border-t-transparent animate-spin"></div>
                </div>
                <p className="text-fg-secondary animate-pulse">กำลังโหลดข้อมูล...</p>
            </div>
        </div>
    );
}
