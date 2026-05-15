import { FormPanelSkeleton, ResponsiveListSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function BillingLoading() {
    return (
        <RouteLoadingShell actions={1} stats={3} tabs={0}>
            <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                <FormPanelSkeleton panels={1} />
                <ResponsiveListSkeleton rows={4} columns={3} />
            </div>
        </RouteLoadingShell>
    );
}
