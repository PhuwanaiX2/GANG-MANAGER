import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SlipOkError, verifySlipOkSlip } from '@/lib/slipOk';

describe('SlipOK verification', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
        process.env.SLIPOK_API_KEY = 'test-api-key';
        process.env.SLIPOK_BRANCH_ID = 'test-branch';
        delete process.env.SLIPOK_API_BASE_URL;
    });

    afterEach(() => {
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('normalizes provider package expiry into an operational SlipOK error code', async () => {
        global.fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
            success: false,
            message: 'Package ของคุณหมดอายุแล้ว',
        }), { status: 402 })) as any;

        await expect(verifySlipOkSlip({ payload: '0002010102123456' }, 179))
            .rejects
            .toMatchObject<Partial<SlipOkError>>({
                code: 'SLIPOK_PACKAGE_EXPIRED',
                message: 'Package ของคุณหมดอายุแล้ว',
                status: 402,
            });
    });
});
