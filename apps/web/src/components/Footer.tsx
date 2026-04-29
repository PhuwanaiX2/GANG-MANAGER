import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

export function Footer() {
    const legalLinks = [
        { href: '/privacy', label: 'ความเป็นส่วนตัว' },
        { href: '/terms', label: 'เงื่อนไข' },
        { href: '/support', label: 'ซัพพอร์ต' },
    ];

    return (
        <footer className="w-full py-8 text-center text-fg-tertiary text-sm">
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-token-full bg-bg-subtle border border-border-subtle hover:bg-bg-muted transition-colors">
                    <LifeBuoy className="w-4 h-4 text-brand-discord" />
                    <a
                        href="https://discord.gg/rHvkNv8ayj"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-fg-secondary hover:text-fg-primary transition-colors"
                    >
                        ศูนย์ช่วยเหลือ
                    </a>
                </div>
                <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs" aria-label="Footer links">
                    {legalLinks.map((link) => (
                        <Link
                            key={link.href}
                            href={link.href}
                            className="text-fg-tertiary hover:text-fg-primary transition-colors"
                        >
                            {link.label}
                        </Link>
                    ))}
                </nav>
                <div className="opacity-60 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase">
                        © 2026 Gang Manager • Powered by Discord
                    </p>
                </div>
            </div>
        </footer>
    );
}
