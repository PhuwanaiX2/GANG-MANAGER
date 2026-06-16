import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mockSessionFindFirst,
    mockGangFindFirst,
    mockCheckFeatureEnabled,
    mockCheckPermission,
    mockCloseSessionAndReport,
    mockEq,
    mockAnd,
} = vi.hoisted(() => ({
    mockSessionFindFirst: vi.fn(),
    mockGangFindFirst: vi.fn(),
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
            gangs: {
                findFirst: mockGangFindFirst,
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
    gangs: {
        id: 'gangs.id',
        discordGuildId: 'gangs.discord_guild_id',
    },
    auditLogs: {},
}));

vi.mock('@gang/database/attendance', () => ({
    isManualRollCallSession: vi.fn((mode?: string | null) => mode === 'MANUAL_ROLL_CALL'),
    isPresentLikeStatus: vi.fn(() => true),
    isSupplementalAttendanceSession: vi.fn((policy?: string | null) => policy === 'SUPPLEMENTAL'),
    requiresAttendanceCode: vi.fn((mode?: string | null) => mode === 'CODE'),
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
import { handleModal } from '../src/handlers/modals';
import { db } from '@gang/database';
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
        deferReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockResolvedValue(undefined),
        showModal: vi.fn().mockResolvedValue(undefined),
        followUp: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        deleteReply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function createModalInteraction(overrides?: Partial<any>) {
    return {
        customId: 'attendance_code_modal_session-1',
        guildId: 'guild-1',
        user: {
            id: 'discord-1',
            displayName: 'Nobita',
        },
        fields: {
            getTextInputValue: vi.fn(() => '1234'),
        },
        reply: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

describe('attendance button flows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (db as any).insert.mockReset();
        (db as any).query.attendanceRecords.findFirst.mockReset();
        (db as any).query.attendanceRecords.findMany.mockReset();
        (db as any).query.members.findFirst.mockReset();
        mockCheckFeatureEnabled.mockResolvedValue(true);
        mockGangFindFirst.mockResolvedValue({ id: 'gang-1' });
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
                flags: 64,
            })
        );
    });

    it('blocks Discord self check-in for manual roll-call sessions', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            status: 'ACTIVE',
            mode: 'MANUAL_ROLL_CALL',
        });

        const interaction = createInteraction({
            customId: 'attendance_checkin_session-1',
        });

        await handleButton(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.followUp).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                flags: 64,
            })
        );
    });

    it('opens a code modal instead of recording immediately for code-protected Discord check-in', async () => {
        const interaction = createInteraction({
            customId: 'attendance_code_checkin_session-1',
        });

        await handleButton(interaction as any);

        expect(interaction.showModal).toHaveBeenCalledOnce();
        expect(interaction.deferUpdate).not.toHaveBeenCalled();
        expect(mockSessionFindFirst).not.toHaveBeenCalled();
        expect((db as any).query.members.findFirst).not.toHaveBeenCalled();
        expect((db as any).insert).not.toHaveBeenCalled();
    });

    it('rejects an incorrect attendance code without creating a record', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            sessionName: 'Code round',
            status: 'ACTIVE',
            mode: 'DISCORD_SELF_CHECKIN',
            countingPolicy: 'REQUIRED',
            verificationMode: 'CODE',
            verificationCode: '1234',
            endTime: new Date(Date.now() + 60_000),
        });
        (db as any).query.members.findFirst.mockResolvedValue({ id: 'member-1' });
        (db as any).query.attendanceRecords.findFirst.mockResolvedValue(null);

        const interaction = createModalInteraction({
            fields: {
                getTextInputValue: vi.fn(() => '9999'),
            },
        });

        await handleModal(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.any(String),
            flags: 64,
        }));
        expect((db as any).insert).not.toHaveBeenCalled();
    });

    it('records a present attendance result with code proof when the code matches', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            sessionName: 'Code round',
            status: 'ACTIVE',
            mode: 'DISCORD_SELF_CHECKIN',
            countingPolicy: 'REQUIRED',
            verificationMode: 'CODE',
            verificationCode: '1234',
            endTime: new Date(Date.now() + 60_000),
            discordChannelId: null,
            discordMessageId: null,
        });
        (db as any).query.members.findFirst.mockResolvedValue({ id: 'member-1' });
        (db as any).query.attendanceRecords.findFirst.mockResolvedValue(null);
        (db as any).query.attendanceRecords.findMany.mockResolvedValue([]);

        const onConflictDoNothing = vi.fn().mockResolvedValue(undefined);
        const values = vi.fn().mockReturnValue({ onConflictDoNothing });
        (db as any).insert.mockReturnValue({ values });

        const interaction = createModalInteraction({
            fields: {
                getTextInputValue: vi.fn(() => '1234'),
            },
        });

        await handleModal(interaction as any);

        expect(values).toHaveBeenCalledWith(expect.objectContaining({
            sessionId: 'session-1',
            memberId: 'member-1',
            status: 'PRESENT',
            proofType: 'CODE',
            proofValue: 'MATCHED',
        }));
        expect(onConflictDoNothing).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.any(String),
            flags: 64,
        }));
    });

    it('asks for confirmation before closing attendance sessions', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            sessionName: 'Daily Patrol',
            status: 'ACTIVE',
        });
        mockCheckPermission.mockResolvedValue(true);

        const interaction = createInteraction();

        await handleButton(interaction as any);

        expect(interaction.deferReply).toHaveBeenCalledWith({ flags: 64 });
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Daily Patrol'),
                components: expect.any(Array),
            })
        );
        expect(mockCloseSessionAndReport).not.toHaveBeenCalled();
    });

    it('blocks close confirmation for users without elevated permission', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            sessionName: 'Daily Patrol',
            status: 'ACTIVE',
        });
        mockCheckPermission.mockResolvedValue(false);

        const interaction = createInteraction({
            customId: 'attendance_close_confirm_session-1',
        });

        await handleButton(interaction as any);

        expect(interaction.deferUpdate).toHaveBeenCalled();
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.any(String),
                components: [],
            })
        );
        expect(mockCloseSessionAndReport).not.toHaveBeenCalled();
    });

    it('closes active sessions through the shared close service after confirmation', async () => {
        mockSessionFindFirst.mockResolvedValue({
            id: 'session-1',
            gangId: 'gang-1',
            sessionName: 'Daily Patrol',
            status: 'ACTIVE',
        });
        mockCheckPermission.mockResolvedValue(true);

        const interaction = createInteraction({
            customId: 'attendance_close_confirm_session-1',
        });

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
        expect(interaction.editReply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('Daily Patrol'),
                components: [],
            })
        );
    });

    it('keeps cancellation in the web app even when an old Discord cancel button is clicked', async () => {
        const interaction = createInteraction({
            customId: 'attendance_cancel_session-1',
        });

        await handleButton(interaction as any);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('หน้าเว็บ'),
                flags: 64,
            })
        );
        expect(mockCloseSessionAndReport).not.toHaveBeenCalled();
    });
});
