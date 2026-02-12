import type { Metadata } from 'next';
import { Prompt } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const prompt = Prompt({
    subsets: ['latin', 'thai'],
    weight: ['300', '400', '500', '600', '700'],
    display: 'swap',
    variable: '--font-prompt', // Add variable for Tailwind usage
});

export const metadata: Metadata = {
    title: 'FiveM Gang Management',
    description: 'ระบบจัดการแก๊ง FiveM ผ่าน Discord',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="th" className="dark">
            <body className={`${prompt.className} ${prompt.variable}`}>
                <Providers>
                    {children}
                    <Toaster richColors theme="dark" position="top-right" />
                </Providers>
            </body>
        </html>
    );
}
