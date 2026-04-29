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

    return (
        <div className={cn('flex flex-col gap-2', className)}>
            <button
                type="button"
                onClick={toggleTheme}
                className={cn(
                    'group inline-flex items-center rounded-token-full border border-border-subtle bg-bg-muted text-fg-secondary shadow-token-sm transition-[background-color,border-color,box-shadow,color] duration-token-normal ease-token-standard hover:border-border-accent hover:bg-bg-elevated hover:text-fg-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                    compact ? 'h-9 w-9 justify-center' : 'w-full justify-center gap-2 px-3 py-2'
                )}
                aria-label={isDark ? 'เปลี่ยนเป็น Light mode' : 'เปลี่ยนเป็น Dark mode'}
                title={isDark ? 'Light mode' : 'Dark mode'}
            >
                <span className="relative flex h-5 w-5 items-center justify-center overflow-hidden rounded-token-full bg-bg-subtle border border-border-subtle">
                    <Sun className={cn('absolute h-3.5 w-3.5 text-fg-warning transition-all duration-token-normal', isDark ? 'translate-y-5 rotate-90 opacity-0' : 'translate-y-0 rotate-0 opacity-100')} />
                    <Moon className={cn('absolute h-3.5 w-3.5 text-accent-bright transition-all duration-token-normal', isDark ? 'translate-y-0 rotate-0 opacity-100' : '-translate-y-5 -rotate-90 opacity-0')} />
                </span>
                {!compact && (
                    <span className="text-[11px] font-bold uppercase tracking-widest">
                        {isDark ? 'Dark' : 'Light'}
                    </span>
                )}
            </button>

            {!compact && (
                <div className="rounded-token-xl border border-border-subtle bg-bg-subtle/70 p-2">
                    <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-black uppercase tracking-widest text-fg-tertiary">
                        <Palette className="h-3 w-3 text-accent-bright" />
                        Accent
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                        {THEME_ACCENTS.map((item) => {
                            const selected = item.id === accent;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setAccent(item.id)}
                                    className={cn(
                                        'group relative h-8 rounded-token-lg border transition-[border-color,transform,box-shadow] duration-token-normal ease-token-standard focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                                        selected
                                            ? 'border-border-accent shadow-token-glow-accent'
                                            : 'border-border-subtle hover:border-border-strong hover:scale-[1.03]'
                                    )}
                                    style={{ background: item.swatch }}
                                    aria-label={`ใช้ธีมสี ${item.label}`}
                                    title={item.label}
                                >
                                    <span className="absolute inset-[3px] rounded-token-md border border-white/25 bg-gradient-to-br from-white/20 to-transparent" />
                                    {selected && (
                                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-token-full border border-bg-subtle bg-accent-bright shadow-token-sm" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
