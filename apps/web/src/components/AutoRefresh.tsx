'use client';

import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/** Drop this into any page to auto-refresh server data every N seconds. */
export function AutoRefresh({ interval = 30, enabled = true }: { interval?: number; enabled?: boolean }) {
    useAutoRefresh(interval, enabled);
    return null;
}
