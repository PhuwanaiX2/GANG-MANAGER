'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-bg text-fg-primary p-4">
            <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-fg-danger">เกิดข้อผิดพลาด</h2>
                <p className="text-fg-secondary max-w-md">
                    {error.message || 'มีบางอย่างผิดปกติ กรุณาลองใหม่'}
                </p>
                <button
                    onClick={() => reset()}
                    className="px-4 py-2 bg-accent text-fg-inverse rounded-token-md hover:brightness-110 transition-colors"
                >
                    ลองใหม่
                </button>
            </div>
        </div>
    );
}
