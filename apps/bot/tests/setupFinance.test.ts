import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCheckGangSubscriptionFeatureAccess } = vi.hoisted(() => ({
    mockCheckGangSubscriptionFeatureAccess: vi.fn(),
}));

vi.mock('../src/utils/featureGuard', () => ({
    checkGangSubscriptionFeatureAccess: mockCheckGangSubscriptionFeatureAccess,
}));

import { setupFinanceCommand } from '../src/commands/setupFinance';

function createInteraction(overrides?: Partial<any>) {
    const channel = {
        isSendable: vi.fn(() => true),
        send: vi.fn().mockResolvedValue(undefined),
    };

    return {
        guildId: 'guild-1',
        channel,
        reply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('setup finance command', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockCheckGangSubscriptionFeatureAccess.mockResolvedValue({
            allowed: true,
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'PREMIUM',
                balance: 1000,
            },
        });
    });

    it('does not publish finance buttons when the subscription guard denies access', async () => {
        mockCheckGangSubscriptionFeatureAccess.mockResolvedValueOnce({
            allowed: false,
            gang: {
                id: 'gang-1',
                name: 'Tokyo',
                subscriptionTier: 'FREE',
                balance: 0,
            },
        });
        const interaction = createInteraction();

        await setupFinanceCommand.execute(interaction as any);

        expect(mockCheckGangSubscriptionFeatureAccess).toHaveBeenCalledWith(
            interaction,
            'guild-1',
            'finance',
            'ระบบการเงิน'
        );
        expect(interaction.channel.send).not.toHaveBeenCalled();
    });

    it('publishes the finance panel after the shared subscription guard allows access', async () => {
        const interaction = createInteraction();

        await setupFinanceCommand.execute(interaction as any);

        const sentPanel = interaction.channel.send.mock.calls[0][0];
        const buttonIds = sentPanel.components[0].components.map((component: any) => component.data.custom_id);

        expect(interaction.channel.send).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
        expect(buttonIds).toEqual([
            'finance_request_loan',
            'finance_request_repay',
            'finance_request_deposit',
            'finance_balance',
        ]);
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('สร้างปุ่ม Finance'),
                ephemeral: true,
            })
        );
    });
});
