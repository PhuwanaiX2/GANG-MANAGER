'use client';

import { SessionProvider } from 'next-auth/react';
import { AppToaster } from '@/components/AppToaster';
import { ThemeProvider } from '@/components/ThemeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <SessionProvider>{children}</SessionProvider>
            <AppToaster />
        </ThemeProvider>
    );
}
