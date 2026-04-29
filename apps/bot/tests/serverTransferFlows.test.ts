import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockGangFindFirst,
    mockMemberFindFirst,
    mockMembersFindMany,
    mockDbUpdate,
    mockClientGuildGet,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockMembersFindMany: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockClientGuildGet: vi.fn(),
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
                findMany: mockMembersFindMany,
            },
        },
        update: mockDbUpdate,
    },
    gangs: {
        id: 'gangs.id',
    },
    gangSettings: {},
    members: {
        id: 'members.id',
        discordId: 'members.discord_id',
        gangId: 'members.gang_id',
        isActive: 'members.is_active',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/index', () => ({
    client: {
        guilds: {
            cache: {
                get: mockClientGuildGet,
            },
        },
    },
}));

vi.mock('../src/utils/thaiTime', () => ({
    thaiTimestamp: vi.fn(() => '2026-04-23 21:30'),
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

import { handleButton } from '../src/handlers/buttons';
import { sendTransferAnnouncement } from '../src/features/serverTransfer';
import '../src/features/serverTransfer';

function createInteraction(overrides?: Partial<any>) {
    return {
        customId: 'transfer_confirm_gang-1',
        user: {
            id: 'discord-member',
        },
        message: {
            embeds: [{}],
            components: [{ type: 1 }],
        },
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('server transfer flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbUpdate.mockReturnValue({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        });
    });

    it('sends transfer announcements to the configured announcement channel', async () => {
        const send = vi.fn().mockResolvedValue(undefined);
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
            name: 'Tokyo',
            discordGuildId: 'guild-1',
            settings: {
                announcementChannelId: 'channel-1',
            },
        });
        mockClientGuildGet.mockReturnValue({
            channels: {
                cache: {
                    get: vi.fn(() => ({
                        send,
                    })),
                },
            },
        });

        await sendTransferAnnouncement('gang-1', '2026-05-01T10:00:00.000Z', ['u1', 'u2']);

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({
                content: '<@u1> <@u2>',
                embeds: expect.any(Array),
                components: expect.any(Array),
            })
        );
    });

    it('confirms transfer participation and updates the announcement embed', async () => {
        mockGangFindFirst
            .mockResolvedValueOnce({ transferStatus: 'ACTIVE', name: 'Tokyo' })
            .mockResolvedValueOnce({ name: 'Tokyo' });
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            gangRole: 'MEMBER',
            transferStatus: 'PENDING',
        });
        mockMembersFindMany.mockResolvedValue([
            { name: 'Owner', gangRole: 'OWNER', transferStatus: 'CONFIRMED' },
            { name: 'Nobita', gangRole: 'MEMBER', transferStatus: 'CONFIRMED' },
            { name: 'Suneo', gangRole: 'MEMBER', transferStatus: 'LEFT' },
        ]);

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(mockDbUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: interaction.message.components,
            })
        );
        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
    });

    it('blocks owners from leaving via the transfer leave button', async () => {
        mockGangFindFirst.mockResolvedValue({ transferStatus: 'ACTIVE' });
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            gangRole: 'OWNER',
            transferStatus: 'CONFIRMED',
        });

        const interaction = createInteraction({
            customId: 'transfer_leave_gang-1',
        });

        await handleButton(interaction as any);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
    });

    it('rejects transfer button clicks after the deadline without updating member status', async () => {
        mockGangFindFirst.mockResolvedValue({
            transferStatus: 'ACTIVE',
            transferDeadline: new Date(Date.now() - 60_000),
        });

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(mockMemberFindFirst).not.toHaveBeenCalled();
        expect(mockDbUpdate).not.toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('หมดเวลายืนยัน'),
                ephemeral: true,
            })
        );
    });
});
