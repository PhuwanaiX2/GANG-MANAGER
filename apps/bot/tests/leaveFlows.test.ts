import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockLeaveFindFirst,
    mockGangFindFirst,
    mockMemberFindFirst,
    mockCheckFeatureEnabled,
    mockCheckPermission,
    mockCreateLeaveRequest,
    mockReviewLeaveRequest,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockLeaveFindFirst: vi.fn(),
    mockGangFindFirst: vi.fn(),
    mockMemberFindFirst: vi.fn(),
    mockCheckFeatureEnabled: vi.fn(),
    mockCheckPermission: vi.fn(),
    mockCreateLeaveRequest: vi.fn(),
    mockReviewLeaveRequest: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            leaveRequests: {
                findFirst: mockLeaveFindFirst,
            },
            gangs: {
                findFirst: mockGangFindFirst,
            },
            members: {
                findFirst: mockMemberFindFirst,
            },
            gangSettings: {
                findFirst: vi.fn(),
            },
        },
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        })),
    },
    leaveRequests: {
        id: 'leave_requests.id',
    },
    members: {
        gangId: 'members.gang_id',
        discordId: 'members.discord_id',
        isActive: 'members.is_active',
    },
    gangs: {
        discordGuildId: 'gangs.discord_guild_id',
    },
    gangSettings: {
        gangId: 'gang_settings.gang_id',
    },
    reviewLeaveRequest: mockReviewLeaveRequest,
    LeaveReviewError: class LeaveReviewError extends Error {},
    createLeaveRequest: mockCreateLeaveRequest,
    CreateLeaveRequestError: class CreateLeaveRequestError extends Error {},
    buildLeaveReviewDiscordEmbed: vi.fn(() => ({})),
    buildLeaveRequestDiscordEmbed: vi.fn(() => ({})),
}));

vi.mock('drizzle-orm', () => ({
    eq: mockEq,
    and: mockAnd,
}));

vi.mock('../src/utils/featureGuard', () => ({
    checkFeatureEnabled: mockCheckFeatureEnabled,
}));

vi.mock('../src/utils/permissions', () => ({
    checkPermission: mockCheckPermission,
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

import { handleButton } from '../src/handlers/buttons';
import { handleModal } from '../src/handlers/modals';
import '../src/features/leave';

function createButtonInteraction(overrides?: Partial<any>) {
    return {
        customId: 'request_leave_late',
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
            displayName: 'Nobita',
            username: 'nobita',
            displayAvatarURL: vi.fn(() => 'https://avatar.test'),
        },
        client: {
            users: {
                fetch: vi.fn(),
            },
        },
        guild: {
            channels: {
                cache: new Map(),
            },
        },
        reply: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        showModal: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createModalInteraction(overrides?: Partial<any>) {
    return {
        customId: 'leave_form_LATE_CUSTOM',
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
            displayName: 'Nobita',
            username: 'nobita',
            displayAvatarURL: vi.fn(() => 'https://avatar.test'),
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        guild: {
            channels: {
                cache: new Map(),
            },
        },
        fields: {
            getTextInputValue: vi.fn((field: string) => {
                if (field === 'late_time') return 'not-a-time';
                if (field === 'leave_reason') return '';
                return '';
            }),
        },
        ...overrides,
    };
}

describe('leave button and modal flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckFeatureEnabled.mockResolvedValue(true);
    });

    it('shows preset late options from the leave button', async () => {
        const interaction = createButtonInteraction();

        await handleButton(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                components: expect.any(Array),
                ephemeral: true,
            })
        );
    });

    it('blocks leave approval when the reviewer lacks permission', async () => {
        mockLeaveFindFirst.mockResolvedValue({
            id: 'leave-1',
            status: 'PENDING',
            gangId: 'gang-1',
        });
        mockCheckPermission.mockResolvedValue(false);

        const interaction = createButtonInteraction({
            customId: 'leave_approve_leave-1',
        });

        await handleButton(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
        expect(mockReviewLeaveRequest).not.toHaveBeenCalled();
    });

    it('rejects invalid custom late times before creating a leave request', async () => {
        mockGangFindFirst.mockResolvedValue({
            id: 'gang-1',
        });
        mockMemberFindFirst.mockResolvedValue({
            id: 'member-1',
            name: 'Nobita',
        });

        const interaction = createModalInteraction();

        await handleModal(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
            })
        );
        expect(mockCreateLeaveRequest).not.toHaveBeenCalled();
    });
});
