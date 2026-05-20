import Link from 'next/link';
import { BrandLogo } from './BrandLogo';

export function Footer() {
    const legalLinks = [
        { href: '/privacy', label: 'ความเป็นส่วนตัว' },
        { href: '/terms', label: 'เงื่อนไข' },
    ];

    return (
        <footer className="w-full py-6 text-center text-sm text-fg-tertiary">
            <div className="flex flex-col items-center gap-3">
                <BrandLogo showTagline={false} markClassName="h-7 w-7" textClassName="text-sm" />
                <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs" aria-label="Footer links">
                    {legalLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            prefetch={false}
                            className="text-fg-tertiary transition-colors hover:text-fg-primary"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <div className="opacity-60 transition-opacity hover:opacity-100">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em]">
                        © 2026 Gang Manager • Powered by Discord
                    </p>
                </div>
            </div>
        </footer>
    );
}
