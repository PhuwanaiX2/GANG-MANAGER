'use client';

import { signIn } from 'next-auth/react';
import { ShieldCheck } from 'lucide-react';
import { DiscordLogo } from '@/components/icons/DiscordLogo';
import { cn } from '@/lib/cn';

interface LoginButtonProps {
    compactOnMobile?: boolean;
    className?: string;
}

export function LoginButton({ compactOnMobile = false, className }: LoginButtonProps) {
    return (
        <button
            type="button"
            aria-label="เข้าสู่ระบบด้วย Discord"
            onClick={() => signIn('discord', { callbackUrl: '/dashboard' })}
            className={cn(
                'group inline-flex min-h-11 items-center justify-center gap-2 rounded-token-lg border border-white/15 bg-brand-discord py-2.5 text-[13px] font-black text-white shadow-token-sm transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                compactOnMobile ? 'px-3 sm:px-5' : 'px-4 sm:px-5',
                className
            )}
        >
            <span className="flex h-6 w-6 items-center justify-center rounded-token-lg bg-white/14">
                <DiscordLogo className="h-4 w-4" />
            </span>
            <span className={compactOnMobile ? 'hidden sm:inline' : undefined}>เข้าสู่ระบบด้วย Discord</span>
            <ShieldCheck className={cn('h-3.5 w-3.5 opacity-80', compactOnMobile && 'hidden sm:block')} aria-hidden="true" />
        </button>
    );
}
