import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function DashboardIndexLoading() {
    return (
        <RouteLoadingShell actions={0} stats={0}>
            <ResponsiveListSkeleton rows={4} columns={3} />
        </RouteLoadingShell>
    );
}
