'use client';

import { Plus } from 'lucide-react';
import { OPEN_CREATE_EVENT } from './leaveEvents';

export function LeaveCreateButton({ className = '' }: { className?: string }) {
    return (
        <button
            type="button"
            onClick={() => window.dispatchEvent(new Event(OPEN_CREATE_EVENT))}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg bg-accent px-4 py-2.5 text-sm font-black text-accent-fg shadow-token-sm transition-colors hover:bg-accent-hover ${className}`}
        >
            <Plus className="h-4 w-4" />
            ส่งคำขอใหม่
        </button>
    );
}
