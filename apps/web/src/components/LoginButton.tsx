'use client';

import { signIn } from 'next-auth/react';
import { LogIn } from 'lucide-react';

export function LoginButton() {
    return (
        <button
            onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
            className="w-full flex items-center justify-center gap-3 bg-discord-primary hover:bg-[#4752C4] text-white px-8 py-4 rounded-2xl text-lg font-bold transition-all transform hover:scale-[1.02] shadow-lg shadow-discord-primary/25"
        >
            <LogIn className="w-5 h-5" />
            <span>เข้าสู่ระบบด้วย Discord</span>
        </button>
    );
}
