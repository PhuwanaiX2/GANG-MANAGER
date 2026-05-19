'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/cn';

interface ModalLayerProps {
    children: ReactNode;
    onClose?: () => void;
    closeOnBackdrop?: boolean;
    align?: 'center' | 'top';
    className?: string;
}

const alignClasses: Record<NonNullable<ModalLayerProps['align']>, string> = {
    center: 'items-end sm:items-center',
    top: 'items-start sm:items-center',
};

export function ModalLayer({
    children,
    onClose,
    closeOnBackdrop = true,
    align = 'center',
    className,
}: ModalLayerProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    useEffect(() => {
        if (!isMounted) return;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose?.();
            }
        };

        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMounted, onClose]);

    if (!isMounted) return null;

    return createPortal(
        <div
            data-modal-layer
            className={cn(
                'fixed inset-0 z-[1000] isolate flex justify-center bg-slate-950/55 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-[10px] animate-in fade-in duration-200 sm:p-4',
                alignClasses[align],
                className,
            )}
            onMouseDown={(event) => {
                if (closeOnBackdrop && event.target === event.currentTarget) {
                    onClose?.();
                }
            }}
        >
            {children}
        </div>,
        document.body,
    );
}
