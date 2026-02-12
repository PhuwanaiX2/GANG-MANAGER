'use client';

import { useEffect } from 'react';
import { logToDiscord } from '@/lib/discordLogger';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        logToDiscord('CRITICAL: Global Layout Error', error);
    }, [error]);

    return (
        <html>
            <body className="bg-black text-white">
                <div className="flex h-screen w-full flex-col items-center justify-center p-4">
                    <h2 className="text-2xl font-bold text-red-500">Critical Error</h2>
                    <p className="text-gray-400 my-4">A critical error occurred in the application.</p>
                    <button
                        onClick={() => reset()}
                        className="px-4 py-2 bg-blue-600 rounded-md hover:bg-blue-700 text-white"
                    >
                        Reload Application
                    </button>
                    <div className="mt-8 p-4 bg-gray-900 rounded border border-gray-800 text-left max-w-lg w-full overflow-auto text-sm font-mono text-red-300">
                        {error.message}
                    </div>
                </div>
            </body>
        </html>
    );
}
