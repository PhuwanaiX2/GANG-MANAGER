export const dynamic = 'force-dynamic';

import SettingsPage from '../page';

interface Props {
    params: Promise<{ gangId: string }>;
}

export default function SettingsRolesChannelsPage(props: Props) {
    return <SettingsPage params={props.params} />;
}
