'use client';

import { useEffect } from 'react';

import { logToDiscord } from '@/lib/discordLogger';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to Discord
        logToDiscord('Uncaught Error in Page', error);
    }, [error]);

    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-black text-white p-4">
            <div className="text-center space-y-4">
                <h2 className="text-2xl font-bold text-red-500">Something went wrong!</h2>
                <p className="text-gray-400 max-w-md">
                    {error.message || 'An unexpected error occurred.'}
                </p>
                <button
                    onClick={() => reset()}
                    className="px-4 py-2 bg-discord-primary rounded-md hover:bg-discord-primary/80 transition-colors"
                >
                    Try again
                </button>
            </div>
        </div>
    );
}
