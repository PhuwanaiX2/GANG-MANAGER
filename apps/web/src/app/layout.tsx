import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Prompt } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Providers } from './providers';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";

const prompt = Prompt({
    subsets: ['latin', 'thai'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-prompt', // Add variable for Tailwind usage
});

const jetBrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    display: 'swap',
    variable: '--font-jetbrains-mono',
});

export const metadata: Metadata = {
    title: 'Gang Manager — ระบบจัดการแก๊ง FiveM ครบวงจร',
    description: 'จัดการสมาชิก การเงิน เช็คชื่อ ลาหยุด และ Audit Log ผ่าน Discord Bot และ Web Dashboard',
    icons: {
        icon: [
            { url: '/brand/logov2-icon-v1.png', type: 'image/png', sizes: '192x192' },
        ],
        shortcut: [{ url: '/brand/logov2-icon-v1.png', type: 'image/png' }],
        apple: [{ url: '/brand/logov2-icon-v1.png', type: 'image/png', sizes: '192x192' }],
    },
    metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
    openGraph: {
        title: 'Gang Manager — ระบบจัดการแก๊ง FiveM ครบวงจร',
        description: 'จัดการสมาชิก การเงิน เช็คชื่อ ลาหยุด และ Audit Log ผ่าน Discord Bot และ Web Dashboard',
        siteName: 'Gang Manager',
        locale: 'th_TH',
        type: 'website',
    },
};

export const viewport: Viewport = {
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#F5F7FA' },
        { media: '(prefers-color-scheme: dark)', color: '#07080A' },
    ],
};

const enableVercelInsights =
    process.env.VERCEL === '1' ||
    process.env.NEXT_PUBLIC_ENABLE_VERCEL_INSIGHTS === '1';

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="th" suppressHydrationWarning>
            <body className={`${prompt.className} ${prompt.variable} ${jetBrainsMono.variable}`}>
                <Script src="/theme-init.js" strategy="beforeInteractive" />
                <Providers>
                    {children}
                    {enableVercelInsights && (
                        <>
                            <SpeedInsights />
                            <Analytics />
                        </>
                    )}
                </Providers>
            </body>
        </html>
    );
}
