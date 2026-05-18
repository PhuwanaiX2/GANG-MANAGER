import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'subtle' | 'elevated' | 'outlined' | 'glass';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const variantStyles: Record<CardVariant, string> = {
    subtle: 'bg-bg-subtle/94 border border-border-subtle shadow-token-xs',
    elevated: 'bg-bg-muted/92 border border-border shadow-token-sm',
    outlined: 'bg-bg-subtle/35 border border-border',
    glass: 'glass-panel shadow-token-sm',
};

const paddingStyles: Record<CardPadding, string> = {
    none: '',
    sm: 'p-3.5 sm:p-4',
    md: 'p-4 sm:p-5',
    lg: 'p-5 sm:p-6',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
    variant?: CardVariant;
    padding?: CardPadding;
    interactive?: boolean;
}

/**
 * Base container primitive.
 * Purely presentational — do not add behavior here.
 * Theme entirely through `tailwind.config.js` + `globals.css` tokens.
 */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
    { variant = 'subtle', padding = 'md', interactive = false, className, children, ...rest },
    ref
) {
    return (
        <div
            ref={ref}
            className={cn(
                'rounded-token-lg transition-[background-color,border-color,box-shadow] duration-token-normal ease-token-standard',
                variantStyles[variant],
                paddingStyles[padding],
                interactive && 'cursor-pointer hover:bg-bg-muted hover:border-border-strong hover:shadow-token-sm',
                className
            )}
            {...rest}
        >
            {children}
        </div>
    );
});
