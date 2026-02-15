'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';

export function LoginButton() {
    return (
        <button
            onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
            className="flex items-center justify-center gap-2 bg-discord-primary hover:bg-discord-hover text-white px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-colors duration-200 transition-transform duration-200 hover:scale-[1.02] shadow-lg shadow-discord-primary/20"
        >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            <span>เข้าสู่ระบบ</span>
        </button>
    );
}
