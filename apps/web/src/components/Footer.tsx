import Link from 'next/link';
import { LifeBuoy } from 'lucide-react';

export function Footer() {
    return (
        <footer className="w-full py-8 text-center text-gray-500 text-sm">
            <div className="flex flex-col items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors">
                    <LifeBuoy className="w-4 h-4 text-discord-primary" />
                    <a
                        href="https://discord.gg/rHvkNv8ayj"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-gray-300 hover:text-white transition-colors"
                    >
                        ติดต่อแจ้งปัญหา / Support
                    </a>
                </div>
                <div className="opacity-40 hover:opacity-100 transition-opacity">
                    <p className="text-[10px] font-bold tracking-[0.3em] uppercase">
                        © 2026 Gang Manager • Powered by Discord
                    </p>
                </div>
            </div>
        </footer>
    );
}
