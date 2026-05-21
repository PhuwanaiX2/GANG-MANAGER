'use client';

import { useState, useCallback, useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { ModalLayer } from '@/components/ui';

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (confirmationValue?: string) => void | Promise<void>;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
    loading?: boolean;
    icon?: React.ReactNode;
    requiredConfirmationText?: string;
    confirmationLabel?: string;
    confirmationPlaceholder?: string;
}

const variantStyles = {
    danger: {
        iconBg: 'bg-status-danger-subtle',
        iconColor: 'text-fg-danger',
        button: 'bg-status-danger hover:opacity-90 focus:ring-status-danger/30',
    },
    warning: {
        iconBg: 'bg-status-warning-subtle',
        iconColor: 'text-fg-warning',
        button: 'bg-status-warning hover:opacity-90 focus:ring-status-warning/30',
    },
    info: {
        iconBg: 'bg-status-info-subtle',
        iconColor: 'text-fg-info',
        button: 'bg-status-info hover:opacity-90 focus:ring-status-info/30',
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
    requiredConfirmationText,
    confirmationLabel,
    confirmationPlaceholder,
}: ConfirmModalProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [confirmationValue, setConfirmationValue] = useState('');
    const requiresConfirmation = Boolean(requiredConfirmationText);
    const confirmationMatches = !requiresConfirmation || confirmationValue.trim() === requiredConfirmationText?.trim();

    useEffect(() => {
        if (!isOpen) {
            setConfirmationValue('');
        }
    }, [isOpen]);

    const handleConfirm = useCallback(async () => {
        if (!confirmationMatches) {
            return;
        }

        setIsProcessing(true);
        try {
            await onConfirm(confirmationValue);
        } finally {
            setIsProcessing(false);
        }
    }, [confirmationMatches, confirmationValue, onConfirm]);

    if (!isOpen) return null;

    const styles = variantStyles[variant];
    const busy = loading || isProcessing;

    return (
        <ModalLayer onClose={!busy ? onClose : undefined}>
            <div role="dialog" aria-modal="true" className="relative bg-bg-subtle border border-border-subtle rounded-token-xl shadow-token-lg max-w-md w-full p-4 sm:p-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Close button */}
                <button
                    onClick={onClose}
                    disabled={busy}
                    className="absolute top-2 right-2 h-11 w-11 flex items-center justify-center rounded-token-lg text-fg-tertiary hover:text-fg-primary hover:bg-bg-muted transition-colors disabled:opacity-50"
                >
                    <X className="w-4 h-4" />
                </button>

                {/* Icon */}
                <div className={`w-10 h-10 ${styles.iconBg} rounded-token-lg flex items-center justify-center mb-3`}>
                    {icon || <AlertTriangle className={`w-5 h-5 ${styles.iconColor}`} />}
                </div>

                {/* Content */}
                <h3 className="text-base font-bold text-fg-primary mb-2 pr-10">{title}</h3>
                {description && (
                    <p className="text-sm text-fg-secondary leading-relaxed mb-5">{description}</p>
                )}

                {requiresConfirmation && (
                    <div className="mb-5 rounded-token-lg border border-border-subtle bg-bg-muted p-3">
                        <label className="mb-1.5 block text-xs font-bold text-fg-secondary">
                            {confirmationLabel || 'พิมพ์ข้อความยืนยัน'}
                        </label>
                        <input
                            value={confirmationValue}
                            onChange={(event) => setConfirmationValue(event.target.value)}
                            placeholder={confirmationPlaceholder || requiredConfirmationText}
                            disabled={busy}
                            className="min-h-11 w-full rounded-token-lg border border-border-subtle bg-bg-subtle px-3 py-2 text-sm text-fg-primary outline-none transition-colors focus:border-brand-primary disabled:opacity-60"
                        />
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={onClose}
                        disabled={busy}
                        className="min-h-11 px-4 py-2 rounded-token-lg text-sm font-bold text-fg-secondary bg-bg-muted border border-border-subtle hover:bg-bg-raised transition-colors disabled:opacity-50"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={busy || !confirmationMatches}
                        className={`min-h-11 px-4 py-2 rounded-token-lg text-sm font-bold text-fg-inverse ${styles.button} transition-colors flex items-center justify-center gap-2 disabled:opacity-50 focus:ring-2`}
                    >
                        {busy ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : null}
                        {busy ? 'กำลังดำเนินการ...' : confirmText}
                    </button>
                </div>
            </div>
        </ModalLayer>
    );
}
