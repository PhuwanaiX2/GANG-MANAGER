import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type StatTone = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'accent';

const toneIcon: Record<StatTone, string> = {
    default: 'bg-bg-muted text-fg-secondary',
    success: 'bg-status-success-subtle text-fg-success',
    warning: 'bg-status-warning-subtle text-fg-warning',
    danger: 'bg-status-danger-subtle text-fg-danger',
    info: 'bg-status-info-subtle text-fg-info',
    accent: 'bg-accent-subtle text-accent-bright',
};

const toneValue: Record<StatTone, string> = {
    default: 'text-fg-primary',
    success: 'text-fg-success',
    warning: 'text-fg-warning',
    danger: 'text-fg-danger',
    info: 'text-fg-info',
    accent: 'text-accent-bright',
};

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
    label: string;
    value: ReactNode;
    icon?: ReactNode;
    description?: ReactNode;
    tone?: StatTone;
}

/**
 * Metric card primitive. Pure presentation.
 * Use this everywhere a "label + value" summary appears.
 */
export const Stat = forwardRef<HTMLDivElement, StatProps>(function Stat(
    { label, value, icon, description, tone = 'default', className, ...rest },
    ref
) {
    return (
        <div
            ref={ref}
            className={cn(
                'relative overflow-hidden bg-bg-subtle/92 border border-border-subtle rounded-token-xl p-4 flex flex-col gap-1.5 shadow-token-xs',
                'transition-[border-color,box-shadow] duration-token-normal ease-token-standard hover:border-border hover:shadow-token-sm',
                className
            )}
            {...rest}
        >
            <div className="flex items-center gap-2">
                {icon && (
                    <span
                        className={cn(
                            'p-1.5 rounded-token-md inline-flex items-center justify-center shrink-0',
                            toneIcon[tone]
                        )}
                    >
                        {icon}
                    </span>
                )}
                <span className="text-[10px] font-bold tracking-widest uppercase text-fg-tertiary">
                    {label}
                </span>
            </div>
            <div className={cn('text-xl font-black tabular-nums leading-none sm:text-2xl', toneValue[tone])}>
                {value}
            </div>
            {description && (
                <div className="text-xs text-fg-tertiary leading-snug">
                    {description}
                </div>
            )}
        </div>
    );
});
