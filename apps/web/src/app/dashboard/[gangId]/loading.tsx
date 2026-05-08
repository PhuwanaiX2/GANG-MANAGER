import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function DashboardLoading() {
    return (
        <RouteLoadingShell actions={1} stats={3}>
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <ResponsiveListSkeleton rows={5} columns={3} />
                <ResponsiveListSkeleton rows={5} columns={4} />
            </div>
        </RouteLoadingShell>
    );
}
