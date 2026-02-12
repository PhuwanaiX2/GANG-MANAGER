import { X } from 'lucide-react';
import { ReactNode } from 'react';

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
    if (!isOpen) return null;

    const colors = {
        danger: {
            bg: 'bg-red-500/10',
            text: 'text-red-500',
            button: 'bg-red-600 hover:bg-red-500 shadow-red-500/20'
        },
        warning: {
            bg: 'bg-yellow-500/10',
            text: 'text-yellow-500',
            button: 'bg-yellow-600 hover:bg-yellow-500 shadow-yellow-500/20'
        },
        info: {
            bg: 'bg-blue-500/10',
            text: 'text-blue-500',
            button: 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
        }
    };

    const color = colors[type];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-[#111111] border border-white/10 rounded-2xl shadow-2xl p-6 w-full max-w-sm transform scale-100 transition-all animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4">
                    {Icon && (
                        <div className={`p-3 ${color.bg} rounded-xl`}>
                            <Icon className={`w-6 h-6 ${color.text}`} />
                        </div>
                    )}
                    <div className="flex-1">
                        <h3 className="font-bold text-white text-lg">{title}</h3>
                        <div className="text-gray-400 text-sm mt-1 whitespace-pre-line">
                            {description}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 mt-6">
                    <button
                        onClick={onClose}
                        disabled={isProcessing}
                        className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isProcessing}
                        className={`flex-1 px-4 py-2.5 text-white rounded-xl text-sm font-bold transition-colors shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${color.button}`}
                    >
                        {isProcessing && <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
