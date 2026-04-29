'use client';

import { Moon, Palette, Sun } from 'lucide-react';
import { THEME_ACCENTS, useTheme } from './ThemeProvider';
import { cn } from '@/lib/cn';

interface ThemeToggleProps {
    compact?: boolean;
    className?: string;
}

export function ThemeToggle({ compact = false, className }: ThemeToggleProps) {
    const { theme, toggleTheme, accent, setAccent } = useTheme();
    const isDark = theme === 'dark';

    if (compact) {
        return (
            <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                    'group inline-flex h-9 w-9 items-center justify-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-secondary shadow-token-sm transition-[background-color,border-color,box-shadow,color] duration-token-normal ease-token-standard hover:border-border-accent hover:bg-bg-elevated hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    className
                )}
                aria-label={isDark ? 'เปลี่ยนเป็น Light mode' : 'เปลี่ยนเป็น Dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
            >
                <span className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-token-full bg-bg-subtle border border-border-subtle">
                    <Sun className={cn('absolute h-3.5 w-3.5 text-fg-warning transition-all duration-token-normal', isDark ? 'translate-y-5 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')} />
                    <Moon className={cn('absolute h-3.5 w-3.5 text-accent-bright transition-all duration-token-normal', isDark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-5 -rotate-90 opacity-0')} />
                </span>
            </button>
        );
    }

    return (
        <div className={cn('flex items-center gap-2 rounded-token-xl border border-border-subtle bg-bg-muted/70 p-1.5 shadow-token-sm', className)}>
            <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                    'group inline-flex items-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-secondary shadow-token-sm transition-[background-color,border-color,box-shadow,color] duration-token-normal ease-token-standard hover:border-border-accent hover:bg-bg-elevated hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    'h-8 shrink-0 justify-center gap-2 px-2.5'
                )}
                aria-label={isDark ? 'เปลี่ยนเป็น Light mode' : 'เปลี่ยนเป็น Dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
            >
                <span className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-token-full bg-bg-subtle border border-border-subtle">
                    <Sun className={cn('absolute h-3.5 w-3.5 text-fg-warning transition-all duration-token-normal', isDark ? 'translate-y-5 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')} />
                    <Moon className={cn('absolute h-3.5 w-3.5 text-accent-bright transition-all duration-token-normal', isDark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-5 -rotate-90 opacity-0')} />
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isDark ? 'Dark' : 'Light'}
                </span>
            </button>

            <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
                <Palette className="mr-0.5 h-3 w-3 shrink-0 text-fg-tertiary" />
                {THEME_ACCENTS.map((item) => {
                    const selected = item.id === accent;
                    return (
                        <button
                            key={item.id}
                            type="button"
                            onClick={() => setAccent(item.id)}
                            className={cn(
                                'relative h-6 w-6 shrink-0 rounded-token-full border transition-[border-color,transform,box-shadow] duration-token-normal ease-token-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                                selected
                                    ? 'border-border-accent shadow-token-glow-accent scale-105'
                                    : 'border-border-subtle hover:border-border-strong hover:scale-105'
                            )}
                            style={{ background: item.swatch }}
                            aria-label={`ใช้ธีมสี ${item.label}`}
                            title={item.label}
                        >
                            <span className="absolute inset-[3px] rounded-token-full border border-white/25 bg-gradient-to-br from-white/25 to-transparent" />
                            {selected && (
                                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-token-full border border-bg-subtle bg-accent-bright shadow-token-sm" />
                            )}
                        </button>
                    );
                })}
                </div>
        </div>
    );
}
