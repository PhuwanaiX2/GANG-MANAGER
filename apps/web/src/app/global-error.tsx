'use client';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <html>
            <body className="bg-bg text-fg-primary">
                <div className="flex h-screen w-full flex-col items-center justify-center p-4">
                    <h2 className="text-2xl font-bold text-fg-danger">Critical Error</h2>
                    <p className="text-fg-secondary my-4">A critical error occurred in the application.</p>
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-status-info rounded-token-md hover:brightness-110 text-fg-inverse"
                    >
                        Reload Application
                    </button>
                    <div className="mt-8 p-4 bg-bg-subtle rounded-token-md border border-border-subtle text-left max-w-lg w-full overflow-auto text-sm font-mono text-fg-danger">
                        {error.message}
                    </div>
                </div>
            </body>
        </html>
    );
}
