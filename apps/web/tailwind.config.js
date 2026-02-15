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
                sans: ['var(--font-prompt)', 'Inter', 'sans-serif'],
            },
            colors: {
                discord: {
                    primary: '#5865F2',
                    dark: '#1E1F22',
                    darker: '#111214',
                    light: '#99AAB5',
                },
                glass: {
                    DEFAULT: 'rgba(255, 255, 255, 0.03)',
                    border: 'rgba(255, 255, 255, 0.08)',
                },
                neon: {
                    blue: '#00D4FF',
                    violet: '#A855F7',
                    pink: '#EC4899',
                },
            },
            backgroundImage: {
                'gradient-premium': 'linear-gradient(135deg, #5865F2 0%, #9333EA 100%)',
                'gradient-glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 100%)',
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                'gradient-hero': 'linear-gradient(160deg, #5865F2 0%, #7C3AED 40%, #EC4899 100%)',
                'gradient-mesh': 'radial-gradient(at 40% 20%, rgba(88,101,242,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(147,51,234,0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(59,130,246,0.08) 0px, transparent 50%)',
            },
            animation: {
                'fade-in': 'fade-in 0.6s ease-out forwards',
                'fade-in-up': 'fade-in-up 0.7s ease-out forwards',
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
                    '0%': { opacity: '0', transform: 'translateY(24px)' },
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
                    '0%': { opacity: '0', transform: 'scale(0.9)' },
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
