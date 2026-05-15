import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function MemberDetailLoading() {
    return (
        <RouteLoadingShell actions={1} stats={4} tabs={4}>
            <ResponsiveListSkeleton rows={6} columns={3} />
        </RouteLoadingShell>
    );
}
