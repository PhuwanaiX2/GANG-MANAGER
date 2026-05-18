import { cn } from '@/lib/cn';

type AvatarProps = {
    src?: string | null;
    name?: string | null;
    alt?: string;
    className?: string;
    fallbackClassName?: string;
};

function getAvatarSrc(src?: string | null, name?: string | null) {
    if (src?.startsWith('/')) return src;

    const params = new URLSearchParams();
    if (src) params.set('src', src);
    if (name) params.set('name', name);
    return `/api/avatar?${params.toString()}`;
}

export function Avatar({ src, name, alt, className, fallbackClassName }: AvatarProps) {
    const hasCustomRadius = typeof className === 'string' && className.includes('rounded-');

    return (
        <img
            src={getAvatarSrc(src, name)}
            alt={alt ?? name ?? 'Avatar'}
            loading="lazy"
            decoding="async"
            className={cn(
                'shrink-0 border border-border-subtle bg-bg-muted object-cover',
                hasCustomRadius ? '' : 'rounded-token-full',
                fallbackClassName,
                className
            )}
        />
    );
}
