import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockSessionFindFirst,
    mockCheckFeatureEnabled,
    mockCheckPermission,
    mockCloseSessionAndReport,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockSessionFindFirst: vi.fn(),
    mockCheckFeatureEnabled: vi.fn(),
    mockCheckPermission: vi.fn(),
    mockCloseSessionAndReport: vi.fn(),
    mockEq: vi.fn((left, right) => ({ left, right })),
    mockAnd: vi.fn((...conditions: unknown[]) => conditions),
}));

vi.mock('@gang/database', () => ({
    db: {
        query: {
            attendanceSessions: {
                findFirst: mockSessionFindFirst,
            },
            attendanceRecords: {
                findFirst: vi.fn(),
                findMany: vi.fn(),
            },
            members: {
                findFirst: vi.fn(),
            },
        },
        insert: vi.fn(),
        update: vi.fn(() => ({
            set: vi.fn(() => ({
                where: vi.fn().mockResolvedValue(undefined),
            })),
        })),
    },
    attendanceSessions: {
        id: 'attendance_sessions.id',
    },
    attendanceRecords: {
        sessionId: 'attendance_records.session_id',
        memberId: 'attendance_records.member_id',
    },
    members: {
        gangId: 'members.gang_id',
        discordId: 'members.discord_id',
        isActive: 'members.is_active',
        status: 'members.status',
    },
    gangs: {},
    auditLogs: {},
}));

vi.mock('@gang/database/attendance', () => ({
    isPresentLikeStatus: vi.fn(() => true),
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

vi.mock('../src/services/attendanceScheduler', () => ({
    closeSessionAndReport: mockCloseSessionAndReport,
}));

vi.mock('../src/utils/logger', () => ({
    logInfo: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
}));

vi.mock('nanoid', () => ({
    nanoid: vi.fn(() => 'attendance-1'),
}));

import { handleButton } from '../src/handlers/buttons';
import '../src/features/attendance';

function createInteraction(overrides?: Partial<any>) {
    return {
        customId: 'attendance_close_session-1',
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
            displayName: 'Nobita',
        },
        deferUpdate: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        deleteReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('attendance button flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCheckFeatureEnabled.mockResolvedValue(true);
    });

    it('blocks check-in when the session is no longer active', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            status: 'CLOSED',
        });

        const interaction = createInteraction({
            customId: 'attendance_checkin_session-1',
        });

        await handleButton(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
    });

    it('blocks closing attendance sessions for users without elevated permission', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            status: 'ACTIVE',
        });
        mockCheckPermission.mockResolvedValue(false);

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                ephemeral: true,
            })
        );
        expect(mockCloseSessionAndReport).not.toHaveBeenCalled();
    });

    it('closes active sessions through the shared close service for authorized users', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            sessionName: 'Daily Patrol',
            status: 'ACTIVE',
        });
        mockCheckPermission.mockResolvedValue(true);

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(mockCloseSessionAndReport).toHaveBeenCalledWith(
            expect.objectContaining({
                id: 'session-1',
                gangId: 'gang-1',
            }),
            expect.objectContaining({
                actorId: 'discord-1',
                actorName: 'Nobita',
                triggeredBy: 'bot',
            })
        );
    });
});
