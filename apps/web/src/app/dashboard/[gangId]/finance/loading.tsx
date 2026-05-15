import { ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function FinanceLoading() {
    return (
        <RouteLoadingShell actions={3} stats={4} tabs={3}>
            <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                <ResponsiveListSkeleton rows={6} columns={4} />
                <ResponsiveListSkeleton rows={5} columns={3} />
            </div>
        </RouteLoadingShell>
    );
}
