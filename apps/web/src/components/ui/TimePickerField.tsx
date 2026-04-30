'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const FIVE_MINUTE_TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, index) => {
    const hour = Math.floor(index / 12);
    const minute = (index % 12) * 5;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

type TimePickerTone = 'neutral' | 'success' | 'warning' | 'danger';

interface TimePickerFieldProps {
    value: string;
    onChange: (value: string) => void;
    options?: string[];
    placeholder?: string;
    label?: string;
    testId?: string;
    tone?: TimePickerTone;
    allowClear?: boolean;
    className?: string;
}

const toneStyles: Record<TimePickerTone, { focus: string; selected: string; icon: string }> = {
    neutral: {
        focus: 'focus-visible:ring-border-strong',
        selected: 'border-border-strong bg-bg-elevated text-fg-primary',
        icon: 'text-fg-tertiary',
    },
    success: {
        focus: 'focus-visible:ring-status-success/50',
        selected: 'border-status-success bg-status-success-subtle text-fg-success',
        icon: 'text-fg-success',
    },
    warning: {
        focus: 'focus-visible:ring-status-warning/50',
        selected: 'border-status-warning bg-status-warning-subtle text-fg-warning',
        icon: 'text-fg-warning',
    },
    danger: {
        focus: 'focus-visible:ring-status-danger/50',
        selected: 'border-status-danger bg-status-danger-subtle text-fg-danger',
        icon: 'text-fg-danger',
    },
};

export function TimePickerField({
    value,
    onChange,
    options = FIVE_MINUTE_TIME_OPTIONS,
    placeholder = 'เลือกเวลา',
    label,
    testId,
    tone = 'neutral',
    allowClear = false,
    className,
}: TimePickerFieldProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);
    const selectedTone = toneStyles[tone];

    useEffect(() => {
        if (!open) return;

        const handlePointerDown = (event: PointerEvent) => {
            if (!rootRef.current?.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [open]);

    const displayValue = value || placeholder;

    return (
        <div ref={rootRef} className={cn('relative', className)}>
            <button
                type="button"
                data-testid={testId}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label || placeholder}
                onClick={() => setOpen((current) => !current)}
                className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 text-left text-sm font-black text-fg-primary shadow-inner outline-none transition-all hover:border-border-strong',
                    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
                    selectedTone.focus
                )}
            >
                <span className="inline-flex min-w-0 items-center gap-2">
                    <Clock3 className={cn('h-4 w-4 shrink-0', selectedTone.icon)} />
                    <span className={cn('truncate tabular-nums', !value && 'text-fg-tertiary')}>
                        {displayValue}
                    </span>
                </span>
                <span className="inline-flex items-center gap-1">
                    {allowClear && value && (
                        <span
                            role="button"
                            tabIndex={-1}
                            aria-label="ล้างเวลา"
                            onClick={(event) => {
                                event.stopPropagation();
                                onChange('');
                                setOpen(false);
                            }}
                            className="rounded-token-full border border-border-subtle bg-bg-subtle p-1 text-fg-tertiary transition-colors hover:text-fg-primary"
                        >
                            <X className="h-3.5 w-3.5" />
                        </span>
                    )}
                    <ChevronDown className={cn('h-4 w-4 text-fg-tertiary transition-transform', open && 'rotate-180')} />
                </span>
            </button>

            {open && (
                <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-token-2xl border border-border-subtle bg-bg-subtle shadow-token-lg">
                    <div className="flex items-center justify-between border-b border-border-subtle bg-bg-muted px-3 py-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                            24H Time
                        </span>
                        <span className="text-[10px] font-semibold text-fg-tertiary">
                            ทุก 5 นาที
                        </span>
                    </div>
                    <div role="listbox" className="grid max-h-72 grid-cols-4 gap-1 overflow-y-auto p-2 custom-scrollbar sm:grid-cols-6">
                        {options.map((time) => {
                            const selected = time === value;
                            return (
                                <button
                                    key={time}
                                    type="button"
                                    role="option"
                                    aria-selected={selected}
                                    onClick={() => {
                                        onChange(time);
                                        setOpen(false);
                                    }}
                                    className={cn(
                                        'inline-flex min-h-10 items-center justify-center gap-1 rounded-token-lg border border-transparent px-2 py-2 text-xs font-black tabular-nums text-fg-secondary transition-all hover:border-border hover:bg-bg-muted hover:text-fg-primary',
                                        selected && selectedTone.selected
                                    )}
                                >
                                    {selected && <Check className="h-3.5 w-3.5" />}
                                    {time}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
