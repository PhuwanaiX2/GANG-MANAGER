import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function DashboardLoading() {
    return (
        <RouteLoadingShell actions={1} stats={3}>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <ResponsiveListSkeleton rows={3} columns={3} />
                <ResponsiveListSkeleton rows={3} columns={3} />
            </div>
        </RouteLoadingShell>
    );
}
