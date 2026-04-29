const PROMPTPAY_AID = 'A000000677010111';

function tlv(id: string, value: string) {
    return `${id}${value.length.toString().padStart(2, '0')}${value}`;
}

function crc16CcittFalse(input: string) {
    let crc = 0xffff;
    for (let i = 0; i < input.length; i += 1) {
        crc ^= input.charCodeAt(i) << 8;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc & 0x8000) !== 0 ? ((crc << 1) ^ 0x1021) : (crc << 1);
            crc &= 0xffff;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function normalizePromptPayIdentifier(identifier: string) {
    const digits = identifier.replace(/\D/g, '');

    if (digits.length === 10 && digits.startsWith('0')) {
        return {
            tag: '01',
            value: `0066${digits.slice(1)}`,
        };
    }

    if (digits.length === 13) {
        return {
            tag: '02',
            value: digits,
        };
    }

    throw new Error('INVALID_PROMPTPAY_IDENTIFIER');
}

function normalizeAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 999999.99) {
        throw new Error('INVALID_PROMPTPAY_AMOUNT');
    }
    return amount.toFixed(2);
}

function normalizeReference(reference?: string | null) {
    const normalized = (reference ?? '').replace(/[^A-Za-z0-9-]/g, '').slice(0, 25);
    return normalized || null;
}

export function buildPromptPayQrPayload(input: {
    identifier: string;
    amount: number;
    reference?: string | null;
}) {
    const proxy = normalizePromptPayIdentifier(input.identifier);
    const merchantAccountInfo = tlv('00', PROMPTPAY_AID) + tlv(proxy.tag, proxy.value);
    const reference = normalizeReference(input.reference);

    const withoutCrc = [
        tlv('00', '01'),
        tlv('01', '12'),
        tlv('29', merchantAccountInfo),
        tlv('53', '764'),
        tlv('54', normalizeAmount(input.amount)),
        tlv('58', 'TH'),
        reference ? tlv('62', tlv('05', reference)) : '',
        '6304',
    ].join('');

    return `${withoutCrc}${crc16CcittFalse(withoutCrc)}`;
}
