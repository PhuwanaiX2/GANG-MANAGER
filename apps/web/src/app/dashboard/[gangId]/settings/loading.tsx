import { FormPanelSkeleton, RouteLoadingShell } from '@/components/ui/RouteLoading';

export default function SettingsLoading() {
    return (
        <RouteLoadingShell actions={0} stats={0} tabs={4}>
            <FormPanelSkeleton panels={2} />
        </RouteLoadingShell>
    );
}
