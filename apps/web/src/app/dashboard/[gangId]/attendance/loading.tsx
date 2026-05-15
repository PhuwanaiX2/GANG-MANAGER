import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function AttendanceLoading() {
    return (
        <RouteLoadingShell actions={1} stats={4} tabs={2}>
            <ResponsiveListSkeleton rows={6} columns={5} />
        </RouteLoadingShell>
    );
}
