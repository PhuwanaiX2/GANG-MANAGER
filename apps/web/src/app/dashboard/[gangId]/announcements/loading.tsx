import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function AnnouncementsLoading() {
    return (
        <RouteLoadingShell actions={1} stats={0}>
            <ResponsiveListSkeleton rows={5} columns={4} />
        </RouteLoadingShell>
    );
}
