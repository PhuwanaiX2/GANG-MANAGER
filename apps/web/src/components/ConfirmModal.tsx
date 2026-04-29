'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
    icon?: React.ReactNode;
}

const variantStyles = {
    danger: {
        iconBg: 'bg-status-danger-subtle',
        iconColor: 'text-fg-danger',
        button: 'bg-status-danger hover:brightness-110 focus:ring-status-danger/30',
    },
    warning: {
        iconBg: 'bg-status-warning-subtle',
        iconColor: 'text-fg-warning',
        button: 'bg-status-warning hover:brightness-110 focus:ring-status-warning/30',
    },
    info: {
        iconBg: 'bg-status-info-subtle',
        iconColor: 'text-fg-info',
        button: 'bg-status-info hover:brightness-110 focus:ring-status-info/30',
    },
};

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    variant = 'warning',
    loading = false,
    icon,
}: ConfirmModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleConfirm = useCallback(async () => {
        setIsProcessing(true);
        try {
            await onConfirm();
        } finally {
            setIsProcessing(false);
        }
    }, [onConfirm]);

    useEffect(() => {
        if (!isOpen) return;
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && !isProcessing && !loading) onClose();
        };
        document.addEventListener('keydown', handleEsc);
        return () => document.removeEventListener('keydown', handleEsc);
    }, [isOpen, isProcessing, loading, onClose]);

    if (!isOpen) return null;

    const styles = variantStyles[variant];
    const busy = loading || isProcessing;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-bg-overlay backdrop-blur-sm"
                onClick={!busy ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-bg-subtle border border-border-subtle rounded-token-2xl shadow-token-lg max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={busy}
                    className="absolute top-4 right-4 p-1.5 rounded-token-lg text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted transition-colors disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div className={`w-12 h-12 ${styles.iconBg} rounded-token-xl flex items-center justify-center mb-4`}>
                    {icon || <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />}
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-fg-primary mb-2">{title}</h3>
                {description && (
                    <p className="text-sm text-fg-secondary leading-relaxed mb-6">{description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="flex-1 py-2.5 rounded-token-xl text-sm font-bold text-fg-secondary bg-bg-muted border border-border-subtle hover:bg-bg-raised transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={busy}
                        className={`flex-1 py-2.5 rounded-token-xl text-sm font-bold text-fg-inverse ${styles.button} transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus:ring-2`}
                    >
                        {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        {busy ? 'กำลังดำเนินการ...' : confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
