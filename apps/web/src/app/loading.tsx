export default function Loading() {
    return (
        <div className="min-h-screen bg-bg-base text-fg-primary flex flex-col items-center justify-center p-4">
            <div data-testid="app-loading-state" className="flex flex-col items-center gap-4 rounded-token-2xl border border-border-subtle bg-bg-subtle p-8 shadow-token-sm">
                <div className="relative w-16 h-16">
                    <div className="absolute inset-0 border-4 border-border-subtle rounded-token-full"></div>
                    <div className="absolute inset-0 border-4 border-accent rounded-token-full border-t-transparent animate-spin"></div>
                </div>
                <div className="text-center">
                    <p className="font-heading text-sm font-bold text-fg-primary">กำลังโหลดข้อมูล</p>
                    <p className="mt-1 text-xs text-fg-tertiary">กำลังเตรียมแดชบอร์ดและสิทธิ์การใช้งานของคุณ</p>
                </div>
            </div>
        </div>
    );
}
