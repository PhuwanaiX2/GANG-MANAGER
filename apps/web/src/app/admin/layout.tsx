import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { AdminSidebar } from '@/app/admin/AdminSidebar';

const ADMIN_IDS = (process.env.ADMIN_DISCORD_IDS || '').split(',').filter(Boolean);

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.discordId) redirect('/');

    if (!ADMIN_IDS.includes(session.user.discordId)) {
        return (
            <main className="min-h-screen bg-[#050505] flex items-center justify-center text-white">
                <div className="text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v.01M12 9v2m0 0a9 9 0 110 0 9 9 0 010 0z" /></svg>
                    </div>
                    <h1 className="text-2xl font-bold mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
                    <p className="text-gray-500">คุณไม่ได้รับอนุญาตให้เข้าถึงหน้านี้</p>
                </div>
            </main>
        );
    }

    return (
        <div className="min-h-screen bg-[#050505] text-white flex">
            <AdminSidebar adminName={session.user.name || 'Admin'} adminAvatar={session.user.image || undefined} />
            <main className="flex-1 ml-0 lg:ml-64 min-h-screen">
                <div className="max-w-7xl mx-auto p-6 pb-24 lg:pb-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
