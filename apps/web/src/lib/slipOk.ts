export type SlipOkVerifyInput =
    | { payload: string; imageUrl?: never }
    | { imageUrl: string; payload?: never };

export type SlipOkSlipData = {
    transRef: string;
    amount: number;
    receiver?: unknown;
    sender?: unknown;
    receivingBank?: string;
    sendingBank?: string;
    transTimestamp?: string;
};

export class SlipOkError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly status = 502,
        public readonly slipData?: SlipOkSlipData
    ) {
        super(message);
        this.name = 'SlipOkError';
    }
}

function getSlipOkApiKey() {
    return process.env.SLIPOK_API_KEY?.trim() || '';
}

function getSlipOkBranchId() {
    return process.env.SLIPOK_BRANCH_ID?.trim() || '';
}

function getSlipOkBaseUrl() {
    return (process.env.SLIPOK_API_BASE_URL?.trim() || 'https://api.slipok.com/api/line/apikey').replace(/\/+$/, '');
}

export function isSlipOkAutoVerifyEnabled() {
    return process.env.ENABLE_SLIPOK_AUTO_VERIFY === 'true' && Boolean(getSlipOkApiKey() && getSlipOkBranchId());
}

function assertConfigured() {
    if (!getSlipOkApiKey() || !getSlipOkBranchId()) {
        throw new SlipOkError('SlipOK API key or branch ID is not configured', 'SLIPOK_NOT_CONFIGURED', 503);
    }
}

async function parseSlipOkResponse(response: Response) {
    const text = await response.text();
    try {
        return text ? JSON.parse(text) : null;
    } catch {
        throw new SlipOkError('SlipOK returned an invalid JSON response', 'SLIPOK_INVALID_RESPONSE');
    }
}

function normalizeSlipOkErrorCode(code: unknown) {
    if (code === 1012) return 'DUPLICATE_SLIP';
    if (code === 1013) return 'AMOUNT_MISMATCH';
    if (code === 1014) return 'ACCOUNT_MISMATCH';
    if (code === 1010) return 'BANK_DELAY';
    return code ? `SLIPOK_${code}` : 'SLIPOK_VERIFY_FAILED';
}

export async function verifySlipOkSlip(input: SlipOkVerifyInput, expectedAmount: number): Promise<SlipOkSlipData> {
    assertConfigured();

    const body = {
        ...(input.payload ? { data: input.payload } : { url: input.imageUrl }),
        log: true,
        amount: expectedAmount,
    };

    const response = await fetch(`${getSlipOkBaseUrl()}/${getSlipOkBranchId()}`, {
        method: 'POST',
        headers: {
            'x-authorization': getSlipOkApiKey(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
    });

    const result = await parseSlipOkResponse(response);
    if (!response.ok || !result?.success || !result?.data?.success) {
        const code = normalizeSlipOkErrorCode(result?.code);
        const message = result?.message || 'SlipOK verification failed';
        throw new SlipOkError(message, code, response.status || 502, result?.data);
    }

    const slipData = result.data as SlipOkSlipData;
    if (!slipData.transRef) {
        throw new SlipOkError('SlipOK response did not include a transaction reference', 'SLIPOK_MISSING_TRANS_REF');
    }
    if (Number(slipData.amount) !== expectedAmount) {
        throw new SlipOkError('Slip amount does not match the payment request', 'AMOUNT_MISMATCH', 422, slipData);
    }

    return slipData;
}
