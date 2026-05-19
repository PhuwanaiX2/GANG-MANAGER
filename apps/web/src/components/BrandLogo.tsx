import type { HTMLAttributes, ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

type BrandMarkProps = ImgHTMLAttributes<HTMLImageElement> & {
    title?: string;
};

export function BrandMark({ className, title, ...props }: BrandMarkProps) {
    return (
        <img
            src="/brand/logov2.svg"
            alt={title || ''}
            decoding="async"
            className={cn('h-9 w-9 shrink-0 object-contain', className)}
            {...props}
        />
    );
}

type BrandLogoProps = HTMLAttributes<HTMLDivElement> & {
    showTagline?: boolean;
    tagline?: string;
    markClassName?: string;
    textClassName?: string;
    taglineClassName?: string;
};

export function BrandLogo({
    className,
    showTagline = true,
    tagline = 'ระบบจัดการแก๊ง',
    markClassName,
    textClassName,
    taglineClassName,
    ...props
}: BrandLogoProps) {
    return (
        <div className={cn('flex min-w-0 items-center gap-2.5', className)} {...props}>
            <BrandMark className={markClassName} />
            <div className="min-w-0">
                <span className={cn('block truncate font-heading text-[15px] font-black tracking-tight text-fg-primary', textClassName)}>
                    Gang<span className="text-fg-warning">Manager</span>
                </span>
                {showTagline ? (
                    <span className={cn('block truncate text-[10px] font-bold text-fg-tertiary', taglineClassName)}>
                        {tagline}
                    </span>
                ) : null}
            </div>
        </div>
    );
}
