import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

const variantStyles: Record<ButtonVariant, string> = {
    primary:
        'bg-[var(--gradient-button-primary)] text-accent-fg border border-border-accent shadow-token-sm ring-1 ring-white/10 hover:brightness-110 hover:shadow-token-glow-accent active:brightness-95',
    secondary:
        'bg-bg-muted text-fg-primary border border-border-strong shadow-token-xs hover:bg-bg-elevated hover:border-border-accent',
    ghost:
        'bg-transparent text-fg-secondary hover:text-fg-primary hover:bg-bg-muted',
    danger:
        'bg-status-danger text-fg-inverse hover:brightness-110 active:brightness-95',
    outline:
        'bg-bg-subtle/70 text-fg-primary border border-border hover:border-border-strong hover:bg-bg-muted shadow-token-xs',
};

const sizeStyles: Record<ButtonSize, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
    icon: 'w-9 h-9 p-0',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    fullWidth?: boolean;
}

/**
 * Button primitive. Presentation only.
 * Consumers keep their own `onClick`, `type`, `disabled`, etc.
 * We never alter behavior here — only styling + loading affordance.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
    {
        variant = 'primary',
        size = 'md',
        loading = false,
        leftIcon,
        rightIcon,
        fullWidth = false,
        className,
        disabled,
        children,
        type = 'button',
        ...rest
    },
    ref
) {
    return (
        <button
            ref={ref}
            type={type}
            disabled={disabled || loading}
            className={cn(
                'inline-flex items-center justify-center gap-2 font-semibold rounded-token-lg whitespace-nowrap',
                'transition-[background-color,border-color,color,box-shadow,filter,transform] duration-token-normal ease-token-standard hover:-translate-y-0.5 active:translate-y-0',
                'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
                variantStyles[variant],
                sizeStyles[size],
                fullWidth && 'w-full',
                className
            )}
            {...rest}
        >
            {loading && (
                <svg className="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
            )}
            {!loading && leftIcon && <span className="shrink-0 inline-flex">{leftIcon}</span>}
            {children && <span className="inline-flex items-center">{children}</span>}
            {!loading && rightIcon && <span className="shrink-0 inline-flex">{rightIcon}</span>}
        </button>
    );
});
