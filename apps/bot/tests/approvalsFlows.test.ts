import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockMemberFindFirst,
    mockGangFindFirst,
    mockCheckPermission,
    mockAssignMemberRole,
    mockCreateAuditLog,
    mockDbUpdate,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockMemberFindFirst: vi.fn(),
    mockGangFindFirst: vi.fn(),
    mockCheckPermission: vi.fn(),
    mockAssignMemberRole: vi.fn(),
    mockCreateAuditLog: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            members: {
                findFirst: mockMemberFindFirst,
            },
            gangs: {
                findFirst: mockGangFindFirst,
            },
        },
        update: mockDbUpdate,
    },
    members: {
        id: 'members.id',
    },
    gangs: {
        id: 'gangs.id',
    },
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/utils/permissions', () => ({
    checkPermission: mockCheckPermission,
}));

vi.mock('../src/features/registerModal', () => ({
    assignMemberRole: mockAssignMemberRole,
}));

vi.mock('../src/utils/auditLog', () => ({
    createAuditLog: mockCreateAuditLog,
}));

vi.mock('../src/utils/thaiTime', () => ({
    thaiTimestamp: vi.fn(() => '2026-04-23 21:00'),
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

import { handleButton } from '../src/handlers/buttons';
import '../src/features/approvals';

function createInteraction(overrides?: Partial<any>) {
    const applicant = {
        send: vi.fn().mockResolvedValue(undefined),
    };
    const guildMember = {
        setNickname: vi.fn().mockResolvedValue(undefined),
    };

    return {
        customId: 'approve_member_member-1',
        user: {
            id: 'discord-admin',
            username: 'admin',
            displayAvatarURL: vi.fn(() => 'https://avatar.test/admin'),
        },
        message: {
            embeds: [{ data: {} }],
        },
        client: {
            users: {
                fetch: vi.fn().mockResolvedValue(applicant),
            },
        },
        guild: {
            members: {
                fetch: vi.fn().mockResolvedValue(guildMember),
            },
        },
        reply: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('member approval and rejection flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbUpdate.mockReturnValue({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        });
    });

    it('blocks approval when the reviewer lacks permission', async () => {
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            status: 'PENDING',
        });
        mockCheckPermission.mockResolvedValue(false);

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
        expect(interaction.update).not.toHaveBeenCalled();
        expect(mockAssignMemberRole).not.toHaveBeenCalled();
    });

    it('approves pending members, syncs roles, and records an audit log', async () => {
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            status: 'PENDING',
            discordId: 'discord-member',
            name: 'Shizuka',
        });
        mockCheckPermission.mockResolvedValue(true);
        mockGangFindFirst
            .mockResolvedValueOnce({ transferStatus: 'ACTIVE' })
            .mockResolvedValueOnce({ name: 'Tokyo' });

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(interaction.update).toHaveBeenCalledWith({ components: [] });
        expect(mockDbUpdate).toHaveBeenCalled();
        expect(mockAssignMemberRole).toHaveBeenCalled();
        expect(interaction.guild.members.fetch).toHaveBeenCalledWith('discord-member');
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: [],
            })
        );
        const approveEmbed = interaction.editReply.mock.calls.at(-1)?.[0].embeds[0].data;
        expect(approveEmbed.title).toBe('✅ อนุมัติเรียบร้อย');
        expect(mockCreateAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                gangId: 'gang-1',
                actorId: 'discord-admin',
                action: 'MEMBER_APPROVE',
                targetId: 'member-1',
            })
        );
        expect(interaction.client.users.fetch).toHaveBeenCalledWith('discord-member');
        const applicant = await interaction.client.users.fetch.mock.results[0].value;
        expect(applicant.send).toHaveBeenCalledWith(expect.stringContaining('ได้รับการอนุมัติ'));
    });

    it('rejects members and records the rejection audit trail', async () => {
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            gangId: 'gang-1',
            status: 'PENDING',
            discordId: 'discord-member',
        });
        mockCheckPermission.mockResolvedValue(true);
        mockGangFindFirst.mockResolvedValue({ name: 'Tokyo' });

        const interaction = createInteraction({
            customId: 'reject_member_member-1',
        });

        await handleButton(interaction as any);

        expect(interaction.update).toHaveBeenCalledWith({ components: [] });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                embeds: expect.any(Array),
                components: [],
            })
        );
        const rejectEmbed = interaction.editReply.mock.calls.at(-1)?.[0].embeds[0].data;
        expect(rejectEmbed.title).toBe('❌ ปฏิเสธคำขอ');
        expect(mockCreateAuditLog).toHaveBeenCalledWith(
            expect.objectContaining({
                gangId: 'gang-1',
                action: 'MEMBER_REJECT',
                targetId: 'member-1',
            })
        );
    });
});
