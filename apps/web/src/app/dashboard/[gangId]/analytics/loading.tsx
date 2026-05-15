import { ChartSkeletonGrid, ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function AnalyticsLoading() {
    return (
        <RouteLoadingShell actions={0} stats={4}>
            <ChartSkeletonGrid panels={2} />
            <div className="grid min-w-0 gap-4 lg:grid-cols-3">
                <ResponsiveListSkeleton rows={4} columns={3} />
                <ResponsiveListSkeleton rows={4} columns={3} />
                <ResponsiveListSkeleton rows={4} columns={3} />
            </div>
        </RouteLoadingShell>
    );
}
