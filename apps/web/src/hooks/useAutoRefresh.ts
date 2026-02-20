'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Auto-refresh the current page data at a given interval (in seconds).
 * Uses Next.js router.refresh() to re-fetch server components.
 */
export function useAutoRefresh(intervalSeconds: number = 30) {
    const router = useRouter();

    useEffect(() => {
        const id = setInterval(() => {
            router.refresh();
        }, intervalSeconds * 1000);

        return () => clearInterval(id);
    }, [router, intervalSeconds]);
}
