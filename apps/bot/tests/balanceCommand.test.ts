import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindFirst,
    mockGetMemberFinanceSnapshot,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockGetMemberFinanceSnapshot: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            gangs: {
                findFirst: mockGangFindFirst,
            },
            members: {
                findFirst: mockMemberFindFirst,
            },
        },
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    members: {
        gangId: 'members.gang_id',
        discordId: 'members.discord_id',
        isActive: 'members.is_active',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/utils/financeSnapshot', () => ({
    getMemberFinanceSnapshot: mockGetMemberFinanceSnapshot,
}));

import { balanceCommand } from '../src/commands/balance';

function createInteraction(overrides?: Partial<any>) {
    return {
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('balance command', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
            balance: 1000,
        });
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            name: 'Nobita',
            balance: 25,
        });
        mockGetMemberFinanceSnapshot.mockResolvedValue({
            loanDebt: 100,
            collectionDue: 50,
        });
    });

    it('explains that loan debt and gang-fee collection are separate ledgers', async () => {
        const interaction = createInteraction();

        await balanceCommand.execute(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        const reply = interaction.editReply.mock.calls.at(-1)?.[0];
        const embed = reply.embeds[0].data;
        const fieldNames = (embed.fields ?? []).map((field: any) => field.name).join(' ');

        expect(embed.description).toContain('คนละยอด');
        expect(embed.description).toContain('ชำระหนี้ยืมเข้ากองกลาง');
        expect(embed.description).toContain('ชำระค่าเก็บเงินแก๊ง / ฝากเครดิต');
        expect(fieldNames).toContain('หนี้ยืมคงค้าง');
        expect(fieldNames).toContain('ค้างเก็บเงินแก๊ง');
    });
});
