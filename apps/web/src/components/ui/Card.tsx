import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type CardVariant = 'subtle' | 'elevated' | 'outlined' | 'glass';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

const variantStyles: Record<CardVariant, string> = {
    subtle: 'bg-bg-subtle border border-border-subtle',
    elevated: 'bg-bg-muted border border-border-subtle shadow-token-md',
    outlined: 'bg-transparent border border-border',
    glass: 'glass-panel',
};

const paddingStyles: Record<CardPadding, string> = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
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
                'rounded-token-xl transition-colors duration-token-normal ease-token-standard',
                variantStyles[variant],
                paddingStyles[padding],
                interactive && 'cursor-pointer hover:bg-bg-muted hover:border-border',
                className
            )}
            {...rest}
        >
            {children}
        </div>
    );
});
