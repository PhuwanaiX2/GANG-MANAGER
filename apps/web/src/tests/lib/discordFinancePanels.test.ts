import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockSettingsFindFirst,
    mockDbUpdate,
    mockLogWarn,
    mockEq,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockSettingsFindFirst: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockLogWarn: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
            gangSettings: {
                findFirst: mockSettingsFindFirst,
            },
        },
        update: mockDbUpdate,
    },
    gangs: {
        id: 'gangs.id',
    },
    gangSettings: {
        gangId: 'gang_settings.gang_id',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
}));

vi.mock('@/lib/logger', () => ({
    logWarn: mockLogWarn,
}));

import {
    buildAdminPanelComponents,
    buildFinancePanelComponents,
    refreshFinanceDiscordPanelsForGang,
} from '@/lib/discordFinancePanels';

function flattenComponents(components: any[]) {
    return components.flatMap((row) => row.components ?? []);
}

describe('Discord finance panel refresh', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
        vi.clearAllMocks();
        process.env = { ...originalEnv };
        process.env.DISCORD_BOT_TOKEN = 'bot-token';
        process.env.PUBLIC_WEB_URL = 'https://gang-manager.example';

        mockGangFindFirst.mockResolvedValue({ discordGuildId: 'guild-1' });
        mockSettingsFindFirst.mockResolvedValue({
            financeChannelId: 'finance-channel',
            financeMessageId: 'finance-message',
            adminPanelMessageId: 'admin-message',
            logChannelId: 'log-channel',
            requestsChannelId: 'requests-channel',
        });
        mockDbUpdate.mockReturnValue({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        process.env = originalEnv;
    });

    it('builds Discord finance controls without static disabled flags', () => {
        const financeButtons = flattenComponents(buildFinancePanelComponents());
        const adminButtons = flattenComponents(buildAdminPanelComponents('gang-123'));

        expect([...financeButtons, ...adminButtons].some((button) => 'disabled' in button)).toBe(false);
        expect(adminButtons.find((button) => button.label === '💰 การเงินบนเว็บ')).toMatchObject({
            style: 5,
            url: 'https://gang-manager.example/dashboard/gang-123/finance',
        });
    });

    it('enables existing finance and admin panels after entitlement changes', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn() })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                    { id: 'panel-channel', name: 'แผงควบคุม' },
                    { id: 'log-channel', name: 'log-ระบบ' },
                ]),
            })
            .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn() });

        vi.stubGlobal('fetch', fetchMock);

        const result = await refreshFinanceDiscordPanelsForGang('gang-123');

        expect(result).toEqual({ updated: 2 });
        expect(fetchMock).toHaveBeenNthCalledWith(
            1,
            'https://discord.com/api/v10/channels/finance-channel/messages/finance-message',
            expect.objectContaining({ method: 'PATCH' })
        );
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            'https://discord.com/api/v10/channels/panel-channel/messages/admin-message',
            expect.objectContaining({ method: 'PATCH' })
        );

        const financePatchBody = JSON.parse(fetchMock.mock.calls[0][1].body);
        const adminPatchBody = JSON.parse(fetchMock.mock.calls[2][1].body);
        expect(JSON.stringify(financePatchBody)).not.toContain('"disabled"');
        expect(JSON.stringify(adminPatchBody)).not.toContain('"disabled"');
    });

    it('searches the finance channel and stores the message id when older setups did not save it', async () => {
        mockSettingsFindFirst.mockResolvedValueOnce({
            financeChannelId: 'finance-channel',
            financeMessageId: null,
            adminPanelMessageId: null,
            logChannelId: null,
            requestsChannelId: null,
        });
        const updateWhere = vi.fn().mockResolvedValue(undefined);
        const updateSet = vi.fn(() => ({ where: updateWhere }));
        mockDbUpdate.mockReturnValueOnce({ set: updateSet });

        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([
                    {
                        id: 'finance-message-found',
                        author: { bot: true },
                        embeds: [{ title: '💰 ศูนย์การเงินของสมาชิก' }],
                    },
                ]),
            })
            .mockResolvedValueOnce({ ok: true, status: 200, json: vi.fn() })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: vi.fn().mockResolvedValue([]),
            });

        vi.stubGlobal('fetch', fetchMock);

        const result = await refreshFinanceDiscordPanelsForGang('gang-123');

        expect(result.updated).toBe(1);
        expect(updateSet).toHaveBeenCalledWith({ financeMessageId: 'finance-message-found' });
        expect(updateWhere).toHaveBeenCalled();
    });
});
