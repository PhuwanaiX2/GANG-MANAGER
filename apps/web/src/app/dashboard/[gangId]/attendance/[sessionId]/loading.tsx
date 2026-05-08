import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function AttendanceSessionLoading() {
    return (
        <RouteLoadingShell actions={1} stats={4}>
            <div className="grid min-w-0 gap-4">
                <ResponsiveListSkeleton rows={8} columns={5} />
                <ResponsiveListSkeleton rows={5} columns={4} />
            </div>
        </RouteLoadingShell>
    );
}
