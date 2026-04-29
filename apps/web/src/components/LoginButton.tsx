'use client';

import { signIn } from 'next-auth/react';
import { MessageCircle } from 'lucide-react';

export function LoginButton() {
    return (
        <button
            onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
            className="inline-flex items-center justify-center gap-2 rounded-token-lg bg-brand-discord px-6 py-2.5 text-[13px] font-black text-brand-discord-fg shadow-token-sm transition-all hover:brightness-110 active:scale-[0.98]"
        >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            <span>เข้าสู่ระบบด้วย Discord</span>
        </button>
    );
}
