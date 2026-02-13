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
        iconBg: 'bg-red-500/10',
        iconColor: 'text-red-500',
        button: 'bg-red-600 hover:bg-red-500 focus:ring-red-500/30',
    },
    warning: {
        iconBg: 'bg-yellow-500/10',
        iconColor: 'text-yellow-500',
        button: 'bg-yellow-600 hover:bg-yellow-500 focus:ring-yellow-500/30',
    },
    info: {
        iconBg: 'bg-blue-500/10',
        iconColor: 'text-blue-400',
        button: 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500/30',
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
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={!busy ? onClose : undefined}
            />

            {/* Modal */}
            <div className="relative bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={busy}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div className={`w-12 h-12 ${styles.iconBg} rounded-xl flex items-center justify-center mb-4`}>
                    {icon || <AlertTriangle className={`w-6 h-6 ${styles.iconColor}`} />}
                </div>

                {/* Content */}
                <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
                {description && (
                    <p className="text-sm text-gray-400 leading-relaxed mb-6">{description}</p>
                )}

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={busy}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold text-white ${styles.button} transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus:ring-2`}
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
