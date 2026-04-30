'use client';

import { Clock3, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export const MINUTE_TIME_OPTIONS = Array.from({ length: 24 * 60 }, (_, index) => {
    const hour = Math.floor(index / 60);
    const minute = index % 60;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});

// Backward-compatible export for older imports/tests. The field itself now supports every minute.
export const FIVE_MINUTE_TIME_OPTIONS = MINUTE_TIME_OPTIONS;

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

const toneStyles: Record<TimePickerTone, { focus: string; icon: string; ring: string }> = {
    neutral: {
        focus: 'focus-within:border-border-strong',
        icon: 'text-fg-tertiary',
        ring: 'focus-within:ring-border-strong/30',
    },
    success: {
        focus: 'focus-within:border-status-success/70',
        icon: 'text-fg-success',
        ring: 'focus-within:ring-status-success/25',
    },
    warning: {
        focus: 'focus-within:border-status-warning/70',
        icon: 'text-fg-warning',
        ring: 'focus-within:ring-status-warning/25',
    },
    danger: {
        focus: 'focus-within:border-status-danger/70',
        icon: 'text-fg-danger',
        ring: 'focus-within:ring-status-danger/25',
    },
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const normalizeTime = (raw: string) => {
    const value = raw.trim();
    if (!value) return '';
    if (TIME_PATTERN.test(value)) return value;

    const compact = value.replace('.', ':');
    const [hourText, minuteText = '00'] = compact.split(':');
    const hour = Number(hourText);
    const minute = Number(minuteText);

    if (!Number.isInteger(hour) || !Number.isInteger(minute)) return value;
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return value;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export function TimePickerField({
    value,
    onChange,
    placeholder = 'เลือกเวลา',
    label,
    testId,
    tone = 'neutral',
    allowClear = false,
    className,
}: TimePickerFieldProps) {
    const selectedTone = toneStyles[tone];

    return (
        <div
            className={cn(
                'group relative flex w-full items-center gap-3 rounded-token-xl border border-border-subtle bg-bg-muted px-4 py-3 text-sm text-fg-primary shadow-inner transition-all',
                'hover:border-border-strong focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-offset-bg-base',
                selectedTone.focus,
                selectedTone.ring,
                className
            )}
        >
            <Clock3 className={cn('h-4 w-4 shrink-0', selectedTone.icon)} />
            <input
                type="time"
                lang="en-GB"
                data-testid={testId}
                aria-label={label || placeholder}
                title={label || placeholder}
                value={value}
                step={60}
                onChange={(event) => onChange(event.target.value)}
                onBlur={(event) => {
                    const normalized = normalizeTime(event.target.value);
                    if (normalized !== event.target.value) {
                        onChange(normalized);
                    }
                }}
                className={cn(
                    'min-w-0 flex-1 appearance-none bg-transparent font-black tabular-nums text-fg-primary outline-none',
                    'placeholder:text-fg-tertiary [color-scheme:inherit] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-70'
                )}
                placeholder={placeholder}
            />
            {allowClear && value && (
                <button
                    type="button"
                    aria-label="ล้างเวลา"
                    onClick={() => onChange('')}
                    className="rounded-token-full border border-border-subtle bg-bg-subtle p-1 text-fg-tertiary transition-colors hover:text-fg-primary"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            )}
        </div>
    );
}
