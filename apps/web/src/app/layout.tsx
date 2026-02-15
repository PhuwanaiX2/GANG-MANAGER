import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Toaster } from 'sonner';

const prompt = Prompt({
    subsets: ['latin', 'thai'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-prompt', // Add variable for Tailwind usage
});

export const metadata: Metadata = {
    title: 'Gang Manager — ระบบจัดการแก๊ง FiveM ครบวงจร',
    description: 'จัดการสมาชิก การเงิน เช็คชื่อ ลาหยุด และ Audit Log ผ่าน Discord Bot และ Web Dashboard',
    metadataBase: new URL(process.env.NEXTAUTH_URL || 'http://localhost:3000'),
    themeColor: '#000000',
    openGraph: {
        title: 'Gang Manager — ระบบจัดการแก๊ง FiveM ครบวงจร',
        description: 'จัดการสมาชิก การเงิน เช็คชื่อ ลาหยุด และ Audit Log ผ่าน Discord Bot และ Web Dashboard',
        siteName: 'Gang Manager',
        locale: 'th_TH',
        type: 'website',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="th" className="dark" suppressHydrationWarning>
            <body className={`${prompt.className} ${prompt.variable}`}>
                <Providers>
                    {children}
                    <Toaster richColors theme="dark" position="top-right" expand visibleToasts={4} toastOptions={{ className: 'font-[family-name:var(--font-prompt)]' }} />
                    <SpeedInsights />
                </Providers>
            </body>
        </html>
    );
}
