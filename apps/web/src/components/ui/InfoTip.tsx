'use client';

import { HTMLAttributes, ReactNode, useState } from 'react';
import { Info } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface InfoTipProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'content'> {
    label?: string;
    content: ReactNode;
    side?: 'left' | 'right';
}

export function InfoTip({ label = 'Tip', content, side = 'right', className, ...rest }: InfoTipProps) {
    const [open, setOpen] = useState(false);

    return (
        <span
            className={cn('relative inline-flex align-middle', className)}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                    setOpen(false);
                }
            }}
            {...rest}
        >
            <button
                type="button"
                aria-label={typeof label === 'string' ? label : 'Tip'}
                aria-expanded={open}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-tertiary shadow-token-xs transition-colors hover:border-border hover:text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base"
            >
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span
                role="tooltip"
                className={cn(
                    'pointer-events-none absolute z-50 top-7 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-token-xl border border-border-subtle bg-bg-elevated px-3 py-2 text-left text-[11px] font-medium leading-relaxed text-fg-secondary opacity-0 shadow-token-lg transition-opacity duration-token-normal',
                    open && 'opacity-100',
                    side === 'right' ? 'left-0' : 'right-0'
                )}
            >
                <span className="mb-1 block text-[10px] font-bold text-accent-bright">
                    {label}
                </span>
                {content}
            </span>
        </span>
    );
}
