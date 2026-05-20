import { cn } from '@/lib/cn';
import { getOptimizedAvatarUrl } from '@/lib/imageUrls';

type AvatarProps = {
    src?: string | null;
    name?: string | null;
    alt?: string;
    className?: string;
    fallbackClassName?: string;
};

function getAvatarSrc(src?: string | null, name?: string | null) {
    if (src?.startsWith('/')) return src;

    const optimizedSrc = getOptimizedAvatarUrl(src, 96);
    const params = new URLSearchParams();
    if (optimizedSrc) params.set('src', optimizedSrc);
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
