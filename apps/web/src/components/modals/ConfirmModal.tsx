'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: ReactNode;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info';
    icon?: React.ElementType;
    isProcessing?: boolean;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = 'ยืนยัน',
    cancelText = 'ยกเลิก',
    type = 'danger',
    icon: Icon,
    isProcessing = false
}: ConfirmModalProps) {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        return () => setIsMounted(false);
    }, []);

    if (!isOpen || !isMounted) return null;

    const colors = {
        danger: {
            bg: 'bg-status-danger-subtle',
            text: 'text-fg-danger',
            button: 'bg-status-danger hover:brightness-110 shadow-token-glow-danger'
        },
        warning: {
            bg: 'bg-status-warning-subtle',
            text: 'text-fg-warning',
            button: 'bg-status-warning hover:brightness-110 shadow-token-sm'
        },
        info: {
            bg: 'bg-status-info-subtle',
            text: 'text-fg-info',
            button: 'bg-status-info hover:brightness-110 shadow-token-sm'
        }
    };

    const color = colors[type];

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-2 bg-bg-overlay backdrop-blur-sm animate-in fade-in duration-200 sm:items-center sm:p-4">
            <div className="bg-bg-subtle border border-border-subtle rounded-token-xl shadow-token-lg p-4 sm:p-5 w-full max-w-sm transform scale-100 transition-all animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-3">
                    {Icon && (
                        <div className={`h-10 w-10 shrink-0 flex items-center justify-center ${color.bg} rounded-token-lg`}>
                            <Icon className={`w-5 h-5 ${color.text}`} />
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-fg-primary text-base">{title}</h3>
                        <div className="text-fg-secondary text-sm mt-1 whitespace-pre-line leading-relaxed">
                            {description}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-5">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="min-h-11 px-4 py-2 bg-bg-muted hover:bg-bg-raised text-fg-primary rounded-token-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`min-h-11 px-4 py-2 text-fg-inverse rounded-token-lg text-sm font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${color.button}`}
                    >
                        {isProcessing && <div className="w-4 h-4 border-2 border-border-subtle border-t-fg-inverse rounded-token-full animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
