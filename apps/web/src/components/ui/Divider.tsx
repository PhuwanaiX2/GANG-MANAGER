import { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerTone = 'subtle' | 'default' | 'strong';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
    orientation?: DividerOrientation;
    tone?: DividerTone;
}

const toneStyles: Record<DividerTone, string> = {
    subtle: 'bg-border-subtle',
    default: 'bg-border',
    strong: 'bg-border-strong',
};

export function Divider({
    orientation = 'horizontal',
    tone = 'subtle',
    className,
    ...rest
}: DividerProps) {
    const sizeClass = orientation === 'horizontal' ? 'w-full h-px' : 'w-px h-full';
    return (
        <div
            role="separator"
            aria-orientation={orientation}
            className={cn(sizeClass, toneStyles[tone], className)}
            {...rest}
        />
    );
}
