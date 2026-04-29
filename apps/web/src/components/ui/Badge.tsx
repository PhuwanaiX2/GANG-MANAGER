import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'danger' | 'info';
export type BadgeVariant = 'soft' | 'solid' | 'outline';
export type BadgeSize = 'sm' | 'md';

const toneVariantStyles: Record<BadgeTone, Record<BadgeVariant, string>> = {
    neutral: {
        soft: 'bg-bg-muted text-fg-secondary',
        solid: 'bg-fg-secondary text-fg-inverse',
        outline: 'border border-border text-fg-secondary',
    },
    accent: {
        soft: 'bg-accent-subtle text-accent-bright',
        solid: 'bg-accent text-accent-fg',
        outline: 'border border-border-accent text-accent-bright',
    },
    success: {
        soft: 'bg-status-success-subtle text-fg-success',
        solid: 'bg-status-success text-fg-inverse',
        outline: 'border border-status-success text-fg-success',
    },
    warning: {
        soft: 'bg-status-warning-subtle text-fg-warning',
        solid: 'bg-status-warning text-fg-inverse',
        outline: 'border border-status-warning text-fg-warning',
    },
    danger: {
        soft: 'bg-status-danger-subtle text-fg-danger',
        solid: 'bg-status-danger text-fg-inverse',
        outline: 'border border-status-danger text-fg-danger',
    },
    info: {
        soft: 'bg-status-info-subtle text-fg-info',
        solid: 'bg-status-info text-fg-inverse',
        outline: 'border border-status-info text-fg-info',
    },
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-1 text-xs',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
    tone?: BadgeTone;
    variant?: BadgeVariant;
    size?: BadgeSize;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
    { tone = 'neutral', variant = 'soft', size = 'sm', className, children, ...rest },
    ref
) {
    return (
        <span
            ref={ref}
            className={cn(
                'inline-flex items-center gap-1 rounded-token-full font-bold tracking-wide whitespace-nowrap leading-none',
                toneVariantStyles[tone][variant],
                sizeStyles[size],
                className
            )}
            {...rest}
        >
            {children}
        </span>
    );
});
