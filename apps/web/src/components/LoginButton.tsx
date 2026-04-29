'use client';

import { signIn } from 'next-auth/react';
import { MessageCircle, ShieldCheck } from 'lucide-react';

export function LoginButton() {
    return (
        <button
            onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
            className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-token-xl border border-white/15 bg-brand-discord px-4 py-2.5 text-[13px] font-black text-white shadow-[0_12px_28px_rgba(88,101,242,0.28)] transition-[transform,filter,box-shadow] hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_18px_40px_rgba(88,101,242,0.36)] active:translate-y-0 active:scale-[0.99] sm:px-5"
        >
            <span className="flex h-6 w-6 items-center justify-center rounded-token-lg bg-white/14">
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
            </span>
            <span>เข้าสู่ระบบด้วย Discord</span>
            <ShieldCheck className="h-3.5 w-3.5 opacity-80 transition-transform group-hover:scale-110" aria-hidden="true" />
        </button>
    );
}
