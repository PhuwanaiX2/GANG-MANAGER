import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type SectionHeaderLevel = 1 | 2 | 3;

export interface SectionHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    title: ReactNode;
    description?: ReactNode;
    icon?: ReactNode;
    action?: ReactNode;
    level?: SectionHeaderLevel;
    eyebrow?: ReactNode;
}

const levelStyles: Record<SectionHeaderLevel, string> = {
    1: 'text-3xl sm:text-4xl font-black tracking-tight',
    2: 'text-xl sm:text-2xl font-bold tracking-tight',
    3: 'text-base sm:text-lg font-bold',
};

/**
 * Heading + optional description + right-side action.
 * Purely presentational. Consumers provide the action as a ReactNode
 * (typically a <Button /> or a link).
 */
export function SectionHeader({
    title,
    description,
    icon,
    action,
    level = 2,
    eyebrow,
    className,
    ...rest
}: SectionHeaderProps) {
    const Heading: 'h1' | 'h2' | 'h3' = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';

    return (
        <div className={cn('flex items-start justify-between gap-4', className)} {...rest}>
            <div className="flex items-start gap-3 min-w-0 flex-1">
                {icon && (
                    <div className="shrink-0 mt-1 p-2 rounded-token-md bg-bg-muted text-fg-secondary">
                        {icon}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    {eyebrow && (
                        <div className="text-[10px] font-bold tracking-widest uppercase text-accent-bright mb-1">
                            {eyebrow}
                        </div>
                    )}
                    <Heading className={cn('text-fg-primary truncate', levelStyles[level])}>
                        {title}
                    </Heading>
                    {description && (
                        <p className="text-sm text-fg-tertiary mt-1 leading-relaxed">
                            {description}
                        </p>
                    )}
                </div>
            </div>
            {action && <div className="shrink-0">{action}</div>}
        </div>
    );
}
