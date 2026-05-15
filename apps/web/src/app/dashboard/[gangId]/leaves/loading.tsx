import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function LeavesLoading() {
    return (
        <RouteLoadingShell actions={1} stats={0}>
            <ResponsiveListSkeleton rows={6} columns={5} />
        </RouteLoadingShell>
    );
}
