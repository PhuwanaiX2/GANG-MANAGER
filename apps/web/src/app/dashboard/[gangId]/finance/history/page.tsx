export const dynamic = 'force-dynamic';

import FinancePage from '../page';

interface Props {
    params: Promise<{ gangId: string }>;
    searchParams: Promise<{ page?: string; range?: string }>;
}

export default function FinanceHistoryPage(props: Props) {
    return (
        <FinancePage
            params={props.params}
            searchParams={props.searchParams.then((searchParams) => ({
                ...searchParams,
                tab: 'history',
            }))}
        />
    );
}
