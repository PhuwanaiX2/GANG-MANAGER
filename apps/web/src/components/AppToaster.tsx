'use client';

import { Toaster } from 'sonner';
import { useTheme } from './ThemeProvider';

export function AppToaster() {
    const { theme } = useTheme();

    return (
        <Toaster
            richColors
            theme={theme}
            position="bottom-right"
            expand
            visibleToasts={4}
            toastOptions={{ className: 'font-[family-name:var(--font-prompt)]' }}
        />
    );
}
