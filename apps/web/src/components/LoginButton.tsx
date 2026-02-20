'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';

export function LoginButton() {
    return (
        <button
            onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
            className="btn-fivem flex items-center justify-center gap-2 px-6 py-2.5 text-[13px] font-bold text-white uppercase tracking-widest backdrop-blur-md bg-black/50"
        >
            <LogIn className="w-4 h-4 text-fivem-red" aria-hidden="true" />
            <span>เข้าสู่ระบบ</span>
        </button>
    );
}
