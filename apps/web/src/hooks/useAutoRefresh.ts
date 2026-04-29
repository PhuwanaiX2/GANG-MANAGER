'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Auto-refresh the current page data at a given interval (in seconds).
 * Uses Next.js router.refresh() to re-fetch server components.
 */
export function useAutoRefresh(intervalSeconds: number = 30, enabled: boolean = true) {
    const router = useRouter();

    useEffect(() => {
        if (!enabled) {
            return;
        }

        const refresh = () => {
            router.refresh();
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };

        const id = setInterval(() => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        }, intervalSeconds * 1000);

        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearInterval(id);
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [router, intervalSeconds, enabled]);
}
