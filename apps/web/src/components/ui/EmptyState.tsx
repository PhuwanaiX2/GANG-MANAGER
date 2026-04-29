import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    icon?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    compact?: boolean;
}

/**
 * Empty / zero-state placeholder. Presentation only.
 * Consumers pass the call-to-action button as `action`.
 */
export function EmptyState({
    icon,
    title,
    description,
    action,
    compact = false,
    className,
    ...rest
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                'relative flex flex-col items-center justify-center overflow-hidden rounded-token-2xl border border-dashed border-border-subtle bg-bg-subtle/58 text-center',
                compact ? 'py-6 px-4 gap-2' : 'py-12 px-6 gap-3',
                className
            )}
            {...rest}
        >
            <div className="pointer-events-none absolute -right-16 -top-16 h-36 w-36 rounded-token-full bg-accent-subtle blur-3xl" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border-accent to-transparent" />
            {icon && (
                <div
                    className={cn(
                        'relative rounded-token-full border border-border-subtle bg-bg-muted text-fg-secondary shadow-token-sm inline-flex items-center justify-center',
                        compact ? 'p-2' : 'p-3 mb-1'
                    )}
                >
                    {icon}
                </div>
            )}
            <h3 className={cn('relative font-heading font-black text-fg-primary', compact ? 'text-sm' : 'text-lg')}>
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        'relative text-fg-tertiary max-w-md leading-relaxed',
                        compact ? 'text-xs' : 'text-sm'
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className={cn('relative', compact ? 'mt-1' : 'mt-3')}>{action}</div>}
        </div>
    );
}
