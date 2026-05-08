import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function MembersLoading() {
    return (
        <RouteLoadingShell actions={2} stats={0}>
            <ResponsiveListSkeleton rows={8} columns={5} />
        </RouteLoadingShell>
    );
}
