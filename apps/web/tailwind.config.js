/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-prompt)', 'Prompt', 'system-ui', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
            },
            colors: {
                // ─── Legacy (kept for backwards compatibility) ──────────
                discord: {
                    primary: '#FF2A00',
                    hover: '#CC2200',
                    dark: '#120000',
                    darker: '#0A0000',
                    light: '#FF664D',
                },
                fivem: {
                    red: '#D91C00',
                    darkred: '#8A0A00',
                    orange: '#CC4400',
                    black: '#0A0A0A',
                    panel: '#111111',
                    border: 'rgba(217, 28, 0, 0.15)',
                },
                surface: {
                    0: '#030303',
                    1: '#0A0A0A',
                    2: '#111111',
                    3: '#1A1A1A',
                },
                glass: {
                    DEFAULT: 'rgba(5, 5, 5, 0.7)',
                    border: 'rgba(255, 255, 255, 0.05)',
                    'border-hover': 'rgba(255, 17, 0, 0.3)',
                },
                neon: {
                    blue: '#06B6D4',
                    red: '#FF1100',
                    orange: '#FF5500',
                },

                // ─── Design System v2 — semantic tokens ─────────────────
                // Use these going forward. Values come from CSS vars so
                // a theme change in globals.css recolors everything.
                bg: {
                    base: 'var(--color-bg-base)',
                    subtle: 'var(--color-bg-subtle)',
                    muted: 'var(--color-bg-muted)',
                    elevated: 'var(--color-bg-elevated)',
                    raised: 'var(--color-bg-raised)',
                    overlay: 'var(--color-bg-overlay)',
                },
                border: {
                    DEFAULT: 'var(--color-border-default)',
                    subtle: 'var(--color-border-subtle)',
                    strong: 'var(--color-border-strong)',
                    accent: 'var(--color-border-accent)',
                },
                fg: {
                    DEFAULT: 'var(--color-text-primary)',
                    primary: 'var(--color-text-primary)',
                    secondary: 'var(--color-text-secondary)',
                    tertiary: 'var(--color-text-tertiary)',
                    inverse: 'var(--color-text-inverse)',
                    accent: 'var(--color-text-accent)',
                    danger: 'var(--color-text-danger)',
                    success: 'var(--color-text-success)',
                    warning: 'var(--color-text-warning)',
                    info: 'var(--color-text-info)',
                },
                accent: {
                    DEFAULT: 'var(--color-accent)',
                    bright: 'var(--color-accent-bright)',
                    hover: 'var(--color-accent-hover)',
                    subtle: 'var(--color-accent-subtle)',
                    fg: 'var(--color-accent-fg)',
                },
                status: {
                    success: 'var(--color-success)',
                    'success-subtle': 'var(--color-success-subtle)',
                    warning: 'var(--color-warning)',
                    'warning-subtle': 'var(--color-warning-subtle)',
                    danger: 'var(--color-danger)',
                    'danger-subtle': 'var(--color-danger-subtle)',
                    info: 'var(--color-info)',
                    'info-subtle': 'var(--color-info-subtle)',
                },
                brand: {
                    discord: 'var(--color-brand-discord)',
                    'discord-hover': 'var(--color-brand-discord-hover)',
                },
            },
            borderRadius: {
                'token-xs': 'var(--radius-xs)',
                'token-sm': 'var(--radius-sm)',
                'token-md': 'var(--radius-md)',
                'token-lg': 'var(--radius-lg)',
                'token-xl': 'var(--radius-xl)',
                'token-2xl': 'var(--radius-2xl)',
                'token-full': 'var(--radius-full)',
            },
            boxShadow: {
                'token-xs': 'var(--shadow-xs)',
                'token-sm': 'var(--shadow-sm)',
                'token-md': 'var(--shadow-md)',
                'token-lg': 'var(--shadow-lg)',
                'token-glow-accent': 'var(--shadow-glow-accent)',
                'token-glow-danger': 'var(--shadow-glow-danger)',
            },
            transitionDuration: {
                'token-instant': 'var(--duration-instant)',
                'token-fast': 'var(--duration-fast)',
                'token-normal': 'var(--duration-normal)',
                'token-slow': 'var(--duration-slow)',
            },
            transitionTimingFunction: {
                'token-standard': 'var(--easing-standard)',
                'token-emphasized': 'var(--easing-emphasized)',
            },
            backgroundImage: {
                'gradient-premium': 'linear-gradient(135deg, #FF1100 0%, #FF5500 100%)',
                'gradient-glass': 'linear-gradient(135deg, rgba(20, 20, 20, 0.8) 0%, rgba(5, 5, 5, 0.95) 100%)',
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-hero': 'linear-gradient(160deg, #FF1100 0%, #990A00 40%, #000000 100%)',
                'gradient-mesh': 'radial-gradient(at 40% 20%, rgba(255,17,0,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(255,85,0,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(153,10,0,0.08) 0px, transparent 50%)',
            },
            animation: {
                'fade-in': 'fade-in 0.6s ease-out forwards',
                'fade-in-up': 'fade-in-up 0.8s cubic-bezier(0.22,1,0.36,1) forwards',
                'fade-in-down': 'fade-in-down 0.7s ease-out forwards',
                'fade-in-left': 'fade-in-left 0.7s ease-out forwards',
                'fade-in-right': 'fade-in-right 0.7s ease-out forwards',
                'float': 'float 6s ease-in-out infinite',
                'float-slow': 'float 8s ease-in-out infinite',
                'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'gradient-shift': 'gradient-shift 8s ease infinite',
                'glow': 'glow 2s ease-in-out infinite alternate',
                'slide-up': 'slide-up 0.5s ease-out',
                'scale-in': 'scale-in 0.5s ease-out forwards',
                'spin-slow': 'spin 12s linear infinite',
                'marquee': 'marquee 20s linear infinite',
            },
            keyframes: {
                'fade-in': {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                'fade-in-up': {
                    '0%': { opacity: '0', transform: 'translateY(30px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-down': {
                    '0%': { opacity: '0', transform: 'translateY(-24px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in-left': {
                    '0%': { opacity: '0', transform: 'translateX(-24px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                'fade-in-right': {
                    '0%': { opacity: '0', transform: 'translateX(24px)' },
                    '100%': { opacity: '1', transform: 'translateX(0)' },
                },
                'float': {
                    '0%, 100%': { transform: 'translateY(0)' },
                    '50%': { transform: 'translateY(-12px)' },
                },
                'gradient-shift': {
                    '0%, 100%': { backgroundPosition: '0% 50%' },
                    '50%': { backgroundPosition: '100% 50%' },
                },
                'glow': {
                    '0%': { boxShadow: '0 0 20px rgba(88,101,242,0.2)' },
                    '100%': { boxShadow: '0 0 40px rgba(88,101,242,0.4), 0 0 80px rgba(88,101,242,0.1)' },
                },
                'slide-up': {
                    '0%': { transform: 'translateY(100%)' },
                    '100%': { transform: 'translateY(0)' },
                },
                'scale-in': {
                    '0%': { opacity: '0', transform: 'scale(0.95)' },
                    '100%': { opacity: '1', transform: 'scale(1)' },
                },
                'marquee': {
                    '0%': { transform: 'translateX(0%)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
            },
        },
    },
    plugins: [],
};
