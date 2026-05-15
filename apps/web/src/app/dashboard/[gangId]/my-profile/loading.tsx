import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

function Block({ className = '' }: { className?: string }) {
    return <div className={`rounded-token-md bg-bg-muted ${className}`} />;
}

export default function MyProfileLoading() {
    return (
        <RouteLoadingShell actions={0} stats={4}>
            <section className="min-w-0 rounded-token-xl border border-border-subtle bg-bg-subtle p-4 shadow-token-sm">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                    <Block className="h-16 w-16 shrink-0 rounded-token-lg" />
                    <div className="min-w-0 flex-1 space-y-2">
                        <Block className="h-6 w-44 max-w-full bg-bg-elevated" />
                        <Block className="h-3 w-64 max-w-full" />
                    </div>
                    <Block className="h-9 w-28 bg-bg-elevated" />
                </div>
            </section>
            <ResponsiveListSkeleton rows={6} columns={3} />
        </RouteLoadingShell>
    );
}
