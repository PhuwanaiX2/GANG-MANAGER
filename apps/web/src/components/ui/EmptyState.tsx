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
                'flex flex-col items-center justify-center text-center',
                compact ? 'py-6 px-4 gap-2' : 'py-12 px-6 gap-3',
                className
            )}
            {...rest}
        >
            {icon && (
                <div
                    className={cn(
                        'rounded-token-full bg-bg-muted text-fg-tertiary inline-flex items-center justify-center',
                        compact ? 'p-2' : 'p-3 mb-1'
                    )}
                >
                    {icon}
                </div>
            )}
            <h3 className={cn('font-bold text-fg-primary', compact ? 'text-sm' : 'text-lg')}>
                {title}
            </h3>
            {description && (
                <p
                    className={cn(
                        'text-fg-tertiary max-w-md',
                        compact ? 'text-xs' : 'text-sm'
                    )}
                >
                    {description}
                </p>
            )}
            {action && <div className={compact ? 'mt-1' : 'mt-3'}>{action}</div>}
        </div>
    );
}
