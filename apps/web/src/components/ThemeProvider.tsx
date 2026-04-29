'use client';

import { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'light' | 'dark';
export type ThemeAccent = 'ember' | 'cobalt' | 'jade' | 'gold';

export const THEME_ACCENTS: Array<{
    id: ThemeAccent;
    label: string;
    swatch: string;
}> = [
    { id: 'ember', label: 'Ember', swatch: '#FF3B1F' },
    { id: 'cobalt', label: 'Cobalt', swatch: '#3B82F6' },
    { id: 'jade', label: 'Jade', swatch: '#10B981' },
    { id: 'gold', label: 'Gold', swatch: '#F59E0B' },
];

interface ThemeContextValue {
    theme: ThemeMode;
    accent: ThemeAccent;
    setTheme: (theme: ThemeMode) => void;
    setAccent: (accent: ThemeAccent) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = 'gang-manager-theme';
const ACCENT_STORAGE_KEY = 'gang-manager-accent';

function resolveStoredTheme(): ThemeMode {
    if (typeof window === 'undefined') return 'dark';

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;

    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolveStoredAccent(): ThemeAccent {
    if (typeof window === 'undefined') return 'ember';

    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return THEME_ACCENTS.some((accent) => accent.id === stored) ? stored as ThemeAccent : 'ember';
}

function applyTheme(theme: ThemeMode, accent: ThemeAccent) {
    const root = document.documentElement;
    root.dataset.theme = theme;
    root.dataset.accent = accent;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeMode>('dark');
    const [accent, setAccentState] = useState<ThemeAccent>('ember');

    useEffect(() => {
        const nextTheme = resolveStoredTheme();
        const nextAccent = resolveStoredAccent();
        setThemeState(nextTheme);
        setAccentState(nextAccent);
        applyTheme(nextTheme, nextAccent);
    }, []);

    const setTheme = (nextTheme: ThemeMode) => {
        setThemeState(nextTheme);
        window.localStorage.setItem(STORAGE_KEY, nextTheme);
        applyTheme(nextTheme, accent);
    };

    const setAccent = (nextAccent: ThemeAccent) => {
        setAccentState(nextAccent);
        window.localStorage.setItem(ACCENT_STORAGE_KEY, nextAccent);
        applyTheme(theme, nextAccent);
    };

    const value: ThemeContextValue = {
        theme,
        accent,
        setTheme,
        setAccent,
        toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    };

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within ThemeProvider');
    }
    return context;
}
