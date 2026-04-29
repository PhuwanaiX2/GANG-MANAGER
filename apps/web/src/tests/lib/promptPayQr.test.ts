import { describe, expect, it } from 'vitest';
import { buildPromptPayQrPayload } from '@/lib/promptPayQr';

function readTlv(payload: string) {
    const tags: Record<string, string> = {};
    let index = 0;
    while (index < payload.length) {
        const id = payload.slice(index, index + 2);
        const length = Number(payload.slice(index + 2, index + 4));
        const value = payload.slice(index + 4, index + 4 + length);
        tags[id] = value;
        index += 4 + length;
    }
    return tags;
}

describe('buildPromptPayQrPayload', () => {
    it('builds a dynamic PromptPay payload for Thai phone numbers', () => {
        const payload = buildPromptPayQrPayload({
            identifier: '081-234-5678',
            amount: 199,
            reference: 'GX-ABC-123',
        });

        const tags = readTlv(payload);
        expect(tags['00']).toBe('01');
        expect(tags['01']).toBe('12');
        expect(tags['29']).toContain('A000000677010111');
        expect(tags['29']).toContain('0066812345678');
        expect(tags['53']).toBe('764');
        expect(tags['54']).toBe('199.00');
        expect(tags['58']).toBe('TH');
        expect(tags['62']).toContain('GX-ABC-123');
        expect(tags['63']).toMatch(/^[0-9A-F]{4}$/);
    });

    it('supports 13 digit national IDs or tax IDs', () => {
        const payload = buildPromptPayQrPayload({
            identifier: '1234567890123',
            amount: 1499,
        });

        const tags = readTlv(payload);
        expect(tags['29']).toContain('02131234567890123');
        expect(tags['54']).toBe('1499.00');
    });

    it('rejects invalid identifiers and amounts', () => {
        expect(() => buildPromptPayQrPayload({ identifier: '123', amount: 199 })).toThrow('INVALID_PROMPTPAY_IDENTIFIER');
        expect(() => buildPromptPayQrPayload({ identifier: '0812345678', amount: 0 })).toThrow('INVALID_PROMPTPAY_AMOUNT');
    });
});
