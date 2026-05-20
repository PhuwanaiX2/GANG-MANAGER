import { DashboardCardSkeletonGrid, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function DashboardIndexLoading() {
    return (
        <RouteLoadingShell actions={0} stats={0}>
            <DashboardCardSkeletonGrid cards={2} />
        </RouteLoadingShell>
    );
}
