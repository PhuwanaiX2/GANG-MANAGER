import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function Loading() {
    return (
        <main className="min-h-screen bg-bg-base px-4 py-6 text-fg-primary sm:px-6">
            <div data-testid="app-loading-state" className="mx-auto w-full max-w-6xl">
                <RouteLoadingShell actions={0} stats={3}>
                    <ResponsiveListSkeleton rows={4} columns={3} />
                </RouteLoadingShell>
            </div>
        </main>
    );
}
